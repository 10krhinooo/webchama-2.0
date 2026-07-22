package org.chama.rest;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.chama.repository.ChamaRepository;
import org.chama.repository.ContributionRepository;
import org.chama.repository.LoanRepaymentRepository;
import org.chama.repository.LoanRepository;
import org.chama.repository.MemberRepository;
import org.chama.repository.MemberRoleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

@QuarkusTest
class ChamaResourceTest {

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

    @BeforeEach
    @Transactional
    void cleanDatabase() {
        loanRepaymentRepository.deleteAll();
        loanRepository.deleteAll();
        contributionRepository.deleteAll();
        memberRoleRepository.deleteAll();
        memberRepository.deleteAll();
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
