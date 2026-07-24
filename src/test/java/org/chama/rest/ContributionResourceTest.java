package org.chama.rest;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import jakarta.inject.Inject;
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
import org.chama.repository.MemberRoleRepository;
import org.chama.repository.PayoutRepository;
import org.chama.repository.PayoutScheduleRepository;
import org.chama.repository.PenaltyRepository;
import org.chama.repository.ActivityLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

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
            contributionRepository.deleteAll();
            approvalRepository.deleteAll();
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
}
