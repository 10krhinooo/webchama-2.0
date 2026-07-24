package org.chama.service;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.ws.rs.BadRequestException;
import org.chama.domain.enums.ChamaStatus;
import org.chama.domain.enums.ChamaType;
import org.chama.domain.enums.ContributionFrequency;
import org.chama.domain.enums.ContributionStatus;
import org.chama.domain.enums.InterestMethod;
import org.chama.domain.enums.LoanRepaymentStatus;
import org.chama.domain.enums.LoanStatus;
import org.chama.domain.enums.MemberStatus;
import org.chama.domain.enums.PayoutStatus;
import org.chama.domain.enums.PenaltyReason;
import org.chama.domain.enums.PenaltyStatus;
import org.chama.domain.model.Chama;
import org.chama.domain.model.Contribution;
import org.chama.domain.model.Loan;
import org.chama.domain.model.LoanRepayment;
import org.chama.domain.model.Member;
import org.chama.domain.model.Payout;
import org.chama.domain.model.Penalty;
import org.chama.dto.AgmStatementDto;
import org.chama.repository.ChamaRepository;
import org.chama.repository.ContributionRepository;
import org.chama.repository.LoanRepaymentRepository;
import org.chama.repository.LoanRepository;
import org.chama.repository.MemberRepository;
import org.chama.repository.PayoutRepository;
import org.chama.repository.PenaltyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Verifies the opening/closing balance derivation behind the one-click AGM/auditor statement
 * (issue #66): every contribution/loan/payout/penalty strictly before the period feeds the opening
 * balance, everything within the period feeds the period's own totals, and anything after the
 * period (or not yet approved/disbursed) is excluded from both.
 */
@QuarkusTest
class AgmStatementServiceTest {

    @Inject
    AgmStatementService agmStatementService;

    @Inject
    ChamaRepository chamaRepository;

    @Inject
    MemberRepository memberRepository;

    @Inject
    ContributionRepository contributionRepository;

    @Inject
    LoanRepository loanRepository;

    @Inject
    LoanRepaymentRepository loanRepaymentRepository;

    @Inject
    PayoutRepository payoutRepository;

    @Inject
    PenaltyRepository penaltyRepository;

    private Long chamaId;
    private Long memberId;

    private static final LocalDate PERIOD_START = LocalDate.of(2026, 1, 1);
    private static final LocalDate PERIOD_END = LocalDate.of(2026, 6, 30);

    @BeforeEach
    void seed() {
        QuarkusTransaction.requiringNew().run(() -> {
            penaltyRepository.deleteAll();
            payoutRepository.deleteAll();
            loanRepaymentRepository.deleteAll();
            loanRepository.deleteAll();
            contributionRepository.deleteAll();
            memberRepository.deleteAll();
            chamaRepository.deleteAll();

            Chama chama = new Chama();
            chama.name = "AGM Test Chama";
            chama.type = ChamaType.TABLE_BANKING;
            chama.currency = "KES";
            chama.contributionFrequency = ContributionFrequency.MONTHLY;
            chama.contributionAmount = new BigDecimal("500");
            chama.status = ChamaStatus.ACTIVE;
            chamaRepository.persist(chama);
            chamaId = chama.id;

            Member member = new Member();
            member.chama = chama;
            member.keycloakUserId = "agm-member-1";
            member.fullName = "Member One";
            member.phone = "254700000601";
            member.status = MemberStatus.ACTIVE;
            memberRepository.persist(member);
            memberId = member.id;

            // Before the period: feeds the opening balance.
            persistContribution(chama, member, LocalDate.of(2025, 12, 1), new BigDecimal("10000"));

            Loan beforeLoan = persistLoan(chama, member, new BigDecimal("5000"), instant(2025, 10, 1));
            persistRepayment(beforeLoan, LocalDate.of(2025, 11, 1), new BigDecimal("200"));
            persistPenalty(chama, member, new BigDecimal("100"), PenaltyStatus.APPROVED, instant(2025, 12, 15));
            persistPayout(chama, member, new BigDecimal("300"), PayoutStatus.DISBURSED, instant(2025, 12, 20), 1);

            // Within the period: feeds the period's own totals.
            persistContribution(chama, member, LocalDate.of(2026, 3, 1), new BigDecimal("500"));

            Loan withinLoan = persistLoan(chama, member, new BigDecimal("2000"), instant(2026, 1, 15));
            persistRepayment(withinLoan, LocalDate.of(2026, 2, 1), new BigDecimal("250"));
            persistPenalty(chama, member, new BigDecimal("50"), PenaltyStatus.APPROVED, instant(2026, 3, 1));
            persistPayout(chama, member, new BigDecimal("400"), PayoutStatus.DISBURSED, instant(2026, 4, 1), 2);

            // Excluded: after the period, or not yet approved/disbursed.
            persistContribution(chama, member, LocalDate.of(2026, 8, 1), new BigDecimal("9999"));
            persistPenalty(chama, member, new BigDecimal("777"), PenaltyStatus.PENDING, null);
            persistPayout(chama, member, new BigDecimal("888"), PayoutStatus.SCHEDULED, null, 3);
            persistLoan(chama, member, new BigDecimal("666"), null);
        });
    }

    private Instant instant(int year, int month, int day) {
        return LocalDate.of(year, month, day).atStartOfDay(ZoneOffset.UTC).toInstant();
    }

    private void persistContribution(Chama chama, Member member, LocalDate period, BigDecimal amountPaid) {
        Contribution contribution = new Contribution();
        contribution.chama = chama;
        contribution.member = member;
        contribution.period = period;
        contribution.amountDue = amountPaid;
        contribution.amountPaid = amountPaid;
        contribution.status = ContributionStatus.PAID;
        contributionRepository.persist(contribution);
    }

    private Loan persistLoan(Chama chama, Member member, BigDecimal principal, Instant disbursedAt) {
        Loan loan = new Loan();
        loan.chama = chama;
        loan.member = member;
        loan.principal = principal;
        loan.interestRate = new BigDecimal("0");
        loan.interestMethod = InterestMethod.FLAT;
        loan.termMonths = 6;
        loan.status = disbursedAt != null ? LoanStatus.DISBURSED : LoanStatus.REQUESTED;
        loan.disbursedAt = disbursedAt;
        loanRepository.persist(loan);
        return loan;
    }

    private void persistRepayment(Loan loan, LocalDate scheduledDate, BigDecimal amountPaid) {
        LoanRepayment repayment = new LoanRepayment();
        repayment.loan = loan;
        repayment.installmentNumber = 1;
        repayment.scheduledDate = scheduledDate;
        repayment.amountDue = amountPaid;
        repayment.amountPaid = amountPaid;
        repayment.status = LoanRepaymentStatus.PAID;
        loanRepaymentRepository.persist(repayment);
    }

    private void persistPenalty(Chama chama, Member member, BigDecimal amount, PenaltyStatus status, Instant decidedAt) {
        Penalty penalty = new Penalty();
        penalty.chama = chama;
        penalty.member = member;
        penalty.reason = PenaltyReason.LATE_CONTRIBUTION;
        penalty.amount = amount;
        penalty.status = status;
        penalty.decidedAt = decidedAt;
        penaltyRepository.persist(penalty);
    }

    private void persistPayout(Chama chama, Member member, BigDecimal amount, PayoutStatus status, Instant disbursedAt, int roundNumber) {
        Payout payout = new Payout();
        payout.chama = chama;
        payout.member = member;
        payout.roundNumber = roundNumber;
        payout.scheduledDate = LocalDate.of(2026, 1, 1);
        payout.amount = amount;
        payout.status = status;
        payout.disbursedAt = disbursedAt;
        payoutRepository.persist(payout);
    }

    @Test
    void aggregatesOpeningAndClosingBalanceAcrossThePeriodBoundary() {
        AgmStatementDto statement = agmStatementService.aggregate(chamaId, PERIOD_START, PERIOD_END);

        assertEquals(chamaId, statement.chamaId());
        assertEquals("AGM Test Chama", statement.chamaName());
        assertEquals("KES", statement.currency());
        assertEquals(PERIOD_START, statement.periodStart());
        assertEquals(PERIOD_END, statement.periodEnd());

        // opening = 10000 (contrib) + 200 (repay) + 100 (penalty) - 5000 (loan) - 300 (payout)
        assertEquals(0, new BigDecimal("5000").compareTo(statement.openingBalance()));

        assertEquals(0, new BigDecimal("500").compareTo(statement.totalContributionsReceived()));
        assertEquals(0, new BigDecimal("250").compareTo(statement.totalLoanRepaymentsReceived()));
        assertEquals(0, new BigDecimal("50").compareTo(statement.totalPenaltiesCollected()));
        assertEquals(0, new BigDecimal("2000").compareTo(statement.totalLoansDisbursed()));
        assertEquals(0, new BigDecimal("400").compareTo(statement.totalPayoutsDisbursed()));

        // closing = 5000 + (500 + 250 + 50) - (2000 + 400)
        assertEquals(0, new BigDecimal("3400").compareTo(statement.closingBalance()));
    }

    @Test
    void rejectsAPeriodEndBeforePeriodStart() {
        assertThrows(BadRequestException.class,
            () -> agmStatementService.aggregate(chamaId, PERIOD_END, PERIOD_START));
    }

    @Test
    void rejectsAMissingPeriodStartOrEnd() {
        assertThrows(BadRequestException.class, () -> agmStatementService.aggregate(chamaId, null, PERIOD_END));
        assertThrows(BadRequestException.class, () -> agmStatementService.aggregate(chamaId, PERIOD_START, null));
    }

    @Test
    void aZeroActivityChamaHasAZeroBalanceStatement() {
        Long emptyChamaId = QuarkusTransaction.requiringNew().call(() -> {
            Chama chama = new Chama();
            chama.name = "Empty Chama";
            chama.type = ChamaType.TABLE_BANKING;
            chama.currency = "KES";
            chama.contributionFrequency = ContributionFrequency.MONTHLY;
            chama.contributionAmount = new BigDecimal("500");
            chama.status = ChamaStatus.ACTIVE;
            chamaRepository.persist(chama);
            return chama.id;
        });

        AgmStatementDto statement = agmStatementService.aggregate(emptyChamaId, PERIOD_START, PERIOD_END);

        assertEquals(0, BigDecimal.ZERO.compareTo(statement.openingBalance()));
        assertEquals(0, BigDecimal.ZERO.compareTo(statement.closingBalance()));
    }
}
