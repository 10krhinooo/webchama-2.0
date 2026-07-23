package org.chama.rest;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import jakarta.inject.Inject;
import org.chama.domain.enums.ChamaStatus;
import org.chama.domain.enums.ChamaType;
import org.chama.domain.enums.ContributionFrequency;
import org.chama.domain.enums.ContributionStatus;
import org.chama.domain.enums.InterestMethod;
import org.chama.domain.enums.LoanStatus;
import org.chama.domain.enums.MemberRoleType;
import org.chama.domain.enums.MemberStatus;
import org.chama.domain.enums.PayoutStatus;
import org.chama.domain.model.Chama;
import org.chama.domain.model.Contribution;
import org.chama.domain.model.Loan;
import org.chama.domain.model.Member;
import org.chama.domain.model.MemberRole;
import org.chama.domain.model.Payout;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.startsWith;

@QuarkusTest
class DocumentResourceTest {

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
    private Long otherMemberId;
    private Long paidContributionId;
    private Long unpaidContributionId;
    private Long approvedLoanId;
    private Long requestedLoanId;
    private Long disbursedPayoutId;
    private Long scheduledPayoutId;

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

            Member treasurer = new Member();
            treasurer.chama = chama;
            treasurer.keycloakUserId = "doc-treasurer-1";
            treasurer.fullName = "Treasurer One";
            treasurer.phone = "254700000501";
            treasurer.status = MemberStatus.ACTIVE;
            memberRepository.persist(treasurer);
            MemberRole treasurerRole = new MemberRole();
            treasurerRole.member = treasurer;
            treasurerRole.role = MemberRoleType.TREASURER;
            treasurerRole.persist();

            Member member = new Member();
            member.chama = chama;
            member.keycloakUserId = "doc-member-1";
            member.fullName = "Member One";
            member.phone = "254700000502";
            member.status = MemberStatus.ACTIVE;
            memberRepository.persist(member);
            MemberRole memberRole = new MemberRole();
            memberRole.member = member;
            memberRole.role = MemberRoleType.MEMBER;
            memberRole.persist();
            memberId = member.id;

            Member other = new Member();
            other.chama = chama;
            other.keycloakUserId = "doc-other-1";
            other.fullName = "Other Member";
            other.phone = "254700000503";
            other.status = MemberStatus.ACTIVE;
            memberRepository.persist(other);
            MemberRole otherRole = new MemberRole();
            otherRole.member = other;
            otherRole.role = MemberRoleType.MEMBER;
            otherRole.persist();
            otherMemberId = other.id;

            Contribution paid = new Contribution();
            paid.chama = chama;
            paid.member = member;
            paid.period = LocalDate.of(2026, 7, 1);
            paid.amountDue = new BigDecimal("500");
            paid.amountPaid = new BigDecimal("500");
            paid.status = ContributionStatus.PAID;
            contributionRepository.persist(paid);
            paidContributionId = paid.id;

            Contribution unpaid = new Contribution();
            unpaid.chama = chama;
            unpaid.member = member;
            unpaid.period = LocalDate.of(2026, 8, 1);
            unpaid.amountDue = new BigDecimal("500");
            unpaid.amountPaid = BigDecimal.ZERO;
            unpaid.status = ContributionStatus.PENDING;
            contributionRepository.persist(unpaid);
            unpaidContributionId = unpaid.id;

            Loan approvedLoan = new Loan();
            approvedLoan.chama = chama;
            approvedLoan.member = member;
            approvedLoan.principal = new BigDecimal("10000");
            approvedLoan.interestRate = new BigDecimal("5");
            approvedLoan.interestMethod = InterestMethod.FLAT;
            approvedLoan.termMonths = 6;
            approvedLoan.status = LoanStatus.APPROVED;
            loanRepository.persist(approvedLoan);
            approvedLoanId = approvedLoan.id;

            Loan requestedLoan = new Loan();
            requestedLoan.chama = chama;
            requestedLoan.member = member;
            requestedLoan.principal = new BigDecimal("5000");
            requestedLoan.interestRate = new BigDecimal("5");
            requestedLoan.interestMethod = InterestMethod.FLAT;
            requestedLoan.termMonths = 3;
            requestedLoan.status = LoanStatus.REQUESTED;
            loanRepository.persist(requestedLoan);
            requestedLoanId = requestedLoan.id;

            Payout disbursedPayout = new Payout();
            disbursedPayout.chama = chama;
            disbursedPayout.member = member;
            disbursedPayout.roundNumber = 1;
            disbursedPayout.scheduledDate = LocalDate.of(2026, 7, 1);
            disbursedPayout.amount = new BigDecimal("2000");
            disbursedPayout.status = PayoutStatus.DISBURSED;
            payoutRepository.persist(disbursedPayout);
            disbursedPayoutId = disbursedPayout.id;

            Payout scheduledPayout = new Payout();
            scheduledPayout.chama = chama;
            scheduledPayout.member = member;
            scheduledPayout.roundNumber = 2;
            scheduledPayout.scheduledDate = LocalDate.of(2026, 8, 1);
            scheduledPayout.amount = new BigDecimal("2000");
            scheduledPayout.status = PayoutStatus.SCHEDULED;
            payoutRepository.persist(scheduledPayout);
            scheduledPayoutId = scheduledPayout.id;
        });
    }

    @Test
    @TestSecurity(user = "doc-treasurer-1")
    void treasurerCanGenerateAContributionReceiptForAPaidContribution() {
        given()
            .when().post("/api/chamas/{chamaId}/contributions/{id}/documents/receipt", chamaId, paidContributionId)
            .then()
                .statusCode(201)
                .body("documentType", equalTo("CONTRIBUTION_RECEIPT"))
                .body("documentNumber", startsWith("CR-"))
                .body("memberName", equalTo("Member One"))
                .body("totalAmount", equalTo(500.0f))
                .body("lineItems", hasSize(1))
                .body("pdfBase64", notNullValue());
    }

    @Test
    @TestSecurity(user = "doc-treasurer-1")
    void cannotGenerateAContributionReceiptWithNoPayment() {
        given()
            .when().post("/api/chamas/{chamaId}/contributions/{id}/documents/receipt", chamaId, unpaidContributionId)
            .then().statusCode(400);
    }

    @Test
    @TestSecurity(user = "doc-member-1")
    void memberCannotGenerateAContributionReceipt() {
        given()
            .when().post("/api/chamas/{chamaId}/contributions/{id}/documents/receipt", chamaId, paidContributionId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "doc-treasurer-1")
    void treasurerCanGenerateALoanStatementForAnApprovedLoan() {
        given()
            .when().post("/api/chamas/{chamaId}/loans/{id}/documents/statement", chamaId, approvedLoanId)
            .then()
                .statusCode(201)
                .body("documentType", equalTo("LOAN_STATEMENT"))
                .body("documentNumber", startsWith("LS-"))
                .body("totalAmount", equalTo(10000.0f));
    }

    @Test
    @TestSecurity(user = "doc-treasurer-1")
    void cannotGenerateALoanStatementForAMerelyRequestedLoan() {
        given()
            .when().post("/api/chamas/{chamaId}/loans/{id}/documents/statement", chamaId, requestedLoanId)
            .then().statusCode(400);
    }

    @Test
    @TestSecurity(user = "doc-treasurer-1")
    void treasurerCanGenerateAPayoutReceiptForADisbursedPayout() {
        given()
            .when().post("/api/chamas/{chamaId}/payouts/{id}/documents/receipt", chamaId, disbursedPayoutId)
            .then()
                .statusCode(201)
                .body("documentType", equalTo("PAYOUT_RECEIPT"))
                .body("documentNumber", startsWith("PR-"))
                .body("totalAmount", equalTo(2000.0f));
    }

    @Test
    @TestSecurity(user = "doc-treasurer-1")
    void cannotGenerateAPayoutReceiptForAStillScheduledPayout() {
        given()
            .when().post("/api/chamas/{chamaId}/payouts/{id}/documents/receipt", chamaId, scheduledPayoutId)
            .then().statusCode(400);
    }

    @Test
    @TestSecurity(user = "doc-treasurer-1")
    void listOmitsPdfBytesAndReturnsNewestFirst() {
        given().when().post("/api/chamas/{chamaId}/contributions/{id}/documents/receipt", chamaId, paidContributionId)
            .then().statusCode(201);
        given().when().post("/api/chamas/{chamaId}/payouts/{id}/documents/receipt", chamaId, disbursedPayoutId)
            .then().statusCode(201);

        given()
            .when().get("/api/chamas/{chamaId}/documents", chamaId)
            .then()
                .statusCode(200)
                .body("$", hasSize(2))
                .body("[0].documentType", equalTo("PAYOUT_RECEIPT"))
                .body("[0].pdfBase64", nullValue())
                .body("[1].documentType", equalTo("CONTRIBUTION_RECEIPT"));
    }

    @Test
    @TestSecurity(user = "doc-member-1")
    void memberCannotListDocuments() {
        given()
            .when().get("/api/chamas/{chamaId}/documents", chamaId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "doc-member-1")
    void memberCanFetchTheirOwnDocumentButNotAnotherMembers() {
        Long ownDocId = QuarkusTransaction.requiringNew().call(() -> {
            var contribution = contributionRepository.findById(paidContributionId);
            var doc = new org.chama.domain.model.GeneratedDocument();
            doc.chama = contribution.chama;
            doc.member = contribution.member;
            doc.contribution = contribution;
            doc.documentType = org.chama.domain.enums.DocumentType.CONTRIBUTION_RECEIPT;
            doc.documentNumber = "CR-2026-07-0001";
            doc.memberName = contribution.member.fullName;
            doc.lineItemsJson = "[{\"description\":\"Contribution\",\"amount\":500}]";
            doc.totalAmount = new BigDecimal("500");
            generatedDocumentRepository.persist(doc);
            return doc.id;
        });

        given()
            .when().get("/api/chamas/{chamaId}/documents/{id}?pdf=true", chamaId, ownDocId)
            .then().statusCode(200).body("documentNumber", equalTo("CR-2026-07-0001"));

        Long otherDocId = QuarkusTransaction.requiringNew().call(() -> {
            var chama = chamaRepository.findById(chamaId);
            var other = memberRepository.findById(otherMemberId);
            var doc = new org.chama.domain.model.GeneratedDocument();
            doc.chama = chama;
            doc.member = other;
            doc.documentType = org.chama.domain.enums.DocumentType.CONTRIBUTION_RECEIPT;
            doc.documentNumber = "CR-2026-07-0002";
            doc.memberName = other.fullName;
            doc.lineItemsJson = "[{\"description\":\"Contribution\",\"amount\":500}]";
            doc.totalAmount = new BigDecimal("500");
            generatedDocumentRepository.persist(doc);
            return doc.id;
        });

        given()
            .when().get("/api/chamas/{chamaId}/documents/{id}", chamaId, otherDocId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "other-chama-treasurer")
    void generatingForAContributionOwnedByAnotherChamaReturnsNotFound() {
        Long otherChamaId = QuarkusTransaction.requiringNew().call(() -> {
            Chama other = new Chama();
            other.name = "Other Chama";
            other.type = ChamaType.TABLE_BANKING;
            other.currency = "KES";
            other.contributionFrequency = ContributionFrequency.MONTHLY;
            other.contributionAmount = new BigDecimal("500");
            other.status = ChamaStatus.ACTIVE;
            chamaRepository.persist(other);

            Member treasurer = new Member();
            treasurer.chama = other;
            treasurer.keycloakUserId = "other-chama-treasurer";
            treasurer.fullName = "Other Chama Treasurer";
            treasurer.phone = "254700000504";
            treasurer.status = MemberStatus.ACTIVE;
            memberRepository.persist(treasurer);
            MemberRole role = new MemberRole();
            role.member = treasurer;
            role.role = MemberRoleType.TREASURER;
            role.persist();
            return other.id;
        });

        // A treasurer of otherChamaId, generating against a contribution that actually belongs
        // to chamaId, must get 404, not the other chama's data, even though the role check alone
        // would pass (they are a genuine TREASURER, just of a different chama).
        given()
            .when().post("/api/chamas/{chamaId}/contributions/{id}/documents/receipt", otherChamaId, paidContributionId)
            .then().statusCode(404);
    }
}
