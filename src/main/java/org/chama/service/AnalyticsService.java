package org.chama.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.chama.domain.ChamaTime;
import org.chama.domain.enums.HealthBand;
import org.chama.dto.ArrearsBucketDto;
import org.chama.dto.ChamaHealthDto;
import org.chama.dto.ContributionTrendPointDto;
import org.chama.dto.HealthComponentDto;
import org.chama.dto.LoanPortfolioSliceDto;
import org.chama.repository.AnalyticsRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Chama-level analytics: how contributions are trending, how much is in arrears and how old it is,
 * what the loan book looks like, and a single health score over the lot.
 *
 * <p>Every figure is aggregated in the database, following PlatformStatsService. Nothing here
 * materialises a list of contributions or repayments to add them up.
 *
 * <p>The health score follows the rules {@code CreditScoreService} settled on, because the same
 * mistakes are available here. A component the chama records nothing for is dropped and its weight
 * redistributed, rather than scored as a pass: a chama that has never held a meeting has not
 * demonstrated poor attendance, and should not be handed the attendance weight for free either. A
 * chama with no evidence at all gets no score rather than a flattering one.
 */
@ApplicationScoped
public class AnalyticsService {

    /** Due dates are Nairobi calendar dates, as everywhere else that compares against one. */

    static final String COLLECTION_RATE = "COLLECTION_RATE";
    static final String ARREARS_HEALTH = "ARREARS_HEALTH";
    static final String LOAN_REPAYMENT = "LOAN_REPAYMENT";
    static final String MEETING_ATTENDANCE = "MEETING_ATTENDANCE";
    static final String MEMBERSHIP_STABILITY = "MEMBERSHIP_STABILITY";

    private static final double COLLECTION_RATE_WEIGHT = 0.30;
    private static final double ARREARS_HEALTH_WEIGHT = 0.20;
    private static final double LOAN_REPAYMENT_WEIGHT = 0.25;
    private static final double MEETING_ATTENDANCE_WEIGHT = 0.15;
    private static final double MEMBERSHIP_STABILITY_WEIGHT = 0.10;

    private static final int THRIVING_FROM = 80;
    private static final int GOOD_FROM = 65;
    private static final int FAIR_FROM = 45;

    /** All four are always returned, zeros included, so a chart cannot lose a category. */
    private static final List<String> ARREARS_BUCKETS = List.of("1-30", "31-60", "61-90", "90+");

    private static final int MAX_TREND_MONTHS = 36;

    /**
     * Scaled, so a zero-filled month serialises as 0.00 like every other month rather than as a
     * bare 0. A field whose shape depends on whether data happened to exist is a trap for callers.
     */
    private static final BigDecimal ZERO_MONEY = BigDecimal.ZERO.setScale(2);

    @Inject
    AnalyticsRepository analyticsRepository;

    @Inject
    ChamaService chamaService;

    /**
     * Money billed against money collected, one point per month, oldest first.
     *
     * <p>Months with no billing are filled in at zero rather than omitted. A chart that drops its
     * empty months silently redraws the x-axis, so a chama that collected nothing in March reads
     * as though March never happened.
     */
    public List<ContributionTrendPointDto> contributionTrend(Long chamaId, int months) {
        int window = Math.clamp(months, 1, MAX_TREND_MONTHS);
        YearMonth end = YearMonth.now(ChamaTime.ZONE);
        YearMonth start = end.minusMonths(window - 1L);

        Map<String, Object[]> byMonth = new HashMap<>();
        for (Object[] row : analyticsRepository.contributionTrend(
                chamaId, start.atDay(1), end.plusMonths(1).atDay(1))) {
            byMonth.put((String) row[0], row);
        }

        List<ContributionTrendPointDto> points = new ArrayList<>(window);
        for (int i = 0; i < window; i++) {
            YearMonth month = start.plusMonths(i);
            String key = month.toString();
            Object[] row = byMonth.get(key);
            BigDecimal expected = row == null ? ZERO_MONEY : money(row[1]);
            BigDecimal collected = row == null ? ZERO_MONEY : money(row[2]);
            points.add(new ContributionTrendPointDto(key, expected, collected, ratio(collected, expected)));
        }
        return points;
    }

    /** Unpaid balances aged into buckets, every bucket present whether or not it holds anything. */
    public List<ArrearsBucketDto> arrears(Long chamaId) {
        Map<String, Object[]> byBucket = new HashMap<>();
        for (Object[] row : analyticsRepository.arrearsBuckets(chamaId, today())) {
            byBucket.put((String) row[0], row);
        }
        return ARREARS_BUCKETS.stream()
            .map(bucket -> {
                Object[] row = byBucket.get(bucket);
                return row == null
                    ? new ArrearsBucketDto(bucket, 0, ZERO_MONEY)
                    : new ArrearsBucketDto(bucket, count(row[1]), money(row[2]));
            })
            .toList();
    }

    public List<LoanPortfolioSliceDto> loanPortfolio(Long chamaId) {
        return analyticsRepository.loanPortfolio(chamaId).stream()
            .map(row -> new LoanPortfolioSliceDto(
                (String) row[0], count(row[1]), money(row[2]), money(row[3])))
            .sorted(java.util.Comparator.comparing(LoanPortfolioSliceDto::status))
            .toList();
    }

    public ChamaHealthDto health(Long chamaId) {
        chamaService.get(chamaId);
        LocalDate today = today();

        Object[] contributions = analyticsRepository.contributionTotals(chamaId, today);
        Object[] repayments = analyticsRepository.repaymentTotals(chamaId, today);
        Object[] attendance = analyticsRepository.attendanceTotals(chamaId);
        Object[] membership = analyticsRepository.membershipTotals(chamaId);
        Object[] arrears = analyticsRepository.arrearsTotals(chamaId, today);

        BigDecimal billed = money(contributions[0]);
        BigDecimal collected = money(contributions[1]);
        long contributionRows = count(contributions[2]);

        BigDecimal arrearsAmount = money(arrears[1]);
        long membersInArrears = count(arrears[0]);

        long activeMembers = count(membership[0]);
        long everMembers = count(membership[1]);
        long repaymentRows = count(repayments[2]);
        long attendanceRows = count(attendance[1]);

        // Membership stability measures retention, and retention needs something to be retained
        // through. A chama founded last week with three members and nothing else recorded has a
        // perfect retention rate only because nobody has yet had the opportunity to leave, and
        // scoring that would hand it a hundred for having done nothing at all.
        boolean hasHistory = contributionRows > 0 || repaymentRows > 0 || attendanceRows > 0;

        List<Component> components = List.of(
            new Component(COLLECTION_RATE, "Contributions collected", COLLECTION_RATE_WEIGHT,
                ratio(collected, billed), contributionRows > 0),
            // Arrears against everything ever billed rather than against this month, so one bad
            // month in an otherwise healthy chama does not read as a collapse.
            new Component(ARREARS_HEALTH, "Arrears", ARREARS_HEALTH_WEIGHT,
                1.0 - ratio(arrearsAmount, billed), contributionRows > 0),
            new Component(LOAN_REPAYMENT, "Loans repaid", LOAN_REPAYMENT_WEIGHT,
                ratio(money(repayments[1]), money(repayments[0])), repaymentRows > 0),
            new Component(MEETING_ATTENDANCE, "Meeting attendance", MEETING_ATTENDANCE_WEIGHT,
                divide(count(attendance[0]), attendanceRows), attendanceRows > 0),
            // Members who left against everyone who ever joined. A chama people stay in is
            // healthier than one with the same money and a revolving door.
            new Component(MEMBERSHIP_STABILITY, "Membership stability", MEMBERSHIP_STABILITY_WEIGHT,
                divide(activeMembers, everMembers), everMembers > 0 && hasHistory));

        List<Component> evidenced = components.stream().filter(Component::hasEvidence).toList();
        BigDecimal outstandingLoans = money(analyticsRepository.outstandingLoanPrincipal(chamaId));

        if (evidenced.isEmpty()) {
            return new ChamaHealthDto(chamaId, null, HealthBand.INSUFFICIENT_HISTORY, List.of(),
                activeMembers, membersInArrears, collected, arrearsAmount, outstandingLoans);
        }

        double totalWeight = evidenced.stream().mapToDouble(Component::weight).sum();
        double weighted = evidenced.stream()
            .mapToDouble(c -> clamp(c.rate()) * c.weight() / totalWeight)
            .sum();
        int score = (int) Math.round(weighted * 100);

        List<HealthComponentDto> reported = evidenced.stream()
            .map(c -> new HealthComponentDto(c.code(), c.label(),
                round(clamp(c.rate())), round(c.weight() / totalWeight)))
            .toList();

        return new ChamaHealthDto(chamaId, score, band(score), reported,
            activeMembers, membersInArrears, collected, arrearsAmount, outstandingLoans);
    }

    private record Component(String code, String label, double weight, double rate, boolean hasEvidence) {}

    private static HealthBand band(int score) {
        if (score >= THRIVING_FROM) {
            return HealthBand.THRIVING;
        }
        if (score >= GOOD_FROM) {
            return HealthBand.GOOD;
        }
        if (score >= FAIR_FROM) {
            return HealthBand.FAIR;
        }
        return HealthBand.AT_RISK;
    }

    private static LocalDate today() {
        return LocalDate.now(ChamaTime.ZONE);
    }

    /** Zero when nothing was billed, so an empty month reports a rate rather than a divide by zero. */
    private static double ratio(BigDecimal part, BigDecimal whole) {
        if (whole == null || whole.signum() <= 0) {
            return 0.0;
        }
        return part.doubleValue() / whole.doubleValue();
    }

    private static double divide(long part, long whole) {
        return whole <= 0 ? 0.0 : (double) part / whole;
    }

    private static double clamp(double value) {
        return Math.max(0.0, Math.min(1.0, value));
    }

    private static double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    /** Native aggregates come back as BigDecimal or BigInteger depending on the column. */
    private static BigDecimal money(Object value) {
        BigDecimal amount = value == null ? BigDecimal.ZERO : new BigDecimal(value.toString());
        return amount.setScale(2, RoundingMode.HALF_UP);
    }

    private static long count(Object value) {
        return value == null ? 0L : ((Number) value).longValue();
    }
}
