package org.chama.service;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.chama.domain.enums.ChamaStatus;
import org.chama.domain.enums.ChamaType;
import org.chama.domain.enums.ContributionFrequency;
import org.chama.domain.enums.ContributionStatus;
import org.chama.domain.enums.MemberStatus;
import org.chama.domain.model.ActivityLog;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;

@QuarkusTest
class ContributionAutoPushServiceTest {

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
    ContributionAutoPushService contributionAutoPushService;

    @InjectMock
    MpesaService mpesaService;

    private Long chamaId;

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
            memberRoleRepository.deleteAll();
            memberRepository.deleteAll();
            activityLogRepository.deleteAll();
            chamaRepository.deleteAll();

            Chama chama = new Chama();
            chama.name = "Auto Push Test Chama";
            chama.type = ChamaType.MERRY_GO_ROUND;
            chama.currency = "KES";
            chama.contributionFrequency = ContributionFrequency.MONTHLY;
            chama.contributionAmount = new BigDecimal("500");
            chama.status = ChamaStatus.ACTIVE;
            chamaRepository.persist(chama);
            chamaId = chama.id;
        });
    }

    private Long persistMember(String keycloakUserId, String phone, boolean autoPayEnabled) {
        return QuarkusTransaction.requiringNew().call(() -> {
            Member member = new Member();
            member.chama = chamaRepository.findById(chamaId);
            member.keycloakUserId = keycloakUserId;
            member.fullName = "Auto Push " + keycloakUserId;
            member.phone = phone;
            member.status = MemberStatus.ACTIVE;
            member.autoPayEnabled = autoPayEnabled;
            memberRepository.persist(member);
            return member.id;
        });
    }

    private Long persistContribution(Long memberId, LocalDate period, ContributionStatus status, Instant lastAutoPushAt) {
        return QuarkusTransaction.requiringNew().call(() -> {
            Contribution contribution = new Contribution();
            contribution.chama = chamaRepository.findById(chamaId);
            contribution.member = memberRepository.findById(memberId);
            contribution.period = period;
            contribution.amountDue = new BigDecimal("500");
            contribution.status = status;
            contribution.lastAutoPushAt = lastAutoPushAt;
            contributionRepository.persist(contribution);
            return contribution.id;
        });
    }

    @Test
    void firesAnStkPushForAnOptedInMemberWithADueUnpaidContribution() {
        Long memberId = persistMember("auto-1", "254700000101", true);
        Long contributionId = persistContribution(memberId, LocalDate.now(), ContributionStatus.PENDING, null);
        Mockito.when(mpesaService.stkPush(eq("254700000101"), any(BigDecimal.class), anyString())).thenReturn("ws_CO_AUTO_1");

        contributionAutoPushService.fireDueAutoPushes();

        Contribution contribution = contributionRepository.findById(contributionId);
        assertNotNull(contribution.lastAutoPushAt);
        Mockito.verify(mpesaService).stkPush(eq("254700000101"), any(BigDecimal.class), anyString());
    }

    @Test
    void skipsAMemberWhoHasNotOptedIn() {
        Long memberId = persistMember("auto-2", "254700000102", false);
        persistContribution(memberId, LocalDate.now(), ContributionStatus.PENDING, null);

        contributionAutoPushService.fireDueAutoPushes();

        Mockito.verify(mpesaService, Mockito.never()).stkPush(anyString(), any(BigDecimal.class), anyString());
    }

    @Test
    void skipsAContributionNotYetDue() {
        Long memberId = persistMember("auto-3", "254700000103", true);
        persistContribution(memberId, LocalDate.now().plusDays(5), ContributionStatus.PENDING, null);

        contributionAutoPushService.fireDueAutoPushes();

        Mockito.verify(mpesaService, Mockito.never()).stkPush(anyString(), any(BigDecimal.class), anyString());
    }

    @Test
    void doesNotDoubleFireForAContributionAlreadyPushedToday() {
        Long memberId = persistMember("auto-4", "254700000104", true);
        persistContribution(memberId, LocalDate.now(), ContributionStatus.PENDING, Instant.now().minus(1, ChronoUnit.HOURS));

        contributionAutoPushService.fireDueAutoPushes();

        Mockito.verify(mpesaService, Mockito.never()).stkPush(anyString(), any(BigDecimal.class), anyString());
    }

    @Test
    void retriesAContributionLastPushedBeforeToday() {
        Long memberId = persistMember("auto-5", "254700000105", true);
        Long contributionId = persistContribution(memberId, LocalDate.now(), ContributionStatus.PENDING,
            Instant.now().minus(2, ChronoUnit.DAYS));
        Mockito.when(mpesaService.stkPush(eq("254700000105"), any(BigDecimal.class), anyString())).thenReturn("ws_CO_AUTO_5");

        contributionAutoPushService.fireDueAutoPushes();

        Contribution contribution = contributionRepository.findById(contributionId);
        assertNotNull(contribution.lastAutoPushAt);
        Mockito.verify(mpesaService).stkPush(eq("254700000105"), any(BigDecimal.class), anyString());
    }

    @Test
    void skipsAContributionThatIsAlreadyPaid() {
        Long memberId = persistMember("auto-6", "254700000106", true);
        persistContribution(memberId, LocalDate.now(), ContributionStatus.PAID, null);

        contributionAutoPushService.fireDueAutoPushes();

        Mockito.verify(mpesaService, Mockito.never()).stkPush(anyString(), any(BigDecimal.class), anyString());
    }

    @Test
    void logsAnActivityEntryOnASuccessfulAutoPush() {
        Long memberId = persistMember("auto-7", "254700000107", true);
        persistContribution(memberId, LocalDate.now(), ContributionStatus.OVERDUE, null);
        Mockito.when(mpesaService.stkPush(eq("254700000107"), any(BigDecimal.class), anyString())).thenReturn("ws_CO_AUTO_7");

        contributionAutoPushService.fireDueAutoPushes();

        java.util.List<ActivityLog> logs = activityLogRepository.findRecentForChama(chamaId, 0, 10);
        assertEquals(1, logs.size());
        assertEquals(org.chama.domain.enums.ActivityEventType.AUTO_STK_PUSH_SENT, logs.get(0).eventType);
    }

    @Test
    void aFailedStkPushDoesNotMarkTheContributionAsPushed() {
        Long memberId = persistMember("auto-8", "254700000108", true);
        Long contributionId = persistContribution(memberId, LocalDate.now(), ContributionStatus.PENDING, null);
        Mockito.when(mpesaService.stkPush(eq("254700000108"), any(BigDecimal.class), anyString()))
            .thenThrow(new RuntimeException("M-Pesa STK push failed: timeout"));

        contributionAutoPushService.fireDueAutoPushes();

        Contribution contribution = contributionRepository.findById(contributionId);
        assertNull(contribution.lastAutoPushAt);
    }
}
