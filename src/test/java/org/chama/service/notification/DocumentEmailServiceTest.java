package org.chama.service.notification;

import io.quarkus.mailer.Mail;
import io.quarkus.mailer.MockMailbox;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.chama.domain.enums.ChamaStatus;
import org.chama.domain.enums.ChamaType;
import org.chama.domain.enums.ContributionFrequency;
import org.chama.domain.enums.DeliveryStatus;
import org.chama.domain.enums.DocumentType;
import org.chama.domain.enums.MemberStatus;
import org.chama.domain.model.Chama;
import org.chama.domain.model.GeneratedDocument;
import org.chama.domain.model.Member;
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
import org.chama.repository.ActivityLogRepository;
import org.chama.repository.WelfareContributionRepository;
import org.chama.repository.WelfareFundRepository;
import org.chama.repository.WelfareWithdrawalRepository;
import org.chama.service.KeycloakAdminService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * Exercises the DocumentType-specific subject/label branches (loan statement, payout receipt)
 * and the Keycloak-lookup-throws failure path that DocumentResourceTest doesn't reach through
 * the contribution-receipt-only REST flow it covers. Mailer.send() itself is @Singleton scoped,
 * not a normal CDI scope, so it can't be substituted with @InjectMock, the send-failure path is
 * exercised indirectly by the memberHasNoEmail case in DocumentResourceTest instead.
 */
@QuarkusTest
class DocumentEmailServiceTest {

    @Inject
    ActivityLogRepository activityLogRepository;

    @Inject
    DocumentEmailService documentEmailService;

    @Inject
    ApprovalRepository approvalRepository;

    @Inject
    ChamaRepository chamaRepository;

    @Inject
    MemberRepository memberRepository;

    @Inject
    GeneratedDocumentRepository generatedDocumentRepository;

    @Inject
    DocumentDeliveryAttemptRepository documentDeliveryAttemptRepository;

    @Inject
    ContributionRepository contributionRepository;

    @Inject
    LoanRepository loanRepository;

    @Inject
    LoanRepaymentRepository loanRepaymentRepository;

    @Inject
    LoanDisbursementRepository loanDisbursementRepository;

    @Inject
    PayoutRepository payoutRepository;

    @Inject
    PayoutScheduleRepository payoutScheduleRepository;

    @Inject
    PenaltyRepository penaltyRepository;

    @Inject
    PaymentRepository paymentRepository;

    @Inject
    MeetingAttendanceRepository meetingAttendanceRepository;

    @Inject
    MeetingRepository meetingRepository;

    @Inject
    MemberRoleRepository memberRoleRepository;

    @Inject
    WelfareWithdrawalRepository welfareWithdrawalRepository;

    @Inject
    WelfareContributionRepository welfareContributionRepository;

    @Inject
    WelfareFundRepository welfareFundRepository;

    @InjectMock
    KeycloakAdminService keycloakAdminService;

    @Inject
    MockMailbox mailbox;

    private Long chamaId;
    private Long memberId;

    @BeforeEach
    void seed() throws Exception {
        mailbox.clear();
        Mockito.when(keycloakAdminService.getUserEmail(Mockito.anyString())).thenReturn("service-test@example.com");

        QuarkusTransaction.requiringNew().run(() -> {
            documentDeliveryAttemptRepository.deleteAll();
            generatedDocumentRepository.deleteAll();
            paymentRepository.deleteAll();
            meetingAttendanceRepository.deleteAll();
            meetingRepository.deleteAll();
            penaltyRepository.deleteAll();
            payoutRepository.deleteAll();
            payoutScheduleRepository.deleteAll();
            loanRepaymentRepository.deleteAll();
            loanDisbursementRepository.deleteAll();
            loanRepository.deleteAll();
            contributionRepository.deleteAll();
            approvalRepository.deleteAll();
            welfareWithdrawalRepository.deleteAll();
            welfareContributionRepository.deleteAll();
            welfareFundRepository.deleteAll();
            memberRoleRepository.deleteAll();
            memberRepository.deleteAll();
            activityLogRepository.deleteAll();
            chamaRepository.deleteAll();

            Chama c = new Chama();
            c.name = "Email Service Test Chama";
            c.type = ChamaType.TABLE_BANKING;
            c.currency = "KES";
            c.contributionFrequency = ContributionFrequency.MONTHLY;
            c.contributionAmount = new BigDecimal("500");
            c.status = ChamaStatus.ACTIVE;
            chamaRepository.persist(c);
            chamaId = c.id;

            Member m = new Member();
            m.chama = c;
            m.keycloakUserId = "email-service-member";
            m.fullName = "Service Test Member";
            m.phone = "254700000601";
            m.status = MemberStatus.ACTIVE;
            memberRepository.persist(m);
            memberId = m.id;
        });
    }

    private Long newDoc(DocumentType type, String documentNumber) {
        return QuarkusTransaction.requiringNew().call(() -> {
            GeneratedDocument doc = new GeneratedDocument();
            doc.chama = chamaRepository.findById(chamaId);
            doc.member = memberRepository.findById(memberId);
            doc.documentType = type;
            doc.documentNumber = documentNumber;
            doc.memberName = "Service Test Member";
            doc.lineItemsJson = "[]";
            doc.totalAmount = new BigDecimal("1000");
            doc.pdfBytes = new byte[]{1, 2, 3};
            generatedDocumentRepository.persist(doc);
            return doc.id;
        });
    }

    private DeliveryStatus sendAndGetStatus(Long docId) {
        return QuarkusTransaction.requiringNew().call(() ->
            documentEmailService.send(generatedDocumentRepository.findById(docId)).emailStatus);
    }

    @Test
    void sendsALoanStatementEmailWithTheRightSubject() {
        Long docId = newDoc(DocumentType.LOAN_STATEMENT, "LS-2026-07-0001");

        assertEquals(DeliveryStatus.SENT, sendAndGetStatus(docId));
        List<Mail> sent = mailbox.getMailsSentTo("service-test@example.com");
        assertEquals(1, sent.size());
        assertEquals("Your loan statement from Email Service Test Chama", sent.get(0).getSubject());
    }

    @Test
    void sendsAPayoutReceiptEmailWithTheRightSubject() {
        Long docId = newDoc(DocumentType.PAYOUT_RECEIPT, "PR-2026-07-0001");

        assertEquals(DeliveryStatus.SENT, sendAndGetStatus(docId));
        List<Mail> sent = mailbox.getMailsSentTo("service-test@example.com");
        assertEquals(1, sent.size());
        assertEquals("Your payout receipt from Email Service Test Chama", sent.get(0).getSubject());
    }

    @Test
    void marksFailedAndRecordsAnAttemptWhenTheKeycloakEmailLookupThrows() throws Exception {
        Mockito.when(keycloakAdminService.getUserEmail(Mockito.anyString())).thenThrow(new RuntimeException("Keycloak unreachable"));
        Long docId = newDoc(DocumentType.CONTRIBUTION_RECEIPT, "CR-2026-07-9001");

        assertEquals(DeliveryStatus.FAILED, sendAndGetStatus(docId));
        assertEquals(0, mailbox.getMailsSentTo("service-test@example.com").size());

        QuarkusTransaction.requiringNew().run(() -> {
            GeneratedDocument doc = generatedDocumentRepository.findById(docId);
            assertNotNull(doc.emailError);
            assertEquals(1, documentDeliveryAttemptRepository.findByDocumentId(docId).size());
        });
    }
}
