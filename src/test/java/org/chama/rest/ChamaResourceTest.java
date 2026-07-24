package org.chama.rest;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.chama.repository.ApprovalRepository;
import org.chama.repository.ChamaRepository;
import org.chama.repository.ContributionRepository;
import org.chama.repository.DocumentDeliveryAttemptRepository;
import org.chama.repository.GeneratedDocumentRepository;
import org.chama.repository.LoanDisbursementRepository;
import org.chama.repository.LoanRepaymentRepository;
import org.chama.repository.LoanRepository;
import org.chama.repository.MemberRepository;
import org.chama.repository.MeetingAttendanceRepository;
import org.chama.repository.MeetingRepository;
import org.chama.repository.MemberRoleRepository;
import org.chama.repository.PayoutRepository;
import org.chama.repository.PayoutScheduleRepository;
import org.chama.repository.PenaltyRepository;
import org.chama.repository.ActivityLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

@QuarkusTest
class ChamaResourceTest {

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

    @BeforeEach
    @Transactional
    void cleanDatabase() {
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
    }

    private static final String CREATE_BODY = """
        {"name":"Tumaini Chama","type":"MERRY_GO_ROUND","contributionFrequency":"MONTHLY",
         "contributionAmount":1000,"creatorFullName":"Founder","creatorPhone":"254700000000"}
        """;

    @Test
    @TestSecurity(user = "founder")
    void creatingAChamaMakesTheCreatorItsChairperson() {
        int chamaId = given()
            .contentType("application/json")
            .body(CREATE_BODY)
            .when().post("/api/chamas")
            .then()
                .statusCode(201)
                .body("name", equalTo("Tumaini Chama"))
                .extract().path("id");

        given()
            .when().get("/api/chamas/{id}/members", chamaId)
            .then()
                .statusCode(200)
                .body("[0].fullName", equalTo("Founder"))
                .body("[0].roles[0]", equalTo("CHAIRPERSON"));
    }

    @Test
    @TestSecurity(user = "founder")
    void chairpersonCanUpdateTheirOwnChama() {
        int chamaId = given()
            .contentType("application/json")
            .body(CREATE_BODY)
            .when().post("/api/chamas")
            .then().statusCode(201)
            .extract().path("id");

        var updateBody = """
            {"name":"Renamed Chama","type":"TABLE_BANKING","contributionFrequency":"WEEKLY",
             "contributionAmount":250}
            """;
        given()
            .contentType("application/json")
            .body(updateBody)
            .when().put("/api/chamas/{id}", chamaId)
            .then()
                .statusCode(200)
                .body("name", equalTo("Renamed Chama"))
                .body("type", equalTo("TABLE_BANKING"));
    }

    @Test
    @TestSecurity(user = "founder")
    void chairpersonCanDeleteTheirOwnChama() {
        int chamaId = given()
            .contentType("application/json")
            .body(CREATE_BODY)
            .when().post("/api/chamas")
            .then().statusCode(201)
            .extract().path("id");

        given().when().delete("/api/chamas/{id}", chamaId).then().statusCode(204);
        given().when().get("/api/chamas/{id}", chamaId).then().statusCode(403);
    }

    @Test
    void creatingAChamaRequiresAuthentication() {
        given()
            .contentType("application/json")
            .body(CREATE_BODY)
            .when().post("/api/chamas")
            .then().statusCode(401);
    }

    @Test
    @TestSecurity(user = "founder")
    void creatingAChamaValidatesRequiredFields() {
        given()
            .contentType("application/json")
            .body("{}")
            .when().post("/api/chamas")
            .then().statusCode(400);
    }
}
