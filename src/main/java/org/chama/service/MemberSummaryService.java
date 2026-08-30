package org.chama.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.chama.domain.ChamaTime;
import org.chama.domain.enums.ContributionStatus;
import org.chama.domain.enums.LoanRepaymentStatus;
import org.chama.domain.enums.LoanStatus;
import org.chama.domain.enums.PayoutStatus;
import org.chama.domain.enums.PenaltyStatus;
import org.chama.domain.model.Contribution;
import org.chama.domain.model.LoanRepayment;
import org.chama.domain.model.Member;
import org.chama.domain.model.Payout;
import org.chama.dto.MemberSummaryDto;
import org.chama.repository.ContributionRepository;
import org.chama.repository.LoanRepaymentRepository;
import org.chama.repository.LoanRepository;
import org.chama.repository.PayoutRepository;
import org.chama.repository.PenaltyRepository;
import org.chama.repository.WelfareContributionRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Set;

/**
 * Everything a member needs to know about their own standing in one chama.
 *
 * <p>This exposes nothing that self-service endpoints did not already return. What it changes is
 * that a member no longer has to visit five pages and work out for themselves what they owe: the
 * arithmetic is done here, once, rather than differently on each page.
 *
 * <p>Scoped to one member throughout. Every repository call takes the member id, and the caller
 * resolves that from the session rather than the path, so there is no id here for anyone to
 * substitute.
 */
@ApplicationScoped
public class MemberSummaryService {

    private static final int MONEY_SCALE = 2;

    @Inject
    ContributionRepository contributionRepository;

    @Inject
    ContributionService contributionService;

    @Inject
    LoanRepository loanRepository;

    @Inject
    LoanRepaymentRepository loanRepaymentRepository;

    @Inject
    PenaltyRepository penaltyRepository;

    @Inject
    PayoutRepository payoutRepository;

    @Inject
    WelfareContributionRepository welfareContributionRepository;

    @Inject
    CreditScoreService creditScoreService;

    public MemberSummaryDto summarise(Long chamaId, Member member) {
        LocalDate today = LocalDate.now(ChamaTime.ZONE);
        List<Contribution> contributions = contributionRepository.findByChamaAndMember(chamaId, member.id);

        BigDecimal contributedTotal = sum(contributions.stream().map(c -> c.amountPaid).toList());
        BigDecimal contributionsOutstanding = sum(contributions.stream()
            .filter(c -> !c.period.isAfter(today))
            .map(c -> c.amountDue.subtract(c.amountPaid).max(BigDecimal.ZERO))
            .toList());
        int overdueCount = (int) contributions.stream()
            .filter(c -> !c.period.isAfter(today) && c.status != ContributionStatus.PAID)
            .count();

        // The soonest obligation that has not been settled, whether it is already overdue or still
        // ahead. Showing only future ones would hide the thing most worth acting on.
        Contribution nextContribution = contributions.stream()
            .filter(c -> c.status != ContributionStatus.PAID)
            .min(Comparator.comparing(c -> c.period))
            .orElse(null);

        var loans = loanRepository.findByChamaAndMember(chamaId, member.id);
        Set<Long> liveLoanIds = loans.stream()
            .filter(l -> l.status == LoanStatus.DISBURSED
                || l.status == LoanStatus.REPAYING
                || l.status == LoanStatus.DEFAULTED)
            .map(l -> l.id)
            .collect(java.util.stream.Collectors.toSet());

        List<LoanRepayment> repayments = loanRepaymentRepository.findByChamaAndMember(chamaId, member.id).stream()
            .filter(r -> liveLoanIds.contains(r.loan.id))
            .toList();
        BigDecimal loanOutstanding = sum(repayments.stream()
            .map(r -> r.amountDue.subtract(r.amountPaid).max(BigDecimal.ZERO))
            .toList());
        LoanRepayment nextRepayment = repayments.stream()
            .filter(r -> r.status != LoanRepaymentStatus.PAID)
            .min(Comparator.comparing(r -> r.scheduledDate))
            .orElse(null);

        // APPROVED only: a PENDING penalty has not been decided, and a member should not be told
        // they owe money the chama has not yet agreed they owe.
        var outstandingPenalties = penaltyRepository.findByChamaAndMember(chamaId, member.id).stream()
            .filter(p -> p.status == PenaltyStatus.APPROVED)
            .toList();

        var payouts = payoutRepository.findByChamaAndMember(chamaId, member.id);
        int payoutsReceived = (int) payouts.stream().filter(p -> p.status == PayoutStatus.DISBURSED).count();
        Payout nextPayout = payouts.stream()
            .filter(p -> p.status == PayoutStatus.SCHEDULED)
            .min(Comparator.comparing(p -> p.scheduledDate))
            .orElse(null);

        BigDecimal welfareContributed = sum(
            welfareContributionRepository.findByChamaAndMember(chamaId, member.id).stream()
                .map(w -> w.amount)
                .toList());

        var creditScore = creditScoreService.calculate(chamaId, member.id);

        return new MemberSummaryDto(
            member.id,
            member.fullName,
            member.chama.currency,
            contributedTotal,
            contributionsOutstanding,
            overdueCount,
            nextContribution == null ? null : nextContribution.period,
            nextContribution == null ? null
                : nextContribution.amountDue.subtract(nextContribution.amountPaid).max(BigDecimal.ZERO)
                    .setScale(MONEY_SCALE, RoundingMode.HALF_UP),
            contributionService.currentStreak(chamaId, member.id),
            liveLoanIds.size(),
            loanOutstanding,
            nextRepayment == null ? null : nextRepayment.scheduledDate,
            nextRepayment == null ? null
                : nextRepayment.amountDue.subtract(nextRepayment.amountPaid).max(BigDecimal.ZERO)
                    .setScale(MONEY_SCALE, RoundingMode.HALF_UP),
            outstandingPenalties.size(),
            sum(outstandingPenalties.stream().map(p -> p.amount).toList()),
            payoutsReceived,
            nextPayout == null ? null : nextPayout.roundNumber,
            nextPayout == null ? null : nextPayout.scheduledDate,
            welfareContributed,
            creditScore.score(),
            creditScore.band());
    }

    private static BigDecimal sum(List<BigDecimal> amounts) {
        return amounts.stream().reduce(BigDecimal.ZERO, BigDecimal::add)
            .setScale(MONEY_SCALE, RoundingMode.HALF_UP);
    }
}
