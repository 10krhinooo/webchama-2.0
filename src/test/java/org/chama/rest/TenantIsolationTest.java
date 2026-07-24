package org.chama.rest;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import jakarta.inject.Inject;
import org.chama.domain.enums.MemberRoleType;
import org.chama.domain.enums.MemberStatus;
import org.chama.domain.model.Chama;
import org.chama.domain.model.Member;
import org.chama.domain.model.MemberRole;
import org.chama.domain.enums.ChamaStatus;
import org.chama.domain.enums.ChamaType;
import org.chama.domain.enums.ContributionFrequency;
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
import org.chama.repository.PayoutRepository;
import org.chama.repository.PayoutScheduleRepository;
import org.chama.repository.PenaltyRepository;
import org.chama.repository.ActivityLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

/**
 * The tenant-isolation regression suite: a member or even a chairperson of
 * one chama must never be able to read or write another chama's data by
 * guessing its ID, and a caller's chama-scoped role must be resolved per
 * chama, not trusted from a single realm-wide assumption.
 */
@QuarkusTest
class TenantIsolationTest {

    @Inject
    ActivityLogRepository activityLogRepository;

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

    private Long chamaAId;
    private Long chamaBId;

    @BeforeEach
    void seedTwoChamas() {
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
            memberRoleRepository.deleteAll();
            memberRepository.deleteAll();
            activityLogRepository.deleteAll();
            chamaRepository.deleteAll();

            Chama chamaA = newChama("Chama A");
            chamaRepository.persist(chamaA);
            Member chairA = newMember(chamaA, "user-chair-a", "Chair A");
            memberRepository.persist(chairA);
            assignRole(chairA, MemberRoleType.CHAIRPERSON);
            Member plainA = newMember(chamaA, "user-member-a", "Member A");
            memberRepository.persist(plainA);
            assignRole(plainA, MemberRoleType.MEMBER);
            chamaAId = chamaA.id;

            Chama chamaB = newChama("Chama B");
            chamaRepository.persist(chamaB);
            Member chairB = newMember(chamaB, "user-chair-b", "Chair B");
            memberRepository.persist(chairB);
            assignRole(chairB, MemberRoleType.CHAIRPERSON);
            chamaBId = chamaB.id;
        });
    }

    private Chama newChama(String name) {
        Chama chama = new Chama();
        chama.name = name;
        chama.type = ChamaType.MERRY_GO_ROUND;
        chama.currency = "KES";
        chama.contributionFrequency = ContributionFrequency.MONTHLY;
        chama.contributionAmount = new BigDecimal("500");
        chama.status = ChamaStatus.ACTIVE;
        return chama;
    }

    private Member newMember(Chama chama, String keycloakUserId, String fullName) {
        Member member = new Member();
        member.chama = chama;
        member.keycloakUserId = keycloakUserId;
        member.fullName = fullName;
        member.phone = "254700000000";
        member.status = MemberStatus.ACTIVE;
        return member;
    }

    private void assignRole(Member member, MemberRoleType roleType) {
        MemberRole role = new MemberRole();
        role.member = member;
        role.role = roleType;
        role.persist();
    }

    @Test
    @TestSecurity(user = "user-chair-a")
    void chairOfChamaACannotReadChamaB() {
        given()
            .when().get("/api/chamas/{id}", chamaBId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "user-chair-a")
    void chairOfChamaACannotListChamaBMembers() {
        given()
            .when().get("/api/chamas/{chamaId}/members", chamaBId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "user-chair-a")
    void chamaListOnlyReturnsChamasTheCallerBelongsTo() {
        given()
            .when().get("/api/chamas")
            .then()
                .statusCode(200)
                .body("size()", equalTo(1))
                .body("[0].id", equalTo(chamaAId.intValue()));
    }

    @Test
    @TestSecurity(user = "user-chair-a")
    void chairOfChamaACannotUpdateChamaB() {
        var body = """
            {"name":"Hijacked","type":"MERRY_GO_ROUND","contributionFrequency":"MONTHLY",
             "contributionAmount":1,"creatorFullName":"x","creatorPhone":"x"}
            """;
        given()
            .contentType("application/json")
            .body(body)
            .when().put("/api/chamas/{id}", chamaBId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "user-chair-a")
    void chairOfChamaACannotDeleteChamaB() {
        given()
            .when().delete("/api/chamas/{id}", chamaBId)
            .then().statusCode(403);

        // Chama B must still exist, the forbidden call must not have deleted it.
        given()
            .when().get("/api/chamas/{id}", chamaBId)
            .then().statusCode(403); // still 403 for chair-a, not 404, proving it was not deleted
    }

    @Test
    @TestSecurity(user = "user-member-a")
    void plainMemberCannotAddMembers() {
        var body = """
            {"email":"intruder@example.com","fullName":"Intruder","phone":"254700000099","roles":["MEMBER"]}
            """;
        given()
            .contentType("application/json")
            .body(body)
            .when().post("/api/chamas/{chamaId}/members", chamaAId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "user-member-a")
    void plainMemberCannotListContributions() {
        given()
            .when().get("/api/chamas/{chamaId}/contributions", chamaAId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "user-member-a")
    void plainMemberCanSeeOwnContributionsViaMineEndpoint() {
        given()
            .when().get("/api/chamas/{chamaId}/contributions/mine", chamaAId)
            .then()
                .statusCode(200)
                .body("size()", equalTo(0));
    }

    @Test
    @TestSecurity(user = "stranger")
    void nonMemberCannotReadEitherChama() {
        given().when().get("/api/chamas/{id}", chamaAId).then().statusCode(403);
        given().when().get("/api/chamas/{id}", chamaBId).then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "stranger")
    void nonMemberSeesEmptyChamaList() {
        given()
            .when().get("/api/chamas")
            .then()
                .statusCode(200)
                .body("size()", equalTo(0));
    }

    @Test
    @TestSecurity(user = "platform-owner", roles = "SUPER_ADMIN")
    void superAdminBypassesTenantScopingForBothChamas() {
        given().when().get("/api/chamas/{id}", chamaAId).then().statusCode(200);
        given().when().get("/api/chamas/{id}", chamaBId).then().statusCode(200);
        given()
            .when().get("/api/chamas")
            .then().statusCode(200).body("size()", equalTo(2));
    }

    @Test
    void anonymousCallerIsRejected() {
        given().when().get("/api/chamas").then().statusCode(401);
    }
}
