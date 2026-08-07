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
import org.chama.repository.MeetingAttendanceRepository;
import org.chama.repository.MeetingRepository;
import org.chama.repository.MemberRepository;
import org.chama.repository.MemberRoleRepository;
import org.chama.repository.PaymentRepository;
import org.chama.repository.PayoutRepository;
import org.chama.repository.PayoutScheduleRepository;
import org.chama.repository.PenaltyRepository;
import org.chama.repository.WelfareContributionRepository;
import org.chama.repository.WelfareFundRepository;
import org.chama.repository.WelfareWithdrawalRepository;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

@QuarkusTest
class ChamaStatusServiceTest {

    @Inject
    ChamaRepository chamaRepository;

    @Inject
    ContributionRepository contributionRepository;

    @Inject
    ActivityLogRepository activityLogRepository;

    @Inject
    ApprovalRepository approvalRepository;

    @Inject
    MemberRepository memberRepository;

    @Inject
    MemberRoleRepository memberRoleRepository;

    @Inject
    DocumentDeliveryAttemptRepository documentDeliveryAttemptRepository;

    @Inject
    GeneratedDocumentRepository generatedDocumentRepository;

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
    PaymentRepository paymentRepository;

    @Inject
    WelfareWithdrawalRepository welfareWithdrawalRepository;

    @Inject
    WelfareContributionRepository welfareContributionRepository;

    @Inject
    WelfareFundRepository welfareFundRepository;

    @Inject
    ChamaStatusService chamaStatusService;

    @BeforeEach
    void cleanup() {
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
        });
    }

    @Test
    void marksAnOldActiveChamaWithNoRecentContributionAsInactive() {
        Long chamaId = QuarkusTransaction.requiringNew().call(() -> {
            Chama chama = newChama(ChamaStatus.ACTIVE);
            chamaRepository.persist(chama);
            return chama.id;
        });
        backdate(chamaId, Instant.now().minus(400, ChronoUnit.DAYS));

        chamaStatusService.sweep();

        Chama reloaded = QuarkusTransaction.requiringNew().call(() -> chamaRepository.findById(chamaId));
        assertEquals(ChamaStatus.INACTIVE, reloaded.status);
    }

    @Test
    void leavesABrandNewActiveChamaAlone() {
        Long chamaId = QuarkusTransaction.requiringNew().call(() -> {
            Chama chama = newChama(ChamaStatus.ACTIVE);
            chamaRepository.persist(chama);
            return chama.id;
        });

        chamaStatusService.sweep();

        Chama reloaded = QuarkusTransaction.requiringNew().call(() -> chamaRepository.findById(chamaId));
        assertEquals(ChamaStatus.ACTIVE, reloaded.status);
    }

    @Test
    void leavesAnActiveChamaWithARecentPaidContributionAlone() {
        Long chamaId = QuarkusTransaction.requiringNew().call(() -> {
            Chama chama = newChama(ChamaStatus.ACTIVE);
            chamaRepository.persist(chama);
            Member member = newMember(chama);
            memberRepository.persist(member);

            Contribution contribution = new Contribution();
            contribution.chama = chama;
            contribution.member = member;
            contribution.period = LocalDate.now();
            contribution.amountDue = new BigDecimal("500");
            contribution.amountPaid = new BigDecimal("500");
            contribution.status = ContributionStatus.PAID;
            contribution.paidAt = Instant.now().minus(1, ChronoUnit.DAYS);
            contributionRepository.persist(contribution);

            return chama.id;
        });
        backdate(chamaId, Instant.now().minus(400, ChronoUnit.DAYS));

        chamaStatusService.sweep();

        Chama reloaded = QuarkusTransaction.requiringNew().call(() -> chamaRepository.findById(chamaId));
        assertEquals(ChamaStatus.ACTIVE, reloaded.status);
    }

    @Test
    void reactivatesAnInactiveChamaOnceAContributionIsPaid() {
        Long chamaId = QuarkusTransaction.requiringNew().call(() -> {
            Chama chama = newChama(ChamaStatus.INACTIVE);
            chamaRepository.persist(chama);
            Member member = newMember(chama);
            memberRepository.persist(member);

            Contribution contribution = new Contribution();
            contribution.chama = chama;
            contribution.member = member;
            contribution.period = LocalDate.now();
            contribution.amountDue = new BigDecimal("500");
            contribution.amountPaid = new BigDecimal("500");
            contribution.status = ContributionStatus.PAID;
            contribution.paidAt = Instant.now().minus(1, ChronoUnit.DAYS);
            contributionRepository.persist(contribution);

            return chama.id;
        });
        backdate(chamaId, Instant.now().minus(400, ChronoUnit.DAYS));

        chamaStatusService.sweep();

        Chama reloaded = QuarkusTransaction.requiringNew().call(() -> chamaRepository.findById(chamaId));
        assertEquals(ChamaStatus.ACTIVE, reloaded.status);
    }

    private Chama newChama(ChamaStatus status) {
        Chama chama = new Chama();
        chama.name = "Status Sweep Test Chama " + status + "-" + System.nanoTime();
        chama.type = ChamaType.MERRY_GO_ROUND;
        chama.currency = "KES";
        chama.contributionFrequency = ContributionFrequency.MONTHLY;
        chama.contributionAmount = new BigDecimal("500");
        chama.status = status;
        return chama;
    }

    private Member newMember(Chama chama) {
        Member member = new Member();
        member.chama = chama;
        member.keycloakUserId = "status-sweep-member-" + System.nanoTime();
        member.fullName = "Status Sweep Member";
        member.phone = "254700000000";
        member.status = MemberStatus.ACTIVE;
        return member;
    }

    // Chama.createdAt is Hibernate-managed (@CreationTimestamp, always set to "now" on insert),
    // so backdating it for a test has to happen as a bulk update after the initial persist.
    private void backdate(Long chamaId, Instant createdAt) {
        QuarkusTransaction.requiringNew().run(() -> chamaRepository.getEntityManager()
            .createQuery("update Chama c set c.createdAt = :createdAt where c.id = :id")
            .setParameter("createdAt", createdAt)
            .setParameter("id", chamaId)
            .executeUpdate());
    }
}
