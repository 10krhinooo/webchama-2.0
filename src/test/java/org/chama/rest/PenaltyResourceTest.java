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
import org.chama.domain.model.Penalty;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;

@QuarkusTest
class PenaltyResourceTest {

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

    private Long chamaId;
    private Long treasurerId;
    private Long memberId;
    private Long otherMemberId;

    @BeforeEach
    void seed() {
        QuarkusTransaction.requiringNew().run(() -> {
            paymentRepository.deleteAll();
            meetingAttendanceRepository.deleteAll();
            meetingRepository.deleteAll();
            penaltyRepository.deleteAll();
            payoutRepository.deleteAll();
            payoutScheduleRepository.deleteAll();
            loanRepaymentRepository.deleteAll();
            loanRepository.deleteAll();
            contributionRepository.deleteAll();
            memberRoleRepository.deleteAll();
            memberRepository.deleteAll();
            chamaRepository.deleteAll();

            Chama chama = new Chama();
            chama.name = "Penalty Test Chama";
            chama.type = ChamaType.TABLE_BANKING;
            chama.currency = "KES";
            chama.contributionFrequency = ContributionFrequency.MONTHLY;
            chama.contributionAmount = new BigDecimal("500");
            chama.status = ChamaStatus.ACTIVE;
            chamaRepository.persist(chama);
            chamaId = chama.id;

            Member treasurer = new Member();
            treasurer.chama = chama;
            treasurer.keycloakUserId = "penalty-treasurer-1";
            treasurer.fullName = "Treasurer One";
            treasurer.phone = "254700000301";
            treasurer.status = MemberStatus.ACTIVE;
            memberRepository.persist(treasurer);
            MemberRole treasurerRole = new MemberRole();
            treasurerRole.member = treasurer;
            treasurerRole.role = MemberRoleType.TREASURER;
            treasurerRole.persist();
            treasurerId = treasurer.id;

            Member member = new Member();
            member.chama = chama;
            member.keycloakUserId = "penalty-member-1";
            member.fullName = "Member One";
            member.phone = "254700000302";
            member.status = MemberStatus.ACTIVE;
            memberRepository.persist(member);
            MemberRole memberRole = new MemberRole();
            memberRole.member = member;
            memberRole.role = MemberRoleType.MEMBER;
            memberRole.persist();
            memberId = member.id;

            Member other = new Member();
            other.chama = chama;
            other.keycloakUserId = "penalty-other-1";
            other.fullName = "Other Member";
            other.phone = "254700000303";
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
    @TestSecurity(user = "penalty-treasurer-1")
    void treasurerCanImposeAPenalty() {
        String body = String.format("{\"memberId\":%d,\"reason\":\"LATE_CONTRIBUTION\",\"amount\":100}", memberId);

        given()
            .contentType("application/json")
            .body(body)
            .when().post("/api/chamas/{chamaId}/penalties", chamaId)
            .then()
                .statusCode(201)
                .body("status", equalTo("PENDING"))
                .body("memberId", equalTo(memberId.intValue()))
                .body("reason", equalTo("LATE_CONTRIBUTION"));
    }

    @Test
    @TestSecurity(user = "penalty-member-1")
    void memberCannotImposeAPenalty() {
        String body = String.format("{\"memberId\":%d,\"reason\":\"MISSED_MEETING\",\"amount\":50}", otherMemberId);

        given()
            .contentType("application/json")
            .body(body)
            .when().post("/api/chamas/{chamaId}/penalties", chamaId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "penalty-treasurer-1")
    void treasurerCanApproveAPendingPenaltyButNotTwice() {
        String body = String.format("{\"memberId\":%d,\"reason\":\"MISSED_MEETING\",\"amount\":50}", memberId);
        int penaltyId = given().contentType("application/json").body(body)
            .when().post("/api/chamas/{chamaId}/penalties", chamaId)
            .then().statusCode(201).extract().path("id");

        given()
            .when().put("/api/chamas/{chamaId}/penalties/{id}/approve", chamaId, penaltyId)
            .then()
                .statusCode(200)
                .body("status", equalTo("APPROVED"))
                .body("decidedByName", equalTo("Treasurer One"))
                .body("decidedAt", notNullValue());

        given()
            .when().put("/api/chamas/{chamaId}/penalties/{id}/approve", chamaId, penaltyId)
            .then().statusCode(400);
    }

    @Test
    @TestSecurity(user = "penalty-treasurer-1")
    void treasurerCanWaiveAPenaltyButNotTwice() {
        String body = String.format("{\"memberId\":%d,\"reason\":\"OTHER\",\"amount\":75}", memberId);
        int penaltyId = given().contentType("application/json").body(body)
            .when().post("/api/chamas/{chamaId}/penalties", chamaId)
            .then().statusCode(201).extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"reason\":\"First-time offense, waived as a courtesy\"}")
            .when().put("/api/chamas/{chamaId}/penalties/{id}/waive", chamaId, penaltyId)
            .then()
                .statusCode(200)
                .body("status", equalTo("WAIVED"))
                .body("waiverReason", equalTo("First-time offense, waived as a courtesy"));

        given()
            .contentType("application/json")
            .body("{\"reason\":\"Again\"}")
            .when().put("/api/chamas/{chamaId}/penalties/{id}/waive", chamaId, penaltyId)
            .then().statusCode(400);
    }

    @Test
    @TestSecurity(user = "penalty-treasurer-1")
    void treasurerCanListAllPenaltiesForTheChama() {
        String body = String.format("{\"memberId\":%d,\"reason\":\"LOAN_DEFAULT\",\"amount\":200}", memberId);
        given().contentType("application/json").body(body)
            .when().post("/api/chamas/{chamaId}/penalties", chamaId)
            .then().statusCode(201);

        given()
            .when().get("/api/chamas/{chamaId}/penalties", chamaId)
            .then().statusCode(200).body("$", hasSize(1));
    }

    @Test
    @TestSecurity(user = "penalty-member-1")
    void memberCanSeeOwnPenaltiesViaMineEndpoint() {
        Long penaltyId = QuarkusTransaction.requiringNew().call(() -> {
            Penalty penalty = new Penalty();
            penalty.chama = chamaRepository.findById(chamaId);
            penalty.member = memberRepository.findById(memberId);
            penalty.reason = org.chama.domain.enums.PenaltyReason.LATE_CONTRIBUTION;
            penalty.amount = new BigDecimal("100");
            penaltyRepository.persist(penalty);
            return penalty.id;
        });

        given()
            .when().get("/api/chamas/{chamaId}/penalties/mine", chamaId)
            .then().statusCode(200).body("$", hasSize(1)).body("[0].id", equalTo(penaltyId.intValue()));
    }

    @Test
    @TestSecurity(user = "penalty-other-1")
    void anotherMemberCannotSeeSomeoneElsesPenalty() {
        Long penaltyId = QuarkusTransaction.requiringNew().call(() -> {
            Penalty penalty = new Penalty();
            penalty.chama = chamaRepository.findById(chamaId);
            penalty.member = memberRepository.findById(memberId);
            penalty.reason = org.chama.domain.enums.PenaltyReason.LATE_CONTRIBUTION;
            penalty.amount = new BigDecimal("100");
            penaltyRepository.persist(penalty);
            return penalty.id;
        });

        given()
            .when().get("/api/chamas/{chamaId}/penalties/{id}", chamaId, penaltyId)
            .then().statusCode(403);
    }
}
