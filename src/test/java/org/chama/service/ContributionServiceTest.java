package org.chama.service;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.chama.domain.enums.ChamaStatus;
import org.chama.domain.enums.ChamaType;
import org.chama.domain.enums.ContributionFrequency;
import org.chama.domain.enums.ContributionStatus;
import org.chama.domain.enums.MemberStatus;
import org.chama.domain.model.Chama;
import org.chama.domain.model.Contribution;
import org.chama.domain.model.Member;
import org.chama.repository.ActivityLogRepository;
import org.chama.repository.ApprovalRepository;
import org.chama.repository.ChamaRepository;
import org.chama.repository.ContributionRepository;
import org.chama.repository.DocumentDeliveryAttemptRepository;
import org.chama.repository.GeneratedDocumentRepository;
import org.chama.repository.LoanDisbursementRepository;
import org.chama.repository.LoanRepaymentRepository;
import org.chama.repository.LoanRepository;
import org.chama.repository.MemberRepository;
import org.chama.repository.MemberRoleRepository;
import org.chama.repository.MeetingAttendanceRepository;
import org.chama.repository.MeetingRepository;
import org.chama.repository.PaymentRepository;
import org.chama.repository.PayoutRepository;
import org.chama.repository.PayoutScheduleRepository;
import org.chama.repository.PenaltyRepository;
import org.chama.repository.WelfareContributionRepository;
import org.chama.repository.WelfareFundRepository;
import org.chama.repository.WelfareWithdrawalRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertEquals;

@QuarkusTest
class ContributionServiceTest {

    @Inject
    ContributionService contributionService;

    @Inject
    ActivityLogRepository activityLogRepository;

    @Inject
    ApprovalRepository approvalRepository;

    @Inject
    ChamaRepository chamaRepository;

    @Inject
    MemberRepository memberRepository;

    @Inject
    MemberRoleRepository memberRoleRepository;

    @Inject
    ContributionRepository contributionRepository;

    @Inject
    PaymentRepository paymentRepository;

    @Inject
    GeneratedDocumentRepository generatedDocumentRepository;

    @Inject
    DocumentDeliveryAttemptRepository documentDeliveryAttemptRepository;

    @Inject
    LoanDisbursementRepository loanDisbursementRepository;

    @Inject
    LoanRepository loanRepository;

    @Inject
    LoanRepaymentRepository loanRepaymentRepository;

    @Inject
    PayoutRepository payoutRepository;

    @Inject
    PayoutScheduleRepository payoutScheduleRepository;

    @Inject
    PenaltyRepository penaltyRepository;

    @Inject
    MeetingAttendanceRepository meetingAttendanceRepository;

    @Inject
    MeetingRepository meetingRepository;

    @Inject
    WelfareWithdrawalRepository welfareWithdrawalRepository;

    @Inject
    WelfareContributionRepository welfareContributionRepository;

    @Inject
    WelfareFundRepository welfareFundRepository;

    private Long chamaId;
    private Long memberId;

    @BeforeEach
    void seed() {
        QuarkusTransaction.requiringNew().run(() -> {
            documentDeliveryAttemptRepository.deleteAll();
            generatedDocumentRepository.deleteAll();
            meetingAttendanceRepository.deleteAll();
            meetingRepository.deleteAll();
            penaltyRepository.deleteAll();
            payoutRepository.deleteAll();
            payoutScheduleRepository.deleteAll();
            loanRepaymentRepository.deleteAll();
            loanDisbursementRepository.deleteAll();
            loanRepository.deleteAll();
            paymentRepository.deleteAll();
            contributionRepository.deleteAll();
            approvalRepository.deleteAll();
            welfareWithdrawalRepository.deleteAll();
            welfareContributionRepository.deleteAll();
            welfareFundRepository.deleteAll();
            memberRoleRepository.deleteAll();
            memberRepository.deleteAll();
            activityLogRepository.deleteAll();
            chamaRepository.deleteAll();

            Chama chama = new Chama();
            chama.name = "Streak Test Chama";
            chama.type = ChamaType.MERRY_GO_ROUND;
            chama.currency = "KES";
            chama.contributionFrequency = ContributionFrequency.MONTHLY;
            chama.contributionAmount = new BigDecimal("500");
            chama.status = ChamaStatus.ACTIVE;
            chamaRepository.persist(chama);
            chamaId = chama.id;

            Member member = new Member();
            member.chama = chama;
            member.keycloakUserId = "streak-member-1";
            member.fullName = "Streak Member";
            member.phone = "254700000401";
            member.status = MemberStatus.ACTIVE;
            memberRepository.persist(member);
            memberId = member.id;
        });
    }

    private void seedContribution(LocalDate period, ContributionStatus status, Instant paidAt) {
        QuarkusTransaction.requiringNew().run(() -> {
            Contribution contribution = new Contribution();
            contribution.chama = chamaRepository.findById(chamaId);
            contribution.member = memberRepository.findById(memberId);
            contribution.period = period;
            contribution.amountDue = new BigDecimal("500");
            contribution.status = status;
            if (status == ContributionStatus.PAID) {
                contribution.amountPaid = new BigDecimal("500");
            }
            contribution.paidAt = paidAt;
            contributionRepository.persist(contribution);
        });
    }

    @Test
    void streakIsZeroWithNoContributionHistory() {
        assertEquals(0, contributionService.currentStreak(chamaId, memberId));
    }

    @Test
    void countsConsecutiveOnTimePaymentsMostRecentFirst() {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        seedContribution(today.minusMonths(2), ContributionStatus.PAID, today.minusMonths(2).atStartOfDay(ZoneOffset.UTC).toInstant());
        seedContribution(today.minusMonths(1), ContributionStatus.PAID, today.minusMonths(1).atStartOfDay(ZoneOffset.UTC).toInstant());
        seedContribution(today, ContributionStatus.PAID, today.atStartOfDay(ZoneOffset.UTC).toInstant());

        assertEquals(3, contributionService.currentStreak(chamaId, memberId));
    }

    @Test
    void aLatePaymentEndsTheStreakAtThatPeriod() {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        // Paid two days after the due date: breaks the streak.
        seedContribution(today.minusMonths(2), ContributionStatus.PAID,
            today.minusMonths(2).plusDays(2).atStartOfDay(ZoneOffset.UTC).toInstant());
        seedContribution(today.minusMonths(1), ContributionStatus.PAID, today.minusMonths(1).atStartOfDay(ZoneOffset.UTC).toInstant());
        seedContribution(today, ContributionStatus.PAID, today.atStartOfDay(ZoneOffset.UTC).toInstant());

        // Only the two most recent (on-time) periods count, the streak stops at the late one.
        assertEquals(2, contributionService.currentStreak(chamaId, memberId));
    }

    @Test
    void anUnpaidOverdueContributionResetsTheStreakToZero() {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        seedContribution(today.minusMonths(1), ContributionStatus.PAID, today.minusMonths(1).atStartOfDay(ZoneOffset.UTC).toInstant());
        seedContribution(today, ContributionStatus.OVERDUE, null);

        assertEquals(0, contributionService.currentStreak(chamaId, memberId));
    }

    @Test
    void aPartiallyPaidContributionBreaksTheStreak() {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        seedContribution(today.minusMonths(1), ContributionStatus.PAID, today.minusMonths(1).atStartOfDay(ZoneOffset.UTC).toInstant());
        seedContribution(today, ContributionStatus.PARTIAL, null);

        assertEquals(0, contributionService.currentStreak(chamaId, memberId));
    }

    @Test
    void aNotYetDueFuturePeriodIsSkippedRatherThanBreakingTheStreak() {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        seedContribution(today.minusMonths(1), ContributionStatus.PAID, today.minusMonths(1).atStartOfDay(ZoneOffset.UTC).toInstant());
        // Future period, still PENDING because it is not due yet, must not count as a break.
        seedContribution(today.plusMonths(1), ContributionStatus.PENDING, null);

        assertEquals(1, contributionService.currentStreak(chamaId, memberId));
    }

    @Test
    void aPendingContributionDueTodayBreaksTheStreak() {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        seedContribution(today.minusMonths(1), ContributionStatus.PAID, today.minusMonths(1).atStartOfDay(ZoneOffset.UTC).toInstant());
        seedContribution(today, ContributionStatus.PENDING, null);

        assertEquals(0, contributionService.currentStreak(chamaId, memberId));
    }
}
