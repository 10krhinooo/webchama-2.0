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
import org.chama.repository.ChamaRepository;
import org.chama.repository.ContributionRepository;
import org.chama.repository.LoanRepaymentRepository;
import org.chama.repository.LoanRepository;
import org.chama.repository.MemberRepository;
import org.chama.repository.MemberRoleRepository;
import org.chama.repository.PaymentRepository;
import org.chama.repository.MeetingAttendanceRepository;
import org.chama.repository.MeetingRepository;
import org.chama.repository.PayoutRepository;
import org.chama.repository.PayoutScheduleRepository;
import org.chama.repository.PenaltyRepository;
import org.chama.service.MemberService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;

@QuarkusTest
class PayoutResourceTest {

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
    MemberService memberService;

    private Long chamaId;
    private Long treasurerId;
    private Long m1Id;
    private Long m2Id;
    private Long m3Id;

    @BeforeEach
    void seed() {
        QuarkusTransaction.requiringNew().run(() -> {
            paymentRepository.deleteAll();
            meetingAttendanceRepository.deleteAll();
            meetingRepository.deleteAll();
            penaltyRepository.deleteAll();
            payoutRepository.deleteAll();
            payoutScheduleRepository.deleteAll();
            contributionRepository.deleteAll();
            loanRepaymentRepository.deleteAll();
            loanRepository.deleteAll();
            memberRoleRepository.deleteAll();
            memberRepository.deleteAll();
            chamaRepository.deleteAll();

            Chama chama = new Chama();
            chama.name = "Payout Test Chama";
            chama.type = ChamaType.MERRY_GO_ROUND;
            chama.currency = "KES";
            chama.contributionFrequency = ContributionFrequency.MONTHLY;
            chama.contributionAmount = new BigDecimal("500");
            chama.status = ChamaStatus.ACTIVE;
            chamaRepository.persist(chama);
            chamaId = chama.id;

            Member treasurer = new Member();
            treasurer.chama = chama;
            treasurer.keycloakUserId = "payout-treasurer-1";
            treasurer.fullName = "Treasurer One";
            treasurer.phone = "254700000201";
            treasurer.status = MemberStatus.ACTIVE;
            // Latest joinDate of the four: the treasurer is an ACTIVE member too and
            // therefore also a rotation participant, deliberately placed last in
            // SENIORITY order so the m1/m2/m3 tests below stay easy to reason about.
            treasurer.joinDate = LocalDate.now();
            memberRepository.persist(treasurer);
            MemberRole treasurerRole = new MemberRole();
            treasurerRole.member = treasurer;
            treasurerRole.role = MemberRoleType.TREASURER;
            treasurerRole.persist();
            treasurerId = treasurer.id;

            Member m1 = newMember(chama, "payout-m1", "Alpha Member", "254700000202", LocalDate.now().minusYears(3));
            Member m2 = newMember(chama, "payout-m2", "Beta Member", "254700000203", LocalDate.now().minusYears(2));
            Member m3 = newMember(chama, "payout-m3", "Gamma Member", "254700000204", LocalDate.now().minusYears(1));
            m1Id = m1.id;
            m2Id = m2.id;
            m3Id = m3.id;
        });
    }

    private Member newMember(Chama chama, String keycloakUserId, String fullName, String phone, LocalDate joinDate) {
        Member member = new Member();
        member.chama = chama;
        member.keycloakUserId = keycloakUserId;
        member.fullName = fullName;
        member.phone = phone;
        member.status = MemberStatus.ACTIVE;
        member.joinDate = joinDate;
        memberRepository.persist(member);
        MemberRole role = new MemberRole();
        role.member = member;
        role.role = MemberRoleType.MEMBER;
        role.persist();
        return member;
    }

    @Test
    @TestSecurity(user = "payout-treasurer-1")
    void treasurerCanGenerateASeniorityOrderedSchedule() {
        given()
            .contentType("application/json")
            .body("{\"rotationOrderType\":\"SENIORITY\"}")
            .when().post("/api/chamas/{chamaId}/payout-schedule", chamaId)
            .then()
                .statusCode(201)
                .body("$", hasSize(4))
                .body("[0].memberId", equalTo(m1Id.intValue()))
                .body("[0].sequencePosition", equalTo(1))
                .body("[1].memberId", equalTo(m2Id.intValue()))
                .body("[1].sequencePosition", equalTo(2))
                .body("[2].memberId", equalTo(m3Id.intValue()))
                .body("[2].sequencePosition", equalTo(3))
                .body("[3].memberId", equalTo(treasurerId.intValue()))
                .body("[3].sequencePosition", equalTo(4));
    }

    @Test
    @TestSecurity(user = "payout-m1")
    void memberCannotGenerateASchedule() {
        given()
            .contentType("application/json")
            .body("{\"rotationOrderType\":\"SENIORITY\"}")
            .when().post("/api/chamas/{chamaId}/payout-schedule", chamaId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "payout-treasurer-1")
    void treasurerCanGenerateAnAgreedOrderSchedule() {
        String body = String.format(
            "{\"rotationOrderType\":\"AGREED\",\"agreedMemberIds\":[%d,%d,%d,%d]}",
            m3Id, m1Id, treasurerId, m2Id);

        given()
            .contentType("application/json")
            .body(body)
            .when().post("/api/chamas/{chamaId}/payout-schedule", chamaId)
            .then()
                .statusCode(201)
                .body("[0].memberId", equalTo(m3Id.intValue()))
                .body("[1].memberId", equalTo(m1Id.intValue()))
                .body("[2].memberId", equalTo(treasurerId.intValue()))
                .body("[3].memberId", equalTo(m2Id.intValue()));
    }

    @Test
    @TestSecurity(user = "payout-treasurer-1")
    void agreedOrderMustNameExactlyTheActiveMembers() {
        String body = String.format("{\"rotationOrderType\":\"AGREED\",\"agreedMemberIds\":[%d,%d]}", m1Id, m2Id);

        given()
            .contentType("application/json")
            .body(body)
            .when().post("/api/chamas/{chamaId}/payout-schedule", chamaId)
            .then().statusCode(400);
    }

    @Test
    @TestSecurity(user = "payout-treasurer-1")
    void regeneratingTheScheduleReplacesThePreviousOne() {
        given().contentType("application/json").body("{\"rotationOrderType\":\"SENIORITY\"}")
            .when().post("/api/chamas/{chamaId}/payout-schedule", chamaId)
            .then().statusCode(201);

        String agreedBody = String.format(
            "{\"rotationOrderType\":\"AGREED\",\"agreedMemberIds\":[%d,%d,%d,%d]}",
            m3Id, m2Id, m1Id, treasurerId);
        given().contentType("application/json").body(agreedBody)
            .when().post("/api/chamas/{chamaId}/payout-schedule", chamaId)
            .then().statusCode(201);

        given()
            .when().get("/api/chamas/{chamaId}/payout-schedule", chamaId)
            .then()
                .statusCode(200)
                .body("$", hasSize(4))
                .body("[0].memberId", equalTo(m3Id.intValue()))
                .body("[0].rotationOrderType", equalTo("AGREED"));
    }

    @Test
    @TestSecurity(user = "payout-treasurer-1")
    void creatingAPayoutRotatesThroughTheScheduleAndWrapsAround() {
        given().contentType("application/json").body("{\"rotationOrderType\":\"SENIORITY\"}")
            .when().post("/api/chamas/{chamaId}/payout-schedule", chamaId)
            .then().statusCode(201);

        given().contentType("application/json").body("{\"scheduledDate\":\"2026-08-01\"}")
            .when().post("/api/chamas/{chamaId}/payouts", chamaId)
            .then().statusCode(201)
                .body("roundNumber", equalTo(1))
                .body("memberId", equalTo(m1Id.intValue()))
                .body("amount", equalTo(2000.0f))
                .body("status", equalTo("SCHEDULED"));

        given().contentType("application/json").body("{\"scheduledDate\":\"2026-09-01\"}")
            .when().post("/api/chamas/{chamaId}/payouts", chamaId)
            .then().statusCode(201).body("memberId", equalTo(m2Id.intValue()));

        given().contentType("application/json").body("{\"scheduledDate\":\"2026-10-01\"}")
            .when().post("/api/chamas/{chamaId}/payouts", chamaId)
            .then().statusCode(201).body("memberId", equalTo(m3Id.intValue()));

        given().contentType("application/json").body("{\"scheduledDate\":\"2026-11-01\"}")
            .when().post("/api/chamas/{chamaId}/payouts", chamaId)
            .then().statusCode(201).body("memberId", equalTo(treasurerId.intValue()));

        given().contentType("application/json").body("{\"scheduledDate\":\"2026-12-01\"}")
            .when().post("/api/chamas/{chamaId}/payouts", chamaId)
            .then().statusCode(201).body("memberId", equalTo(m1Id.intValue()));
    }

    @Test
    @TestSecurity(user = "payout-treasurer-1")
    void creatingAPayoutWithoutAScheduleFails() {
        given().contentType("application/json").body("{\"scheduledDate\":\"2026-08-01\"}")
            .when().post("/api/chamas/{chamaId}/payouts", chamaId)
            .then().statusCode(400);
    }

    @Test
    @TestSecurity(user = "payout-treasurer-1")
    void treasurerCanMarkAScheduledPayoutDisbursedButNotTwice() {
        given().contentType("application/json").body("{\"rotationOrderType\":\"SENIORITY\"}")
            .when().post("/api/chamas/{chamaId}/payout-schedule", chamaId)
            .then().statusCode(201);
        int payoutId = given().contentType("application/json").body("{\"scheduledDate\":\"2026-08-01\"}")
            .when().post("/api/chamas/{chamaId}/payouts", chamaId)
            .then().statusCode(201).extract().path("id");

        given()
            .when().put("/api/chamas/{chamaId}/payouts/{id}/disburse", chamaId, payoutId)
            .then()
                .statusCode(200)
                .body("status", equalTo("DISBURSED"))
                .body("disbursedAt", notNullValue());

        given()
            .when().put("/api/chamas/{chamaId}/payouts/{id}/disburse", chamaId, payoutId)
            .then().statusCode(400);
    }

    @Test
    @TestSecurity(user = "payout-m1")
    void memberCannotCreateOrDisbursePayouts() {
        given().contentType("application/json").body("{\"scheduledDate\":\"2026-08-01\"}")
            .when().post("/api/chamas/{chamaId}/payouts", chamaId)
            .then().statusCode(403);

        given()
            .when().put("/api/chamas/{chamaId}/payouts/{id}/disburse", chamaId, 1)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "payout-m1")
    void memberCanSeeOwnPayoutButNotAnotherMembersPayout() {
        Long payoutId = QuarkusTransaction.requiringNew().call(() -> {
            var chama = chamaRepository.findById(chamaId);
            var m1 = memberRepository.findById(m1Id);
            var payout = new org.chama.domain.model.Payout();
            payout.chama = chama;
            payout.member = m1;
            payout.roundNumber = 1;
            payout.scheduledDate = LocalDate.now();
            payout.amount = new BigDecimal("1500");
            payoutRepository.persist(payout);
            return payout.id;
        });

        given()
            .when().get("/api/chamas/{chamaId}/payouts/{id}", chamaId, payoutId)
            .then().statusCode(200).body("memberId", equalTo(m1Id.intValue()));

        Long otherPayoutId = QuarkusTransaction.requiringNew().call(() -> {
            var chama = chamaRepository.findById(chamaId);
            var m2 = memberRepository.findById(m2Id);
            var payout = new org.chama.domain.model.Payout();
            payout.chama = chama;
            payout.member = m2;
            payout.roundNumber = 2;
            payout.scheduledDate = LocalDate.now();
            payout.amount = new BigDecimal("1500");
            payoutRepository.persist(payout);
            return payout.id;
        });

        given()
            .when().get("/api/chamas/{chamaId}/payouts/{id}", chamaId, otherPayoutId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "payout-treasurer-1")
    void memberExitSkipsTheirSlotAndClosesTheGapInTheRotation() {
        given().contentType("application/json").body("{\"rotationOrderType\":\"SENIORITY\"}")
            .when().post("/api/chamas/{chamaId}/payout-schedule", chamaId)
            .then().statusCode(201);

        QuarkusTransaction.requiringNew().run(() ->
            memberService.updateStatus(chamaId, m2Id, MemberStatus.EXITED));

        given()
            .when().get("/api/chamas/{chamaId}/payout-schedule", chamaId)
            .then()
                .statusCode(200)
                .body("$", hasSize(4))
                .body("find { it.memberId == " + m1Id + " }.status", equalTo("ACTIVE"))
                .body("find { it.memberId == " + m1Id + " }.sequencePosition", equalTo(1))
                .body("find { it.memberId == " + m2Id + " }.status", equalTo("SKIPPED"))
                .body("find { it.memberId == " + m3Id + " }.status", equalTo("ACTIVE"))
                .body("find { it.memberId == " + m3Id + " }.sequencePosition", equalTo(2))
                .body("find { it.memberId == " + treasurerId + " }.status", equalTo("ACTIVE"))
                .body("find { it.memberId == " + treasurerId + " }.sequencePosition", equalTo(3));

        given().contentType("application/json").body("{\"scheduledDate\":\"2026-08-01\"}")
            .when().post("/api/chamas/{chamaId}/payouts", chamaId)
            .then().statusCode(201).body("memberId", equalTo(m1Id.intValue()));

        given().contentType("application/json").body("{\"scheduledDate\":\"2026-09-01\"}")
            .when().post("/api/chamas/{chamaId}/payouts", chamaId)
            .then().statusCode(201).body("memberId", equalTo(m3Id.intValue()))
                .body("amount", equalTo(1500.0f));
    }

    @Test
    @TestSecurity(user = "payout-treasurer-1")
    void memberExitWithNoScheduleGeneratedIsANoOp() {
        QuarkusTransaction.requiringNew().run(() ->
            memberService.updateStatus(chamaId, m1Id, MemberStatus.EXITED));

        given()
            .when().get("/api/chamas/{chamaId}/payout-schedule", chamaId)
            .then().statusCode(200).body("$", hasSize(0));
    }
}
