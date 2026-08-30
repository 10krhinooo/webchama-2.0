package org.chama.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.NotFoundException;
import org.chama.domain.ChamaTime;
import org.chama.domain.enums.AttendanceStatus;
import org.chama.domain.enums.CreditScoreBand;
import org.chama.domain.enums.LoanStatus;
import org.chama.domain.enums.MemberStatus;
import org.chama.domain.enums.PenaltyStatus;
import org.chama.domain.model.Contribution;
import org.chama.domain.model.Loan;
import org.chama.domain.model.LoanRepayment;
import org.chama.domain.model.MeetingAttendance;
import org.chama.domain.model.Member;
import org.chama.domain.model.Penalty;
import org.chama.dto.CreditScoreDto;
import org.chama.dto.CreditScoreFactorDto;
import org.chama.repository.ContributionRepository;
import org.chama.repository.LoanRepaymentRepository;
import org.chama.repository.LoanRepository;
import org.chama.repository.MeetingAttendanceRepository;
import org.chama.repository.MemberRepository;
import org.chama.repository.PenaltyRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.DoublePredicate;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Internal credit score derived from a member's own record inside one chama (issue #58): how
 * completely and how promptly they contribute, how they repay, whether they turn up, and whether
 * they attract penalties. A signal for the chairperson or treasurer reviewing a loan request, not
 * a gate, nothing in the loan approval flow enforces a minimum.
 *
 * <p>Four properties are worth understanding before reading the numbers.
 *
 * <p><b>Absent evidence is not good evidence.</b> A component with nothing to judge is dropped and
 * its weight redistributed over the components that do have evidence, rather than being scored as
 * a pass. A chama that has never recorded attendance therefore scores on contributions and loans
 * alone, instead of handing every member the attendance weight for free.
 *
 * <p><b>Money is measured, not statuses counted.</b> A member who paid 90 percent of everything
 * owed is not in the same position as one who paid nothing, and a status of PARTIAL cannot tell
 * those apart, so every rate is built from amounts.
 *
 * <p><b>Thin records are pulled toward the middle.</b> One missed payment out of one is not a zero
 * percent payer. Each component is smoothed toward a neutral prior worth {@link #PRIOR_STRENGTH}
 * observations, so confidence has to be earned before a score reaches either extreme.
 *
 * <p><b>Recent behaviour counts for more.</b> Every observation is weighted by an exponential
 * decay halving every {@link #HALF_LIFE_MONTHS} months, so a member who has turned things around
 * is not held to a record from three years ago, and one coasting on an old record does not stay
 * there.
 */
@ApplicationScoped
public class CreditScoreService {

    /**
     * Due dates are calendar dates in the chama's own timezone, matching ContributionService and
     * ContributionAutoPushService. On UTC, everything due today looks overdue for the first three
     * hours of a Nairobi morning.
     */

    static final String CONTRIBUTION_CONSISTENCY = "CONTRIBUTION_CONSISTENCY";
    static final String CONTRIBUTION_TIMELINESS = "CONTRIBUTION_TIMELINESS";
    static final String LOAN_REPAYMENT = "LOAN_REPAYMENT";
    static final String MEETING_ATTENDANCE = "MEETING_ATTENDANCE";
    private static final double CONTRIBUTION_CONSISTENCY_WEIGHT = 0.35;
    private static final double CONTRIBUTION_TIMELINESS_WEIGHT = 0.15;
    private static final double LOAN_REPAYMENT_WEIGHT = 0.30;
    private static final double MEETING_ATTENDANCE_WEIGHT = 0.20;

    /**
     * Penalties are a deduction rather than a weighted component, because they are only ever
     * evidence in one direction. Scored as a component, "has never been penalised" would describe
     * almost every member and would quietly hand all of them a bonus, lifting a poor contributor's
     * score for something they did not do. Points come off for penalties that stood, and nothing
     * is added for their absence.
     */
    private static final double POINTS_PER_UPHELD_PENALTY = 5.0;
    private static final int MAX_PENALTY_DEDUCTION = 25;

    private static final double HALF_LIFE_MONTHS = 9.0;
    private static final double DAYS_PER_MONTH = 30.44;

    /** The neutral prior each component is smoothed toward, and how many observations it is worth. */
    private static final double PRIOR_RATE = 0.75;
    private static final double PRIOR_STRENGTH = 2.0;

    /** Recency-weighted observations at which a score is reported as fully confident. */
    private static final double FULL_CONFIDENCE_OBSERVATIONS = 12.0;

    /**
     * Lateness is forgiven on a slope rather than a cliff: on the day it is due earns full credit,
     * and credit reaches zero this many days later. A single cliff would score a payment one day
     * late the same as one four months late.
     */
    private static final double LATENESS_GRACE_DAYS = 30.0;

    /**
     * A written-off loan caps the score below the FAIR band however good the rest of the record
     * looks. A default is a categorical fact about a borrower, not a few points of arithmetic.
     */
    private static final int DEFAULT_CAP = 40;

    private static final int EXCELLENT_FROM = 80;
    private static final int GOOD_FROM = 65;
    private static final int FAIR_FROM = 45;

    /** A component reads as a strength at or above this rate, and as a weakness below the other. */
    private static final double STRENGTH_FROM = 0.85;
    private static final double WEAKNESS_BELOW = 0.60;
    private static final int MAX_FACTORS = 3;

    @Inject
    MemberRepository memberRepository;

    @Inject
    ContributionRepository contributionRepository;

    @Inject
    MeetingAttendanceRepository meetingAttendanceRepository;

    @Inject
    LoanRepaymentRepository loanRepaymentRepository;

    @Inject
    PenaltyRepository penaltyRepository;

    @Inject
    LoanRepository loanRepository;

    public CreditScoreDto calculate(Long chamaId, Long memberId) {
        Member member = memberRepository.findByIdOptional(memberId).orElseThrow(NotFoundException::new);
        if (!member.chama.id.equals(chamaId)) {
            throw new NotFoundException();
        }
        return score(memberId, new Evidence(
            contributionRepository.findByChamaAndMember(chamaId, memberId),
            meetingAttendanceRepository.findByChamaAndMember(chamaId, memberId),
            loanRepaymentRepository.findByChamaAndMember(chamaId, memberId),
            penaltyRepository.findByChamaAndMember(chamaId, memberId),
            loanRepository.findByChamaAndMember(chamaId, memberId)));
    }

    /**
     * Every active member's score in one pass.
     *
     * <p>The loans table renders a score beside each row and was fetching them one member at a
     * time, so a chama of thirty members cost thirty requests running five queries each. This
     * reads each table once for the whole chama and groups in memory, which is five queries in
     * total. The scoring itself is deliberately left in Java rather than pushed into aggregate
     * SQL: the decay, smoothing and lateness slope are the part most likely to be revised, and
     * they are far easier to reason about and test in one readable place than spread across five
     * hand-written queries.
     */
    public List<CreditScoreDto> calculateAll(Long chamaId) {
        Map<Long, List<Contribution>> contributions = byMember(
            contributionRepository.findByChama(chamaId), c -> c.member.id);
        Map<Long, List<MeetingAttendance>> attendance = byMember(
            meetingAttendanceRepository.findByChama(chamaId), a -> a.member.id);
        Map<Long, List<LoanRepayment>> repayments = byMember(
            loanRepaymentRepository.findByChama(chamaId), r -> r.loan.member.id);
        Map<Long, List<Penalty>> penalties = byMember(
            penaltyRepository.findByChama(chamaId), p -> p.member.id);
        Map<Long, List<Loan>> loans = byMember(
            loanRepository.findByChama(chamaId), l -> l.member.id);

        return memberRepository.findByChama(chamaId).stream()
            .filter(m -> m.status != MemberStatus.EXITED)
            .map(m -> score(m.id, new Evidence(
                contributions.getOrDefault(m.id, List.of()),
                attendance.getOrDefault(m.id, List.of()),
                repayments.getOrDefault(m.id, List.of()),
                penalties.getOrDefault(m.id, List.of()),
                loans.getOrDefault(m.id, List.of()))))
            .toList();
    }

    private static <T> Map<Long, List<T>> byMember(List<T> rows, Function<T, Long> memberId) {
        return rows.stream().collect(Collectors.groupingBy(memberId));
    }

    /** Everything known about one member, already narrowed to their own rows. */
    private record Evidence(
        List<Contribution> contributions,
        List<MeetingAttendance> attendance,
        List<LoanRepayment> repayments,
        List<Penalty> penalties,
        List<Loan> loans) {
    }

    /**
     * One scored component. {@code observations} is recency weighted, so it is a measure of how
     * much the evidence is worth rather than how many rows there were.
     */
    private record Component(String code, String label, double rate, double weight, double observations, int rows) {
        /**
         * Rows alone are not evidence: a set of contributions that are all zero-amount, or
         * settled installments that all predate the paid_at column, leave nothing to measure.
         * Such a component must drop out rather than contribute a NaN to the weighted sum.
         */
        boolean hasEvidence() {
            return rows > 0 && observations > 0 && !Double.isNaN(rate);
        }
    }

    private CreditScoreDto score(Long memberId, Evidence evidence) {
        LocalDate today = LocalDate.now(ChamaTime.ZONE);

        // An obligation that has not fallen due yet is not a missed one. Nothing that is still in
        // the future counts either way.
        List<Contribution> dueContributions = evidence.contributions().stream()
            .filter(c -> !c.period.isAfter(today)).toList();
        List<LoanRepayment> dueRepayments = evidence.repayments().stream()
            .filter(r -> !r.scheduledDate.isAfter(today)).toList();
        // EXCUSED is neither credit nor blame, so it is removed from the denominator rather than
        // counted as an absence.
        List<MeetingAttendance> countedAttendance = evidence.attendance().stream()
            .filter(a -> a.status != AttendanceStatus.EXCUSED).toList();

        Component consistency = amountRate(CONTRIBUTION_CONSISTENCY, "Contribution consistency",
            CONTRIBUTION_CONSISTENCY_WEIGHT, dueContributions,
            c -> c.period, c -> c.amountDue, c -> c.amountPaid, today);

        Component repayment = amountRate(LOAN_REPAYMENT, "Loan repayment",
            LOAN_REPAYMENT_WEIGHT, dueRepayments,
            r -> r.scheduledDate, r -> r.amountDue, r -> r.amountPaid, today);

        Component timeliness = timeliness(dueContributions, dueRepayments, today);
        Component attendanceComponent = attendance(countedAttendance, today);
        int penaltyDeduction = penaltyDeduction(evidence.penalties(), today);

        List<Component> components = List.of(consistency, timeliness, repayment, attendanceComponent);
        List<Component> evidenced = components.stream().filter(Component::hasEvidence).toList();

        BigDecimal totalSavings = sum(evidence.contributions(), c -> c.amountPaid);
        BigDecimal outstandingDebt = outstandingDebt(evidence);
        boolean defaulted = evidence.loans().stream().anyMatch(l -> l.status == LoanStatus.DEFAULTED);

        if (evidenced.isEmpty()) {
            return new CreditScoreDto(memberId, null, CreditScoreBand.INSUFFICIENT_HISTORY, 0.0,
                null, null, null, null, penaltyDeduction,
                outstandingDebt, totalSavings, defaulted,
                0, 0, 0, List.of(), List.of());
        }

        // Redistributing over only the evidenced components is what stops an unused feature of the
        // app from quietly inflating everyone's score.
        double totalWeight = evidenced.stream().mapToDouble(Component::weight).sum();
        double weighted = evidenced.stream()
            .mapToDouble(c -> c.rate() * c.weight() / totalWeight)
            .sum();
        int raw = Math.max(0, (int) Math.round(weighted * 100) - penaltyDeduction);
        int score = defaulted ? Math.min(raw, DEFAULT_CAP) : raw;

        double observations = evidenced.stream().mapToDouble(Component::observations).sum();
        double confidence = Math.min(1.0, observations / FULL_CONFIDENCE_OBSERVATIONS);

        return new CreditScoreDto(
            memberId,
            score,
            band(score),
            round(confidence),
            rateOf(consistency),
            rateOf(timeliness),
            rateOf(repayment),
            rateOf(attendanceComponent),
            penaltyDeduction,
            outstandingDebt,
            totalSavings,
            defaulted,
            dueContributions.size(),
            countedAttendance.size(),
            dueRepayments.size(),
            factors(evidenced, totalWeight, r -> r >= STRENGTH_FROM, Comparator.reverseOrder()),
            factors(evidenced, totalWeight, r -> r < WEAKNESS_BELOW, Comparator.naturalOrder()));
    }

    /**
     * How much of what was owed actually arrived, weighted so recent obligations matter more.
     * Overpayment on one obligation cannot compensate for another, so each is capped at its own
     * amount due.
     */
    private <T> Component amountRate(String code, String label, double weight, List<T> rows,
                                     Function<T, LocalDate> due, Function<T, BigDecimal> amountDue,
                                     Function<T, BigDecimal> amountPaid, LocalDate today) {
        double owed = 0;
        double paid = 0;
        double observations = 0;
        for (T row : rows) {
            double w = recencyWeight(due.apply(row), today);
            BigDecimal amount = amountDue.apply(row);
            if (amount == null || amount.signum() <= 0) {
                continue;
            }
            double capped = Math.min(amountPaid.apply(row).doubleValue(), amount.doubleValue());
            owed += w * amount.doubleValue();
            paid += w * capped;
            observations += w;
        }
        double rate = owed <= 0 ? Double.NaN : paid / owed;
        return new Component(code, label, smooth(rate, observations), weight, observations, rows.size());
    }

    /**
     * Of the obligations that were actually settled, how promptly. Unpaid ones are left out
     * entirely: they are already fully counted against the consistency and repayment components,
     * and charging them a second time here would punish the same failure twice.
     *
     * <p>Repayments settled before the paid_at column existed have no date and are skipped, which
     * is why an old chama may show fewer timeliness observations than settled installments.
     */
    private Component timeliness(List<Contribution> contributions, List<LoanRepayment> repayments,
                                 LocalDate today) {
        double credit = 0;
        double observations = 0;
        int rows = 0;

        for (Contribution c : contributions) {
            if (c.paidAt == null) {
                continue;
            }
            double w = recencyWeight(c.period, today);
            credit += w * promptness(c.period, c.paidAt);
            observations += w;
            rows++;
        }
        for (LoanRepayment r : repayments) {
            if (r.paidAt == null) {
                continue;
            }
            double w = recencyWeight(r.scheduledDate, today);
            credit += w * promptness(r.scheduledDate, r.paidAt);
            observations += w;
            rows++;
        }

        double rate = observations <= 0 ? Double.NaN : credit / observations;
        return new Component(CONTRIBUTION_TIMELINESS, "Payment timeliness",
            smooth(rate, observations), CONTRIBUTION_TIMELINESS_WEIGHT, observations, rows);
    }

    /** Full credit on or before the due date, sliding to none {@link #LATENESS_GRACE_DAYS} later. */
    private static double promptness(LocalDate due, Instant settled) {
        long daysLate = ChronoUnit.DAYS.between(due, LocalDate.ofInstant(settled, ChamaTime.ZONE));
        if (daysLate <= 0) {
            return 1.0;
        }
        return Math.max(0.0, 1.0 - daysLate / LATENESS_GRACE_DAYS);
    }

    private Component attendance(List<MeetingAttendance> counted, LocalDate today) {
        double present = 0;
        double observations = 0;
        for (MeetingAttendance a : counted) {
            double w = recencyWeight(a.meeting.meetingDate, today);
            if (a.status == AttendanceStatus.PRESENT) {
                present += w;
            }
            observations += w;
        }
        double rate = observations <= 0 ? Double.NaN : present / observations;
        return new Component(MEETING_ATTENDANCE, "Meeting attendance",
            smooth(rate, observations), MEETING_ATTENDANCE_WEIGHT, observations, counted.size());
    }

    /**
     * Points off for penalties that stood, decaying with age like every other signal.
     *
     * <p>WAIVED penalties are excluded because a waiver is the chama deciding the penalty should
     * not have counted, and PENDING ones because nobody has decided yet. Holding either against
     * the member would pre-empt the chama's own judgement, and a PAID penalty still counts: it was
     * upheld, and settling it afterwards does not undo that.
     */
    private int penaltyDeduction(List<Penalty> penalties, LocalDate today) {
        double upheld = 0;
        for (Penalty p : penalties) {
            if (p.status != PenaltyStatus.APPROVED && p.status != PenaltyStatus.PAID) {
                continue;
            }
            upheld += recencyWeight(LocalDate.ofInstant(p.imposedAt, ChamaTime.ZONE), today);
        }
        return (int) Math.min(MAX_PENALTY_DEDUCTION, Math.round(upheld * POINTS_PER_UPHELD_PENALTY));
    }

    /** Unsettled balance across loans that are live or written off, ignoring cleared ones. */
    private BigDecimal outstandingDebt(Evidence evidence) {
        var owing = evidence.loans().stream()
            .filter(l -> l.status == LoanStatus.DISBURSED
                || l.status == LoanStatus.REPAYING
                || l.status == LoanStatus.DEFAULTED)
            .map(l -> l.id)
            .collect(Collectors.toSet());
        return evidence.repayments().stream()
            .filter(r -> owing.contains(r.loan.id))
            .map(r -> r.amountDue.subtract(r.amountPaid).max(BigDecimal.ZERO))
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .setScale(2, RoundingMode.HALF_UP);
    }

    private static <T> BigDecimal sum(List<T> rows, Function<T, BigDecimal> amount) {
        return rows.stream().map(amount).reduce(BigDecimal.ZERO, BigDecimal::add)
            .setScale(2, RoundingMode.HALF_UP);
    }

    /** Halves every {@link #HALF_LIFE_MONTHS}; anything dated in the future counts in full. */
    private static double recencyWeight(LocalDate when, LocalDate today) {
        double monthsAgo = Math.max(0, ChronoUnit.DAYS.between(when, today)) / DAYS_PER_MONTH;
        return Math.pow(0.5, monthsAgo / HALF_LIFE_MONTHS);
    }

    /**
     * Pulls a rate toward the neutral prior in proportion to how little evidence supports it, so a
     * perfect or catastrophic score has to be earned over several observations rather than one.
     */
    private static double smooth(double rate, double observations) {
        if (Double.isNaN(rate) || observations <= 0) {
            return Double.NaN;
        }
        return (rate * observations + PRIOR_RATE * PRIOR_STRENGTH) / (observations + PRIOR_STRENGTH);
    }

    private static CreditScoreBand band(int score) {
        if (score >= EXCELLENT_FROM) {
            return CreditScoreBand.EXCELLENT;
        }
        if (score >= GOOD_FROM) {
            return CreditScoreBand.GOOD;
        }
        if (score >= FAIR_FROM) {
            return CreditScoreBand.FAIR;
        }
        return CreditScoreBand.POOR;
    }

    private static List<CreditScoreFactorDto> factors(List<Component> evidenced, double totalWeight,
                                                      DoublePredicate matches,
                                                      Comparator<Double> order) {
        List<CreditScoreFactorDto> selected = new ArrayList<>();
        evidenced.stream()
            .filter(c -> matches.test(c.rate()))
            .sorted((a, b) -> order.compare(a.rate(), b.rate()))
            .limit(MAX_FACTORS)
            .forEach(c -> selected.add(new CreditScoreFactorDto(
                c.code(), c.label(), round(c.rate()), round(c.weight() / totalWeight), c.rows())));
        return List.copyOf(selected);
    }

    /**
     * A component's rate, or null where there was nothing to measure. Null rather than zero: a
     * chama that has never recorded a meeting has not established that its members do not attend.
     */
    private static Double rateOf(Component component) {
        return component.hasEvidence() ? round(component.rate()) : null;
    }

    /** Rates are presentation values, not money; two decimals is all a caller can use. */
    private static double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
