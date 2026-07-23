package org.chama.repository;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.chama.domain.enums.ChamaStatus;
import org.chama.domain.enums.ChamaType;
import org.chama.domain.enums.ContributionFrequency;
import org.chama.domain.enums.ContributionStatus;
import org.chama.domain.enums.DeliveryChannel;
import org.chama.domain.enums.DeliveryStatus;
import org.chama.domain.enums.DocumentType;
import org.chama.domain.enums.MemberRoleType;
import org.chama.domain.enums.MemberStatus;
import org.chama.domain.model.Chama;
import org.chama.domain.model.Contribution;
import org.chama.domain.model.DocumentDeliveryAttempt;
import org.chama.domain.model.GeneratedDocument;
import org.chama.domain.model.Member;
import org.chama.domain.model.MemberRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@QuarkusTest
class DocumentRepositoryTest {

    @Inject
    ChamaRepository chamaRepository;

    @Inject
    MemberRepository memberRepository;

    @Inject
    MemberRoleRepository memberRoleRepository;

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
    GeneratedDocumentRepository generatedDocumentRepository;

    @Inject
    DocumentDeliveryAttemptRepository documentDeliveryAttemptRepository;

    private Long chamaId;
    private Long memberId;
    private Long otherChamaId;
    private Long contributionId;

    @BeforeEach
    void seed() {
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
            memberRoleRepository.deleteAll();
            memberRepository.deleteAll();
            chamaRepository.deleteAll();

            Chama chama = new Chama();
            chama.name = "Document Test Chama";
            chama.type = ChamaType.TABLE_BANKING;
            chama.currency = "KES";
            chama.contributionFrequency = ContributionFrequency.MONTHLY;
            chama.contributionAmount = new BigDecimal("500");
            chama.status = ChamaStatus.ACTIVE;
            chamaRepository.persist(chama);
            chamaId = chama.id;

            Chama otherChama = new Chama();
            otherChama.name = "Other Chama";
            otherChama.type = ChamaType.TABLE_BANKING;
            otherChama.currency = "KES";
            otherChama.contributionFrequency = ContributionFrequency.MONTHLY;
            otherChama.contributionAmount = new BigDecimal("500");
            otherChama.status = ChamaStatus.ACTIVE;
            chamaRepository.persist(otherChama);
            otherChamaId = otherChama.id;

            Member member = new Member();
            member.chama = chama;
            member.keycloakUserId = "document-member-1";
            member.fullName = "Member One";
            member.phone = "254700000401";
            member.status = MemberStatus.ACTIVE;
            memberRepository.persist(member);
            MemberRole role = new MemberRole();
            role.member = member;
            role.role = MemberRoleType.MEMBER;
            role.persist();
            memberId = member.id;

            Contribution contribution = new Contribution();
            contribution.chama = chama;
            contribution.member = member;
            contribution.period = LocalDate.now();
            contribution.amountDue = new BigDecimal("500");
            contribution.amountPaid = new BigDecimal("500");
            contribution.status = ContributionStatus.PAID;
            contributionRepository.persist(contribution);
            contributionId = contribution.id;
        });
    }

    private GeneratedDocument newContributionReceipt() {
        GeneratedDocument doc = new GeneratedDocument();
        doc.chama = chamaRepository.findById(chamaId);
        doc.member = memberRepository.findById(memberId);
        doc.contribution = contributionRepository.findById(contributionId);
        doc.documentType = DocumentType.CONTRIBUTION_RECEIPT;
        doc.documentNumber = "CR-2026-07-" + System.nanoTime();
        doc.memberName = "Member One";
        doc.memberEmail = "member1@example.com";
        doc.memberPhone = "254700000401";
        doc.lineItemsJson = "[{\"description\":\"July contribution\",\"amount\":500}]";
        doc.totalAmount = new BigDecimal("500");
        return doc;
    }

    @Test
    void findRecentForChamaOnlyReturnsThatChamasDocumentsNewestFirst() {
        QuarkusTransaction.requiringNew().run(() -> {
            GeneratedDocument older = newContributionReceipt();
            older.documentNumber = "CR-2026-07-0001";
            generatedDocumentRepository.persist(older);

            GeneratedDocument newer = newContributionReceipt();
            newer.documentNumber = "CR-2026-07-0002";
            generatedDocumentRepository.persist(newer);

            GeneratedDocument otherChamaDoc = newContributionReceipt();
            otherChamaDoc.chama = chamaRepository.findById(otherChamaId);
            otherChamaDoc.documentNumber = "CR-2026-07-0003";
            generatedDocumentRepository.persist(otherChamaDoc);
        });

        List<GeneratedDocument> results = generatedDocumentRepository.findRecentForChama(chamaId, 0, 10);

        assertEquals(2, results.size());
        assertEquals("CR-2026-07-0002", results.get(0).documentNumber);
        assertEquals("CR-2026-07-0001", results.get(1).documentNumber);
    }

    @Test
    void findForMemberScopesByBothChamaAndMember() {
        Long docId = QuarkusTransaction.requiringNew().call(() -> {
            GeneratedDocument doc = newContributionReceipt();
            generatedDocumentRepository.persist(doc);
            return doc.id;
        });

        List<GeneratedDocument> mine = generatedDocumentRepository.findForMember(chamaId, memberId);
        List<GeneratedDocument> wrongChama = generatedDocumentRepository.findForMember(otherChamaId, memberId);

        assertEquals(1, mine.size());
        assertEquals(docId, mine.get(0).id);
        assertTrue(wrongChama.isEmpty());
    }

    @Test
    void countPendingDeliveriesCountsEitherChannelStillPending() {
        QuarkusTransaction.requiringNew().run(() -> {
            GeneratedDocument pendingEmail = newContributionReceipt();
            pendingEmail.emailStatus = DeliveryStatus.PENDING;
            pendingEmail.whatsappStatus = DeliveryStatus.SENT;
            generatedDocumentRepository.persist(pendingEmail);

            GeneratedDocument allSent = newContributionReceipt();
            allSent.documentNumber = "CR-2026-07-9999";
            allSent.emailStatus = DeliveryStatus.SENT;
            allSent.whatsappStatus = DeliveryStatus.SENT;
            generatedDocumentRepository.persist(allSent);

            GeneratedDocument neverAttempted = newContributionReceipt();
            neverAttempted.documentNumber = "CR-2026-07-8888";
            generatedDocumentRepository.persist(neverAttempted);
        });

        assertEquals(1, generatedDocumentRepository.countPendingDeliveries(chamaId));
    }

    @Test
    void findByDocumentNumberReturnsEmptyWhenNotFound() {
        assertTrue(generatedDocumentRepository.findByDocumentNumber("does-not-exist").isEmpty());
    }

    @Test
    void findByDocumentNumberReturnsTheMatchingDocument() {
        QuarkusTransaction.requiringNew().run(() -> {
            GeneratedDocument doc = newContributionReceipt();
            doc.documentNumber = "CR-2026-07-4242";
            generatedDocumentRepository.persist(doc);
        });

        assertTrue(generatedDocumentRepository.findByDocumentNumber("CR-2026-07-4242").isPresent());
    }

    @Test
    void deletingADocumentCascadesToItsDeliveryAttempts() {
        Long docId = QuarkusTransaction.requiringNew().call(() -> {
            GeneratedDocument doc = newContributionReceipt();
            generatedDocumentRepository.persist(doc);

            DocumentDeliveryAttempt attempt = new DocumentDeliveryAttempt();
            attempt.document = doc;
            attempt.channel = DeliveryChannel.EMAIL;
            attempt.status = DeliveryStatus.FAILED;
            attempt.errorDetail = "SMTP timeout";
            documentDeliveryAttemptRepository.persist(attempt);
            return doc.id;
        });

        assertEquals(1, documentDeliveryAttemptRepository.findByDocumentId(docId).size());

        QuarkusTransaction.requiringNew().run(() -> generatedDocumentRepository.deleteById(docId));

        assertTrue(documentDeliveryAttemptRepository.findByDocumentId(docId).isEmpty());
    }

    @Test
    void findByDocumentIdOrdersNewestAttemptFirst() {
        QuarkusTransaction.requiringNew().run(() -> {
            GeneratedDocument doc = newContributionReceipt();
            generatedDocumentRepository.persist(doc);

            DocumentDeliveryAttempt first = new DocumentDeliveryAttempt();
            first.document = doc;
            first.channel = DeliveryChannel.EMAIL;
            first.status = DeliveryStatus.FAILED;
            first.errorDetail = "SMTP timeout";
            documentDeliveryAttemptRepository.persist(first);

            DocumentDeliveryAttempt second = new DocumentDeliveryAttempt();
            second.document = doc;
            second.channel = DeliveryChannel.EMAIL;
            second.status = DeliveryStatus.SENT;
            documentDeliveryAttemptRepository.persist(second);

            List<DocumentDeliveryAttempt> attempts = documentDeliveryAttemptRepository.findByDocumentId(doc.id);
            assertEquals(2, attempts.size());
            assertEquals(DeliveryStatus.SENT, attempts.get(0).status);
            assertEquals(DeliveryStatus.FAILED, attempts.get(1).status);
        });
    }

    @Test
    void countFailedSinceOnlyCountsFailuresWithinTheWindow() {
        QuarkusTransaction.requiringNew().run(() -> {
            GeneratedDocument doc = newContributionReceipt();
            generatedDocumentRepository.persist(doc);

            DocumentDeliveryAttempt recentFailure = new DocumentDeliveryAttempt();
            recentFailure.document = doc;
            recentFailure.channel = DeliveryChannel.WHATSAPP;
            recentFailure.status = DeliveryStatus.FAILED;
            recentFailure.errorDetail = "WhatsApp API error";
            documentDeliveryAttemptRepository.persist(recentFailure);

            DocumentDeliveryAttempt success = new DocumentDeliveryAttempt();
            success.document = doc;
            success.channel = DeliveryChannel.EMAIL;
            success.status = DeliveryStatus.SENT;
            documentDeliveryAttemptRepository.persist(success);
        });

        Instant since = Instant.now().minus(1, ChronoUnit.HOURS);
        Instant future = Instant.now().plus(1, ChronoUnit.HOURS);

        assertEquals(1, documentDeliveryAttemptRepository.countFailedSince(since));
        assertFalse(documentDeliveryAttemptRepository.countFailedSince(future) > 0);
    }
}
