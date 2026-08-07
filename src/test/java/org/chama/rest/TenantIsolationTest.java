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
import org.chama.repository.ApprovalRepository;
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
import org.chama.repository.ResolutionRepository;
import org.chama.repository.ResolutionVoteRepository;
import org.chama.repository.ActivityLogRepository;
import org.chama.repository.PaymentRepository;
import org.chama.repository.WelfareContributionRepository;
import org.chama.repository.WelfareFundRepository;
import org.chama.repository.WelfareWithdrawalRepository;
import org.junit.jupiter.api.AfterEach;
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

    @Inject
    ResolutionVoteRepository resolutionVoteRepository;

    @Inject
    ResolutionRepository resolutionRepository;

    @Inject
    PaymentRepository paymentRepository;

    @Inject
    WelfareFundRepository welfareFundRepository;

    @Inject
    WelfareContributionRepository welfareContributionRepository;

    @Inject
    WelfareWithdrawalRepository welfareWithdrawalRepository;

    private Long chamaAId;
    private Long chamaBId;

    @BeforeEach
    void seedTwoChamas() {
        QuarkusTransaction.requiringNew().run(() -> {
            resolutionVoteRepository.deleteAll();
            resolutionRepository.deleteAll();
            approvalRepository.deleteAll();
            paymentRepository.deleteAll();
            welfareWithdrawalRepository.deleteAll();
            welfareContributionRepository.deleteAll();
            welfareFundRepository.deleteAll();
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
            Member chairA = newMember(chamaA, "user-chair-a", "Chair A", "254700000001");
            memberRepository.persist(chairA);
            assignRole(chairA, MemberRoleType.CHAIRPERSON);
            Member plainA = newMember(chamaA, "user-member-a", "Member A", "254700000002");
            memberRepository.persist(plainA);
            assignRole(plainA, MemberRoleType.MEMBER);
            chamaAId = chamaA.id;

            Chama chamaB = newChama("Chama B");
            chamaRepository.persist(chamaB);
            Member chairB = newMember(chamaB, "user-chair-b", "Chair B", "254700000001");
            memberRepository.persist(chairB);
            assignRole(chairB, MemberRoleType.CHAIRPERSON);
            chamaBId = chamaB.id;
        });
    }

    // Resolution rows are the only thing this class persists that other @QuarkusTest classes'
    // own cleanup doesn't account for (they delete meeting/member, not resolution), so without
    // this an uncommitted-by-teardown resolution here fails a later class's meeting/member
    // deleteAll() with a foreign key violation, depending on which class Surefire runs next.
    @AfterEach
    void cleanupResolutions() {
        QuarkusTransaction.requiringNew().run(() -> {
            resolutionVoteRepository.deleteAll();
            resolutionRepository.deleteAll();
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

    private Member newMember(Chama chama, String keycloakUserId, String fullName, String phone) {
        Member member = new Member();
        member.chama = chama;
        member.keycloakUserId = keycloakUserId;
        member.fullName = fullName;
        member.phone = phone;
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
    void chairOfChamaACannotViewAChamaBMembersCreditScore() {
        given()
            .when().get("/api/chamas/{chamaId}/members/{id}/credit-score", chamaBId, 999)
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
    void chairOfChamaACannotGenerateAnAgmStatementForChamaB() {
        given()
            .when().post("/api/chamas/{chamaId}/documents/agm-statement?from=2026-01-01&to=2026-12-31", chamaBId)
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
    @TestSecurity(user = "user-chair-a")
    void chairOfChamaACannotListChamaBResolutions() {
        given()
            .when().get("/api/chamas/{chamaId}/resolutions", chamaBId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "user-chair-a")
    void chairOfChamaACannotReadChamaBWelfareFund() {
        given()
            .when().get("/api/chamas/{chamaId}/welfare-fund", chamaBId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "user-chair-a")
    void chairOfChamaACannotOpenAResolutionInChamaB() {
        var body = """
            {"meetingId":1,"title":"Hijacked resolution"}
            """;
        given()
            .contentType("application/json")
            .body(body)
            .when().post("/api/chamas/{chamaId}/resolutions", chamaBId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "user-chair-a")
    void chairOfChamaACannotListChamaBApprovals() {
        given()
            .when().get("/api/chamas/{chamaId}/approvals", chamaBId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "user-chair-a")
    void chairOfChamaACannotRequestApprovalForChamaB() {
        var body = """
            {"targetType":"LOAN_DISBURSEMENT","targetId":1,"memberId":1,"amount":150000}
            """;
        given()
            .contentType("application/json")
            .body(body)
            .when().post("/api/chamas/{chamaId}/approvals", chamaBId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "user-member-a")
    void plainMemberCannotReadWelfareFundSummary() {
        given()
            .when().get("/api/chamas/{chamaId}/welfare-fund", chamaAId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "user-member-a")
    void plainMemberCanSeeOwnWelfareContributionsViaMineEndpoint() {
        given()
            .when().get("/api/chamas/{chamaId}/welfare-fund/contributions/mine", chamaAId)
            .then()
                .statusCode(200)
                .body("size()", equalTo(0));
    }

    @Test
    @TestSecurity(user = "user-chair-a")
    void chairOfChamaACannotCreateWithdrawalForChamaB() {
        given()
            .contentType("application/json")
            .body("{\"amount\":10,\"reason\":\"attempted cross-tenant withdrawal\"}")
            .when().post("/api/chamas/{chamaId}/welfare-fund/withdrawals", chamaBId)
            .then().statusCode(403);
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
    void superAdminHasNoDefaultAccessToChamaDetails() {
        given().when().get("/api/chamas/{id}", chamaAId).then().statusCode(403);
        given().when().get("/api/chamas/{id}", chamaBId).then().statusCode(403);
        given()
            .when().get("/api/chamas")
            .then().statusCode(200).body("size()", equalTo(0));
    }

    @Test
    @TestSecurity(user = "user-chair-a")
    void chairOfChamaACannotToggleAutoPayForChamaB() {
        given()
            .contentType("application/json")
            .body("{\"autoPayEnabled\":true}")
            .when().put("/api/chamas/{chamaId}/members/mine/auto-pay", chamaBId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "user-chair-a")
    void chairOfChamaACannotSeeOwnStreakForChamaB() {
        given()
            .when().get("/api/chamas/{chamaId}/contributions/mine/streak", chamaBId)
            .then().statusCode(403);
    }

    @Test
    void anonymousCallerIsRejected() {
        given().when().get("/api/chamas").then().statusCode(401);
    }
}
