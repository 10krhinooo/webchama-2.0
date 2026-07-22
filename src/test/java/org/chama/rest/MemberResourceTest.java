package org.chama.rest;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import jakarta.inject.Inject;
import org.chama.domain.enums.ChamaStatus;
import org.chama.domain.enums.ChamaType;
import org.chama.domain.enums.ContributionFrequency;
import org.chama.domain.enums.MemberRoleType;
import org.chama.domain.model.Chama;
import org.chama.domain.model.Member;
import org.chama.domain.model.MemberRole;
import org.chama.repository.ChamaRepository;
import org.chama.repository.ContributionRepository;
import org.chama.repository.MemberRepository;
import org.chama.repository.MemberRoleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

@QuarkusTest
class MemberResourceTest {

    @Inject
    ChamaRepository chamaRepository;

    @Inject
    MemberRepository memberRepository;

    @Inject
    MemberRoleRepository memberRoleRepository;

    @Inject
    ContributionRepository contributionRepository;

    private Long chamaId;

    @BeforeEach
    void seed() {
        QuarkusTransaction.requiringNew().run(() -> {
            contributionRepository.deleteAll();
            memberRoleRepository.deleteAll();
            memberRepository.deleteAll();
            chamaRepository.deleteAll();

            Chama chama = new Chama();
            chama.name = "Member Test Chama";
            chama.type = ChamaType.MERRY_GO_ROUND;
            chama.currency = "KES";
            chama.contributionFrequency = ContributionFrequency.MONTHLY;
            chama.contributionAmount = new BigDecimal("500");
            chama.status = ChamaStatus.ACTIVE;
            chamaRepository.persist(chama);
            chamaId = chama.id;

            Member chair = new Member();
            chair.chama = chama;
            chair.keycloakUserId = "chair-1";
            chair.fullName = "Chair One";
            chair.phone = "254700000001";
            chair.status = org.chama.domain.enums.MemberStatus.ACTIVE;
            memberRepository.persist(chair);
            MemberRole role = new MemberRole();
            role.member = chair;
            role.role = MemberRoleType.CHAIRPERSON;
            role.persist();
        });
    }

    @Test
    @TestSecurity(user = "chair-1")
    void chairpersonCanAddUpdateAndRemoveAMember() {
        String createBody = """
            {"keycloakUserId":"new-member","fullName":"New Member","phone":"254700000002","roles":["MEMBER"]}
            """;
        int memberId = given()
            .contentType("application/json")
            .body(createBody)
            .when().post("/api/chamas/{chamaId}/members", chamaId)
            .then()
                .statusCode(201)
                .body("fullName", equalTo("New Member"))
                .extract().path("id");

        String updateBody = """
            {"fullName":"Updated Name","phone":"254700000003","roles":["SECRETARY"]}
            """;
        given()
            .contentType("application/json")
            .body(updateBody)
            .when().put("/api/chamas/{chamaId}/members/{id}", chamaId, memberId)
            .then()
                .statusCode(200)
                .body("fullName", equalTo("Updated Name"))
                .body("roles[0]", equalTo("SECRETARY"));

        given()
            .when().delete("/api/chamas/{chamaId}/members/{id}", chamaId, memberId)
            .then().statusCode(204);

        given()
            .when().get("/api/chamas/{chamaId}/members/{id}", chamaId, memberId)
            .then().statusCode(404);
    }

    @Test
    @TestSecurity(user = "chair-1")
    void mineReturnsTheCallersOwnMemberRow() {
        given()
            .when().get("/api/chamas/{chamaId}/members/mine", chamaId)
            .then()
                .statusCode(200)
                .body("fullName", equalTo("Chair One"))
                .body("roles[0]", equalTo("CHAIRPERSON"));
    }

    @Test
    @TestSecurity(user = "not-a-member")
    void mineReturns404ForSomeoneWithNoMemberRowInThisChama() {
        given()
            .when().get("/api/chamas/{chamaId}/members/mine", chamaId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "chair-1")
    void chairpersonCanSuspendAndReactivateAMember() {
        String createBody = """
            {"keycloakUserId":"status-member","fullName":"Status Member","phone":"254700000004","roles":["MEMBER"]}
            """;
        int memberId = given()
            .contentType("application/json")
            .body(createBody)
            .when().post("/api/chamas/{chamaId}/members", chamaId)
            .then()
                .statusCode(201)
                .extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"status\":\"SUSPENDED\"}")
            .when().put("/api/chamas/{chamaId}/members/{id}/status", chamaId, memberId)
            .then()
                .statusCode(200)
                .body("status", equalTo("SUSPENDED"));

        given()
            .contentType("application/json")
            .body("{\"status\":\"ACTIVE\"}")
            .when().put("/api/chamas/{chamaId}/members/{id}/status", chamaId, memberId)
            .then()
                .statusCode(200)
                .body("status", equalTo("ACTIVE"));
    }

    @Test
    @TestSecurity(user = "new-member")
    void aPlainMemberCannotChangeAnotherMembersStatus() {
        QuarkusTransaction.requiringNew().run(() -> {
            Member plain = new Member();
            plain.chama = chamaRepository.findById(chamaId);
            plain.keycloakUserId = "new-member";
            plain.fullName = "Plain Member";
            plain.phone = "254700000005";
            memberRepository.persist(plain);
            MemberRole role = new MemberRole();
            role.member = plain;
            role.role = MemberRoleType.MEMBER;
            role.persist();
        });

        given()
            .contentType("application/json")
            .body("{\"status\":\"SUSPENDED\"}")
            .when().put("/api/chamas/{chamaId}/members/{id}/status", chamaId, 999999)
            .then().statusCode(403);
    }
}
