package org.chama.rest;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import jakarta.inject.Inject;
import org.chama.domain.enums.ChamaStatus;
import org.chama.domain.enums.ChamaType;
import org.chama.domain.enums.ContributionFrequency;
import org.chama.domain.enums.InterestMethod;
import org.chama.domain.enums.MemberRoleType;
import org.chama.domain.enums.MemberStatus;
import org.chama.domain.model.Chama;
import org.chama.domain.model.Loan;
import org.chama.domain.model.Member;
import org.chama.domain.model.MemberRole;
import org.chama.repository.ApprovalRepository;
import org.chama.repository.ChamaRepository;
import org.chama.repository.ContributionRepository;
import org.chama.repository.DocumentDeliveryAttemptRepository;
import org.chama.repository.GeneratedDocumentRepository;
import org.chama.repository.LoanDisbursementRepository;
import org.chama.repository.LoanRepaymentRepository;
import org.chama.repository.LoanRepository;
import org.chama.repository.MemberRepository;
import org.chama.repository.WelfareContributionRepository;
import org.chama.repository.WelfareFundRepository;
import org.chama.repository.WelfareWithdrawalRepository;
import org.chama.repository.MemberRoleRepository;
import org.chama.repository.PaymentRepository;
import org.chama.repository.MeetingAttendanceRepository;
import org.chama.repository.MeetingRepository;
import org.chama.repository.PayoutRepository;
import org.chama.repository.PayoutScheduleRepository;
import org.chama.repository.PenaltyRepository;
import org.chama.repository.ActivityLogRepository;
import org.chama.service.DarajaB2cClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.math.BigDecimal;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;

@QuarkusTest
class LoanResourceTest {

    @Inject
    ActivityLogRepository activityLogRepository;

    @Inject
    ApprovalRepository approvalRepository;

    @Inject
    ChamaRepository chamaRepository;

    @Inject
    MemberRepository memberRepository;

    @Inject
    WelfareWithdrawalRepository welfareWithdrawalRepository;

    @Inject
    WelfareContributionRepository welfareContributionRepository;

    @Inject
    WelfareFundRepository welfareFundRepository;

    @Inject
    MemberRoleRepository memberRoleRepository;

    @Inject
    LoanRepository loanRepository;

    @Inject
    LoanRepaymentRepository loanRepaymentRepository;

    @Inject
    ContributionRepository contributionRepository;

    @Inject
    GeneratedDocumentRepository generatedDocumentRepository;

    @Inject
    DocumentDeliveryAttemptRepository documentDeliveryAttemptRepository;

    @Inject
    PaymentRepository paymentRepository;

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
    LoanDisbursementRepository loanDisbursementRepository;

    @InjectMock
    DarajaB2cClient b2cClient;

    private Long chamaId;
    private Long borrowerId;
    private Long otherMemberId;

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
            contributionRepository.deleteAll();
            loanDisbursementRepository.deleteAll();
            loanRepaymentRepository.deleteAll();
            loanRepository.deleteAll();
            approvalRepository.deleteAll();
            welfareWithdrawalRepository.deleteAll();
            welfareContributionRepository.deleteAll();
            welfareFundRepository.deleteAll();
            memberRoleRepository.deleteAll();
            memberRepository.deleteAll();
            activityLogRepository.deleteAll();
            chamaRepository.deleteAll();

            Chama chama = new Chama();
            chama.name = "Loan Test Chama";
            chama.type = ChamaType.TABLE_BANKING;
            chama.currency = "KES";
            chama.contributionFrequency = ContributionFrequency.MONTHLY;
            chama.contributionAmount = new BigDecimal("500");
            chama.status = ChamaStatus.ACTIVE;
            chamaRepository.persist(chama);
            chamaId = chama.id;

            Member treasurer = new Member();
            treasurer.chama = chama;
            treasurer.keycloakUserId = "loan-treasurer-1";
            treasurer.fullName = "Treasurer One";
            treasurer.phone = "254700000101";
            treasurer.status = MemberStatus.ACTIVE;
            memberRepository.persist(treasurer);
            MemberRole treasurerRole = new MemberRole();
            treasurerRole.member = treasurer;
            treasurerRole.role = MemberRoleType.TREASURER;
            treasurerRole.persist();

            Member borrower = new Member();
            borrower.chama = chama;
            borrower.keycloakUserId = "loan-borrower-1";
            borrower.fullName = "Borrower One";
            borrower.phone = "254700000102";
            borrower.status = MemberStatus.ACTIVE;
            memberRepository.persist(borrower);
            MemberRole borrowerRole = new MemberRole();
            borrowerRole.member = borrower;
            borrowerRole.role = MemberRoleType.MEMBER;
            borrowerRole.persist();
            borrowerId = borrower.id;

            Member other = new Member();
            other.chama = chama;
            other.keycloakUserId = "loan-other-1";
            other.fullName = "Other Member";
            other.phone = "254700000103";
            other.status = MemberStatus.ACTIVE;
            memberRepository.persist(other);
            MemberRole otherRole = new MemberRole();
            otherRole.member = other;
            otherRole.role = MemberRoleType.MEMBER;
            otherRole.persist();
            otherMemberId = other.id;
        });
    }

    @Test
    @TestSecurity(user = "loan-borrower-1")
    void memberCanRequestOwnLoanAndGetsAFlatRepaymentSchedule() {
        String body = String.format(
            "{\"memberId\":%d,\"principal\":12000,\"interestRate\":12,\"interestMethod\":\"FLAT\",\"termMonths\":12}",
            borrowerId);

        int loanId = given()
            .contentType("application/json")
            .body(body)
            .when().post("/api/chamas/{chamaId}/loans", chamaId)
            .then()
                .statusCode(201)
                .body("status", equalTo("REQUESTED"))
                .body("memberId", equalTo(borrowerId.intValue()))
                .extract().path("id");

        given()
            .when().get("/api/chamas/{chamaId}/loans/{id}/repayments", chamaId, loanId)
            .then()
                .statusCode(200)
                .body("$", hasSize(12))
                .body("[0].installmentNumber", equalTo(1))
                .body("[0].amountDue", equalTo(1120.0f))
                .body("[11].amountDue", equalTo(1120.0f))
                .body("[0].status", equalTo("PENDING"));
    }

    @Test
    @TestSecurity(user = "loan-borrower-1")
    void memberCannotRequestALoanForAnotherMember() {
        String body = String.format(
            "{\"memberId\":%d,\"principal\":5000,\"interestRate\":10,\"interestMethod\":\"FLAT\",\"termMonths\":6}",
            otherMemberId);

        given()
            .contentType("application/json")
            .body(body)
            .when().post("/api/chamas/{chamaId}/loans", chamaId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "loan-treasurer-1")
    void treasurerCanRequestALoanOnBehalfOfAMemberAndRecordRepayments() {
        String body = String.format(
            "{\"memberId\":%d,\"principal\":6000,\"interestRate\":0,\"interestMethod\":\"REDUCING_BALANCE\",\"termMonths\":6}",
            borrowerId);

        int loanId = given()
            .contentType("application/json")
            .body(body)
            .when().post("/api/chamas/{chamaId}/loans", chamaId)
            .then().statusCode(201)
            .extract().path("id");

        int firstRepaymentId = given()
            .when().get("/api/chamas/{chamaId}/loans/{id}/repayments", chamaId, loanId)
            .then().statusCode(200)
            .body("$", hasSize(6))
            .body("[0].amountDue", equalTo(1000.0f))
            .extract().path("[0].id");

        given()
            .contentType("application/json")
            .body("{\"amount\":400}")
            .when().put("/api/chamas/{chamaId}/loans/{loanId}/repayments/{repaymentId}/payment",
                chamaId, loanId, firstRepaymentId)
            .then()
                .statusCode(200)
                .body("status", equalTo("PARTIAL"))
                .body("amountPaid", equalTo(400.0f));

        given()
            .contentType("application/json")
            .body("{\"amount\":600}")
            .when().put("/api/chamas/{chamaId}/loans/{loanId}/repayments/{repaymentId}/payment",
                chamaId, loanId, firstRepaymentId)
            .then()
                .statusCode(200)
                .body("status", equalTo("PAID"))
                .body("amountPaid", equalTo(1000.0f));
    }

    @Test
    @TestSecurity(user = "loan-treasurer-1")
    void treasurerCanListAllLoansForTheChama() {
        String body = String.format(
            "{\"memberId\":%d,\"principal\":3000,\"interestRate\":5,\"interestMethod\":\"FLAT\",\"termMonths\":3}",
            borrowerId);
        given().contentType("application/json").body(body)
            .when().post("/api/chamas/{chamaId}/loans", chamaId)
            .then().statusCode(201);

        given()
            .when().get("/api/chamas/{chamaId}/loans", chamaId)
            .then().statusCode(200)
                .body("$", hasSize(1));
    }

    @Test
    @TestSecurity(user = "loan-treasurer-1")
    void treasurerCanApproveARequestedLoan() {
        String body = String.format(
            "{\"memberId\":%d,\"principal\":4000,\"interestRate\":8,\"interestMethod\":\"FLAT\",\"termMonths\":4}",
            borrowerId);
        int loanId = given().contentType("application/json").body(body)
            .when().post("/api/chamas/{chamaId}/loans", chamaId)
            .then().statusCode(201)
            .extract().path("id");

        given()
            .when().put("/api/chamas/{chamaId}/loans/{id}/approve", chamaId, loanId)
            .then()
                .statusCode(200)
                .body("status", equalTo("APPROVED"))
                .body("approvedByName", equalTo("Treasurer One"))
                .body("approvedAt", org.hamcrest.Matchers.notNullValue());
    }

    @Test
    @TestSecurity(user = "loan-borrower-1")
    void memberCannotApproveALoan() {
        String body = String.format(
            "{\"memberId\":%d,\"principal\":4000,\"interestRate\":8,\"interestMethod\":\"FLAT\",\"termMonths\":4}",
            borrowerId);
        int loanId = given().contentType("application/json").body(body)
            .when().post("/api/chamas/{chamaId}/loans", chamaId)
            .then().statusCode(201)
            .extract().path("id");

        given()
            .when().put("/api/chamas/{chamaId}/loans/{id}/approve", chamaId, loanId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "loan-treasurer-1")
    void approvingAnAlreadyApprovedLoanFails() {
        String body = String.format(
            "{\"memberId\":%d,\"principal\":4000,\"interestRate\":8,\"interestMethod\":\"FLAT\",\"termMonths\":4}",
            borrowerId);
        int loanId = given().contentType("application/json").body(body)
            .when().post("/api/chamas/{chamaId}/loans", chamaId)
            .then().statusCode(201)
            .extract().path("id");

        given().when().put("/api/chamas/{chamaId}/loans/{id}/approve", chamaId, loanId)
            .then().statusCode(200);

        given()
            .when().put("/api/chamas/{chamaId}/loans/{id}/approve", chamaId, loanId)
            .then().statusCode(400);
    }

    @Test
    @TestSecurity(user = "loan-other-1")
    void anotherMemberCannotSeeSomeoneElsesLoan() {
        Long loanId = QuarkusTransaction.requiringNew().call(() -> {
            Loan loan = new Loan();
            loan.chama = chamaRepository.findById(chamaId);
            loan.member = memberRepository.findById(borrowerId);
            loan.principal = new BigDecimal("3000");
            loan.interestRate = new BigDecimal("5");
            loan.interestMethod = InterestMethod.FLAT;
            loan.termMonths = 3;
            loanRepository.persist(loan);
            return loan.id;
        });

        given()
            .when().get("/api/chamas/{chamaId}/loans/{id}", chamaId, loanId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "loan-treasurer-1")
    void treasurerCanDisburseAnApprovedLoan() {
        Long loanId = approvedLoan();
        Mockito.when(b2cClient.requestPayout(anyString(), any(BigDecimal.class), anyString()))
            .thenReturn(new DarajaB2cClient.B2cAckResult("AG_1", "16740-1"));

        given()
            .when().put("/api/chamas/{chamaId}/loans/{id}/disburse", chamaId, loanId)
            .then()
                .statusCode(200)
                .body("status", equalTo("PENDING"))
                .body("loanId", equalTo(loanId.intValue()));
    }

    @Test
    @TestSecurity(user = "loan-borrower-1")
    void memberCannotDisburseALoan() {
        Long loanId = approvedLoan();

        given()
            .when().put("/api/chamas/{chamaId}/loans/{id}/disburse", chamaId, loanId)
            .then().statusCode(403);
        Mockito.verifyNoInteractions(b2cClient);
    }

    @Test
    @TestSecurity(user = "loan-treasurer-1")
    void disbursingARequestedLoanThatIsNotYetApprovedFails() {
        String body = String.format(
            "{\"memberId\":%d,\"principal\":4000,\"interestRate\":8,\"interestMethod\":\"FLAT\",\"termMonths\":4}",
            borrowerId);
        int loanId = given().contentType("application/json").body(body)
            .when().post("/api/chamas/{chamaId}/loans", chamaId)
            .then().statusCode(201)
            .extract().path("id");

        given()
            .when().put("/api/chamas/{chamaId}/loans/{id}/disburse", chamaId, loanId)
            .then().statusCode(400);
        Mockito.verifyNoInteractions(b2cClient);
    }

    private Long approvedLoan() {
        return QuarkusTransaction.requiringNew().call(() -> {
            Loan loan = new Loan();
            loan.chama = chamaRepository.findById(chamaId);
            loan.member = memberRepository.findById(borrowerId);
            loan.principal = new BigDecimal("4000");
            loan.interestRate = new BigDecimal("8");
            loan.interestMethod = InterestMethod.FLAT;
            loan.termMonths = 4;
            loan.status = org.chama.domain.enums.LoanStatus.APPROVED;
            loanRepository.persist(loan);
            return loan.id;
        });
    }
}
