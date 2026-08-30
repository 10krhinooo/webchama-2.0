package org.chama.rest;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import jakarta.inject.Inject;
import org.chama.domain.ChamaTime;
import org.chama.domain.enums.ChamaStatus;
import org.chama.domain.enums.ChamaType;
import org.chama.domain.enums.ContributionFrequency;
import org.chama.domain.enums.MemberRoleType;
import org.chama.domain.enums.MemberStatus;
import org.chama.domain.model.Chama;
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
import org.chama.repository.MeetingAttendanceRepository;
import org.chama.repository.MeetingRepository;
import org.chama.repository.MemberRepository;
import org.chama.repository.WelfareContributionRepository;
import org.chama.repository.WelfareFundRepository;
import org.chama.repository.WelfareWithdrawalRepository;
import org.chama.repository.MemberRoleRepository;
import org.chama.repository.PaymentRepository;
import org.chama.repository.PayoutRepository;
import org.chama.repository.PayoutScheduleRepository;
import org.chama.repository.PenaltyRepository;
import org.chama.repository.ActivityLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

@QuarkusTest
class ContributionResourceTest {

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
    ContributionRepository contributionRepository;

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
    PaymentRepository paymentRepository;

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
            chama.name = "Contribution Test Chama";
            chama.type = ChamaType.MERRY_GO_ROUND;
            chama.currency = "KES";
            chama.contributionFrequency = ContributionFrequency.MONTHLY;
            chama.contributionAmount = new BigDecimal("500");
            chama.status = ChamaStatus.ACTIVE;
            chamaRepository.persist(chama);
            chamaId = chama.id;

            Member treasurer = new Member();
            treasurer.chama = chama;
            treasurer.keycloakUserId = "treasurer-1";
            treasurer.fullName = "Treasurer One";
            treasurer.phone = "254700000001";
            treasurer.status = MemberStatus.ACTIVE;
            memberRepository.persist(treasurer);
            MemberRole role = new MemberRole();
            role.member = treasurer;
            role.role = MemberRoleType.TREASURER;
            role.persist();

            Member payer = new Member();
            payer.chama = chama;
            payer.keycloakUserId = "payer-1";
            payer.fullName = "Payer One";
            payer.phone = "254700000002";
            payer.status = MemberStatus.ACTIVE;
            memberRepository.persist(payer);
            MemberRole payerRole = new MemberRole();
            payerRole.member = payer;
            payerRole.role = MemberRoleType.MEMBER;
            payerRole.persist();
            memberId = payer.id;
        });
    }

    @Test
    @TestSecurity(user = "treasurer-1")
    void treasurerCanCreateAndRecordAPayment() {
        String createBody = String.format(
            "{\"memberId\":%d,\"period\":\"2026-07-01\",\"amountDue\":500}", memberId);

        int contributionId = given()
            .contentType("application/json")
            .body(createBody)
            .when().post("/api/chamas/{chamaId}/contributions", chamaId)
            .then()
                .statusCode(201)
                .body("status", equalTo("PENDING"))
                .extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"amount\":500,\"method\":\"MPESA\"}")
            .when().put("/api/chamas/{chamaId}/contributions/{id}/payment", chamaId, contributionId)
            .then()
                .statusCode(200)
                .body("status", equalTo("PAID"))
                .body("amountPaid", equalTo(500.0f));
    }

    @Test
    @TestSecurity(user = "treasurer-1")
    void partialPaymentLeavesContributionPartial() {
        String createBody = String.format(
            "{\"memberId\":%d,\"period\":\"2026-08-01\",\"amountDue\":500}", memberId);
        int contributionId = given()
            .contentType("application/json")
            .body(createBody)
            .when().post("/api/chamas/{chamaId}/contributions", chamaId)
            .then().statusCode(201)
            .extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"amount\":200,\"method\":\"CASH\"}")
            .when().put("/api/chamas/{chamaId}/contributions/{id}/payment", chamaId, contributionId)
            .then()
                .statusCode(200)
                .body("status", equalTo("PARTIAL"));
    }

    @Test
    @TestSecurity(user = "treasurer-1")
    void treasurerCanDeleteAContribution() {
        String createBody = String.format(
            "{\"memberId\":%d,\"period\":\"2026-09-01\",\"amountDue\":500}", memberId);
        int contributionId = given()
            .contentType("application/json")
            .body(createBody)
            .when().post("/api/chamas/{chamaId}/contributions", chamaId)
            .then().statusCode(201)
            .extract().path("id");

        given()
            .when().delete("/api/chamas/{chamaId}/contributions/{id}", chamaId, contributionId)
            .then().statusCode(204);
    }

    @Test
    @TestSecurity(user = "payer-1")
    void mineStreakIsZeroWithNoContributions() {
        given()
            .when().get("/api/chamas/{chamaId}/contributions/mine/streak", chamaId)
            .then()
                .statusCode(200)
                .body("streak", equalTo(0));
    }

    @Test
    @TestSecurity(user = "payer-1")
    void mineStreakCountsAContributionPaidOnOrBeforeItsDueDate() {
        QuarkusTransaction.requiringNew().run(() -> {
            org.chama.domain.model.Contribution contribution = new org.chama.domain.model.Contribution();
            contribution.chama = chamaRepository.findById(chamaId);
            contribution.member = memberRepository.findById(memberId);
            // The chama's calendar, not the server's. Built with a bare LocalDate.now() this
            // fixture was a day behind the Nairobi date the service reads for the first three
            // hours of every Nairobi morning, so the payment looked late and the streak was zero.
            contribution.period = ChamaTime.today();
            contribution.amountDue = new BigDecimal("500");
            contribution.amountPaid = new BigDecimal("500");
            contribution.status = org.chama.domain.enums.ContributionStatus.PAID;
            contribution.paidAt = java.time.Instant.now();
            contributionRepository.persist(contribution);
        });

        given()
            .when().get("/api/chamas/{chamaId}/contributions/mine/streak", chamaId)
            .then()
                .statusCode(200)
                .body("streak", equalTo(1));
    }

    @Test
    @TestSecurity(user = "payer-1")
    void mineStreakResetsToZeroOnAnOverdueUnpaidContribution() {
        QuarkusTransaction.requiringNew().run(() -> {
            org.chama.domain.model.Contribution overdue = new org.chama.domain.model.Contribution();
            overdue.chama = chamaRepository.findById(chamaId);
            overdue.member = memberRepository.findById(memberId);
            overdue.period = LocalDate.now().minusMonths(1);
            overdue.amountDue = new BigDecimal("500");
            overdue.status = org.chama.domain.enums.ContributionStatus.OVERDUE;
            contributionRepository.persist(overdue);
        });

        given()
            .when().get("/api/chamas/{chamaId}/contributions/mine/streak", chamaId)
            .then()
                .statusCode(200)
                .body("streak", equalTo(0));
    }
}
