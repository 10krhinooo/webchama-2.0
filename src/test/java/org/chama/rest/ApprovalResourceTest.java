package org.chama.rest;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import jakarta.inject.Inject;
import jakarta.ws.rs.BadRequestException;
import org.chama.domain.enums.ApprovalStatus;
import org.chama.domain.enums.ApprovalTargetType;
import org.chama.domain.enums.ChamaStatus;
import org.chama.domain.enums.ChamaType;
import org.chama.domain.enums.ContributionFrequency;
import org.chama.domain.enums.MemberRoleType;
import org.chama.domain.enums.MemberStatus;
import org.chama.domain.model.Approval;
import org.chama.domain.model.Chama;
import org.chama.domain.model.Member;
import org.chama.domain.model.MemberRole;
import org.chama.repository.ActivityLogRepository;
import org.chama.repository.ApprovalRepository;
import org.chama.repository.ChamaRepository;
import org.chama.repository.ContributionRepository;
import org.chama.repository.MemberRepository;
import org.chama.repository.MemberRoleRepository;
import org.chama.repository.PaymentRepository;
import org.chama.service.ApprovalService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@QuarkusTest
class ApprovalResourceTest {

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
    PaymentRepository paymentRepository;

    @Inject
    ApprovalService approvalService;

    private Long chamaId;
    private Long beneficiaryId;

    @BeforeEach
    void seed() {
        QuarkusTransaction.requiringNew().run(() -> {
            approvalRepository.deleteAll();
            paymentRepository.deleteAll();
            contributionRepository.deleteAll();
            memberRoleRepository.deleteAll();
            memberRepository.deleteAll();
            activityLogRepository.deleteAll();
            chamaRepository.deleteAll();

            Chama chama = new Chama();
            chama.name = "Approval Test Chama";
            chama.type = ChamaType.TABLE_BANKING;
            chama.currency = "KES";
            chama.contributionFrequency = ContributionFrequency.MONTHLY;
            chama.contributionAmount = new BigDecimal("500");
            chama.status = ChamaStatus.ACTIVE;
            chamaRepository.persist(chama);
            chamaId = chama.id;

            Member chairperson = new Member();
            chairperson.chama = chama;
            chairperson.keycloakUserId = "approval-chairperson-1";
            chairperson.fullName = "Chairperson One";
            chairperson.phone = "254700000401";
            chairperson.status = MemberStatus.ACTIVE;
            memberRepository.persist(chairperson);
            MemberRole chairRole = new MemberRole();
            chairRole.member = chairperson;
            chairRole.role = MemberRoleType.CHAIRPERSON;
            chairRole.persist();

            Member treasurer = new Member();
            treasurer.chama = chama;
            treasurer.keycloakUserId = "approval-treasurer-1";
            treasurer.fullName = "Treasurer One";
            treasurer.phone = "254700000402";
            treasurer.status = MemberStatus.ACTIVE;
            memberRepository.persist(treasurer);
            MemberRole treasurerRole = new MemberRole();
            treasurerRole.member = treasurer;
            treasurerRole.role = MemberRoleType.TREASURER;
            treasurerRole.persist();

            Member member = new Member();
            member.chama = chama;
            member.keycloakUserId = "approval-member-1";
            member.fullName = "Beneficiary Member";
            member.phone = "254700000403";
            member.status = MemberStatus.ACTIVE;
            memberRepository.persist(member);
            MemberRole memberRole = new MemberRole();
            memberRole.member = member;
            memberRole.role = MemberRoleType.MEMBER;
            memberRole.persist();
            beneficiaryId = member.id;
        });
    }

    private String requestBody(String reason) {
        return String.format(
            "{\"targetType\":\"LOAN_DISBURSEMENT\",\"targetId\":1,\"memberId\":%d,\"amount\":150000,\"reason\":\"%s\"}",
            beneficiaryId, reason);
    }

    @Test
    @TestSecurity(user = "approval-treasurer-1")
    void treasurerCanRequestApproval() {
        given()
            .contentType("application/json")
            .body(requestBody("Loan disbursement"))
            .when().post("/api/chamas/{chamaId}/approvals", chamaId)
            .then()
                .statusCode(201)
                .body("status", equalTo("PENDING"))
                .body("memberId", equalTo(beneficiaryId.intValue()))
                .body("firstApproverMemberId", nullValue());
    }

    @Test
    @TestSecurity(user = "approval-member-1")
    void memberCannotRequestApproval() {
        given()
            .contentType("application/json")
            .body(requestBody("Loan disbursement"))
            .when().post("/api/chamas/{chamaId}/approvals", chamaId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "approval-treasurer-1")
    void cannotOpenASecondPendingRequestForTheSameTarget() {
        given().contentType("application/json").body(requestBody("First"))
            .when().post("/api/chamas/{chamaId}/approvals", chamaId)
            .then().statusCode(201);

        given().contentType("application/json").body(requestBody("Second"))
            .when().post("/api/chamas/{chamaId}/approvals", chamaId)
            .then().statusCode(400);
    }

    @Test
    @TestSecurity(user = "approval-treasurer-1")
    void firstSignOffLeavesItPendingAndSameSignerCannotSignTwice() {
        int approvalId = given().contentType("application/json").body(requestBody("Loan disbursement"))
            .when().post("/api/chamas/{chamaId}/approvals", chamaId)
            .then().statusCode(201).extract().path("id");
        Long chairpersonId = memberRepository.find("keycloakUserId", "approval-chairperson-1").firstResult().id;

        // Requested by the treasurer, so the first sign-off must come from someone else (the
        // chairperson here); requesterCannotSignOffOnTheirOwnRequest below covers the treasurer
        // trying to sign their own request. @TestSecurity's identity is fixed per test method
        // (see ResolutionResourceTest's castVote), so the chairperson's sign-off is exercised
        // directly through the service rather than a second HTTP identity.
        Approval firstSignOff = approvalService.approve(chamaId, (long) approvalId, chairpersonId);
        assertEquals(ApprovalStatus.PENDING, firstSignOff.status);
        assertEquals(chairpersonId, firstSignOff.firstApprover.id);

        assertThrows(BadRequestException.class,
            () -> approvalService.approve(chamaId, (long) approvalId, chairpersonId));
    }

    @Test
    @TestSecurity(user = "approval-treasurer-1")
    void requesterCannotSignOffOnTheirOwnRequest() {
        int approvalId = given().contentType("application/json").body(requestBody("Loan disbursement"))
            .when().post("/api/chamas/{chamaId}/approvals", chamaId)
            .then().statusCode(201).extract().path("id");

        given()
            .when().put("/api/chamas/{chamaId}/approvals/{id}/approve", chamaId, approvalId)
            .then().statusCode(400);
    }

    @Test
    void requesterCannotProvideTheSecondSignOffEither() {
        // requestedBy = treasurer, firstApprover = chairperson (a legitimate distinct first
        // sign-off); the treasurer still can't be the one to close it out as the second signatory.
        int approvalId = seedPendingApprovalRequestedByTreasurerFirstSignedByChairperson();
        Long treasurerId = memberRepository.find("keycloakUserId", "approval-treasurer-1").firstResult().id;

        assertThrows(BadRequestException.class,
            () -> approvalService.approve(chamaId, (long) approvalId, treasurerId));
    }

    @Test
    @TestSecurity(user = "approval-chairperson-1")
    void secondDistinctSignatoryClearsTheApproval() {
        int approvalId = seedPendingApprovalWithFirstSignOffFromTreasurer();

        given()
            .when().put("/api/chamas/{chamaId}/approvals/{id}/approve", chamaId, approvalId)
            .then()
                .statusCode(200)
                .body("status", equalTo("APPROVED"))
                .body("secondApproverMemberId", notNullValue());
    }

    @Test
    @TestSecurity(user = "approval-treasurer-1")
    void eitherSignatoryCanRejectAPendingRequest() {
        int approvalId = given().contentType("application/json").body(requestBody("Loan disbursement"))
            .when().post("/api/chamas/{chamaId}/approvals", chamaId)
            .then().statusCode(201).extract().path("id");

        given()
            .when().put("/api/chamas/{chamaId}/approvals/{id}/reject", chamaId, approvalId)
            .then().statusCode(200).body("status", equalTo("REJECTED"));

        given()
            .when().put("/api/chamas/{chamaId}/approvals/{id}/approve", chamaId, approvalId)
            .then().statusCode(400);
    }

    @Test
    @TestSecurity(user = "approval-treasurer-1")
    void treasurerCanListPendingAndAllApprovals() {
        given().contentType("application/json").body(requestBody("Loan disbursement"))
            .when().post("/api/chamas/{chamaId}/approvals", chamaId)
            .then().statusCode(201);

        given()
            .when().get("/api/chamas/{chamaId}/approvals/pending", chamaId)
            .then().statusCode(200).body("$", hasSize(1));

        given()
            .when().get("/api/chamas/{chamaId}/approvals", chamaId)
            .then().statusCode(200).body("$", hasSize(1));
    }

    private int seedPendingApprovalWithFirstSignOffFromTreasurer() {
        return QuarkusTransaction.requiringNew().call(() -> {
            Member treasurer = memberRepository.find("keycloakUserId", "approval-treasurer-1").firstResult();

            Approval approval = new Approval();
            approval.chama = chamaRepository.findById(chamaId);
            approval.targetType = ApprovalTargetType.LOAN_DISBURSEMENT;
            approval.targetId = 1L;
            approval.member = memberRepository.findById(beneficiaryId);
            approval.amount = new BigDecimal("150000");
            approval.reason = "Loan disbursement";
            approval.requestedBy = treasurer;
            approval.firstApprover = treasurer;
            approval.firstApprovedAt = Instant.now();
            approvalRepository.persist(approval);
            return approval.id.intValue();
        });
    }

    private int seedPendingApprovalRequestedByTreasurerFirstSignedByChairperson() {
        return QuarkusTransaction.requiringNew().call(() -> {
            Member treasurer = memberRepository.find("keycloakUserId", "approval-treasurer-1").firstResult();
            Member chairperson = memberRepository.find("keycloakUserId", "approval-chairperson-1").firstResult();

            Approval approval = new Approval();
            approval.chama = chamaRepository.findById(chamaId);
            approval.targetType = ApprovalTargetType.LOAN_DISBURSEMENT;
            approval.targetId = 1L;
            approval.member = memberRepository.findById(beneficiaryId);
            approval.amount = new BigDecimal("150000");
            approval.reason = "Loan disbursement";
            approval.requestedBy = treasurer;
            approval.firstApprover = chairperson;
            approval.firstApprovedAt = Instant.now();
            approvalRepository.persist(approval);
            return approval.id.intValue();
        });
    }
}
