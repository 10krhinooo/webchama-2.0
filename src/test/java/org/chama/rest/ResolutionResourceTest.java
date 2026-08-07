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
import org.chama.domain.model.Meeting;
import org.chama.domain.model.Member;
import org.chama.domain.model.MemberRole;
import org.chama.repository.ActivityLogRepository;
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
import org.chama.repository.PaymentRepository;
import org.chama.repository.PayoutRepository;
import org.chama.repository.PayoutScheduleRepository;
import org.chama.repository.PenaltyRepository;
import org.chama.repository.ResolutionRepository;
import org.chama.repository.ResolutionVoteRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;

@QuarkusTest
class ResolutionResourceTest {

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
    ResolutionVoteRepository resolutionVoteRepository;

    @Inject
    ResolutionRepository resolutionRepository;

    private Long chamaId;
    private Long meetingId;
    private Long secretaryId;
    private Long memberId;
    private Long otherMemberId;

    @BeforeEach
    void seed() {
        QuarkusTransaction.requiringNew().run(() -> {
            resolutionVoteRepository.deleteAll();
            resolutionRepository.deleteAll();
            documentDeliveryAttemptRepository.deleteAll();
            generatedDocumentRepository.deleteAll();
            paymentRepository.deleteAll();
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

            Chama chama = new Chama();
            chama.name = "Resolution Test Chama";
            chama.type = ChamaType.TABLE_BANKING;
            chama.currency = "KES";
            chama.contributionFrequency = ContributionFrequency.MONTHLY;
            chama.contributionAmount = new BigDecimal("500");
            chama.status = ChamaStatus.ACTIVE;
            chamaRepository.persist(chama);
            chamaId = chama.id;

            Meeting meeting = new Meeting();
            meeting.chama = chama;
            meeting.meetingDate = LocalDate.of(2026, 8, 15);
            meeting.agenda = "Discuss loan approvals";
            meetingRepository.persist(meeting);
            meetingId = meeting.id;

            Member secretary = new Member();
            secretary.chama = chama;
            secretary.keycloakUserId = "resolution-secretary-1";
            secretary.fullName = "Secretary One";
            secretary.phone = "254700000501";
            secretary.status = MemberStatus.ACTIVE;
            memberRepository.persist(secretary);
            MemberRole secretaryRole = new MemberRole();
            secretaryRole.member = secretary;
            secretaryRole.role = MemberRoleType.SECRETARY;
            secretaryRole.persist();
            secretaryId = secretary.id;

            Member member = new Member();
            member.chama = chama;
            member.keycloakUserId = "resolution-member-1";
            member.fullName = "Member One";
            member.phone = "254700000502";
            member.status = MemberStatus.ACTIVE;
            memberRepository.persist(member);
            MemberRole memberRole = new MemberRole();
            memberRole.member = member;
            memberRole.role = MemberRoleType.MEMBER;
            memberRole.persist();
            memberId = member.id;

            Member other = new Member();
            other.chama = chama;
            other.keycloakUserId = "resolution-member-2";
            other.fullName = "Member Two";
            other.phone = "254700000503";
            other.status = MemberStatus.ACTIVE;
            memberRepository.persist(other);
            MemberRole otherRole = new MemberRole();
            otherRole.member = other;
            otherRole.role = MemberRoleType.MEMBER;
            otherRole.persist();
            otherMemberId = other.id;

            Member third = new Member();
            third.chama = chama;
            third.keycloakUserId = "resolution-member-3";
            third.fullName = "Member Three";
            third.phone = "254700000504";
            third.status = MemberStatus.ACTIVE;
            memberRepository.persist(third);
            MemberRole thirdRole = new MemberRole();
            thirdRole.member = third;
            thirdRole.role = MemberRoleType.MEMBER;
            thirdRole.persist();
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

    @Test
    @TestSecurity(user = "resolution-secretary-1")
    void secretaryCanOpenAResolutionAgainstAMeeting() {
        String body = String.format(
            "{\"meetingId\":%d,\"title\":\"Approve loan for Member One\",\"description\":\"Show of hands\"}", meetingId);

        given()
            .contentType("application/json")
            .body(body)
            .when().post("/api/chamas/{chamaId}/resolutions", chamaId)
            .then()
                .statusCode(201)
                .body("title", equalTo("Approve loan for Member One"))
                .body("status", equalTo("OPEN"))
                .body("meetingId", equalTo(meetingId.intValue()))
                .body("openedByName", equalTo("Secretary One"))
                .body("forVotes", equalTo(0))
                .body("againstVotes", equalTo(0))
                .body("abstainVotes", equalTo(0));
    }

    @Test
    @TestSecurity(user = "resolution-member-1")
    void memberCannotOpenAResolution() {
        String body = String.format("{\"meetingId\":%d,\"title\":\"Sneaky resolution\"}", meetingId);

        given()
            .contentType("application/json")
            .body(body)
            .when().post("/api/chamas/{chamaId}/resolutions", chamaId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "resolution-secretary-1")
    void openingAResolutionAgainstAMeetingFromAnotherChamaFails() {
        Long otherMeetingId = QuarkusTransaction.requiringNew().call(() -> {
            Chama otherChama = new Chama();
            otherChama.name = "Other Chama";
            otherChama.type = ChamaType.TABLE_BANKING;
            otherChama.currency = "KES";
            otherChama.contributionFrequency = ContributionFrequency.MONTHLY;
            otherChama.contributionAmount = new BigDecimal("500");
            otherChama.status = ChamaStatus.ACTIVE;
            chamaRepository.persist(otherChama);

            Meeting otherMeeting = new Meeting();
            otherMeeting.chama = otherChama;
            otherMeeting.meetingDate = LocalDate.of(2026, 8, 20);
            otherMeeting.agenda = "Another chama's meeting";
            meetingRepository.persist(otherMeeting);
            return otherMeeting.id;
        });

        String body = String.format("{\"meetingId\":%d,\"title\":\"Cross-tenant attempt\"}", otherMeetingId);

        given()
            .contentType("application/json")
            .body(body)
            .when().post("/api/chamas/{chamaId}/resolutions", chamaId)
            .then().statusCode(404);
    }

    @Test
    @TestSecurity(user = "resolution-member-1")
    void memberCanListAndViewResolutions() {
        int resolutionId = openResolutionDirectly();

        given()
            .when().get("/api/chamas/{chamaId}/resolutions", chamaId)
            .then().statusCode(200).body("$", hasSize(1));

        given()
            .when().get("/api/chamas/{chamaId}/resolutions/{id}", chamaId, resolutionId)
            .then().statusCode(200).body("id", equalTo(resolutionId));
    }

    @Test
    @TestSecurity(user = "resolution-member-1")
    void memberCanCastAVoteButNotTwice() {
        int resolutionId = openResolutionDirectly();

        given()
            .contentType("application/json")
            .body("{\"choice\":\"FOR\"}")
            .when().post("/api/chamas/{chamaId}/resolutions/{id}/votes", chamaId, resolutionId)
            .then().statusCode(201).body("forVotes", equalTo(1));

        given()
            .contentType("application/json")
            .body("{\"choice\":\"AGAINST\"}")
            .when().post("/api/chamas/{chamaId}/resolutions/{id}/votes", chamaId, resolutionId)
            .then().statusCode(400);
    }

    @Test
    @TestSecurity(user = "resolution-member-1")
    void votesEndpointListsWhoVotedAndHow() {
        int resolutionId = openResolutionDirectly();

        given()
            .contentType("application/json")
            .body("{\"choice\":\"ABSTAIN\"}")
            .when().post("/api/chamas/{chamaId}/resolutions/{id}/votes", chamaId, resolutionId)
            .then().statusCode(201);

        given()
            .when().get("/api/chamas/{chamaId}/resolutions/{id}/votes", chamaId, resolutionId)
            .then()
                .statusCode(200)
                .body("$", hasSize(1))
                .body("[0].choice", equalTo("ABSTAIN"))
                .body("[0].memberName", equalTo("Member One"));
    }

    @Test
    @TestSecurity(user = "resolution-secretary-1")
    void secretaryCanCloseAResolutionAndItTalliesToPassed() {
        int resolutionId = openResolutionAsSecretary();
        castVote(resolutionId, "resolution-member-1", "FOR");
        castVote(resolutionId, "resolution-member-2", "FOR");
        castVote(resolutionId, "resolution-member-3", "AGAINST");

        given()
            .when().put("/api/chamas/{chamaId}/resolutions/{id}/close", chamaId, resolutionId)
            .then()
                .statusCode(200)
                .body("status", equalTo("PASSED"))
                .body("forVotes", equalTo(2))
                .body("againstVotes", equalTo(1));
    }

    @Test
    @TestSecurity(user = "resolution-secretary-1")
    void secretaryCanCloseAResolutionAndItTalliesToRejectedOnATie() {
        int resolutionId = openResolutionAsSecretary();
        castVote(resolutionId, "resolution-member-1", "AGAINST");
        castVote(resolutionId, "resolution-member-2", "AGAINST");

        given()
            .when().put("/api/chamas/{chamaId}/resolutions/{id}/close", chamaId, resolutionId)
            .then().statusCode(200).body("status", equalTo("REJECTED"));
    }

    @Test
    @TestSecurity(user = "resolution-secretary-1")
    void closingAResolutionTwiceFails() {
        int resolutionId = openResolutionAsSecretary();

        given()
            .when().put("/api/chamas/{chamaId}/resolutions/{id}/close", chamaId, resolutionId)
            .then().statusCode(200).body("status", equalTo("REJECTED"));

        given()
            .when().put("/api/chamas/{chamaId}/resolutions/{id}/close", chamaId, resolutionId)
            .then().statusCode(400);
    }

    @Test
    @TestSecurity(user = "resolution-member-1")
    void memberCannotCloseAResolution() {
        int resolutionId = openResolutionDirectly();

        given()
            .when().put("/api/chamas/{chamaId}/resolutions/{id}/close", chamaId, resolutionId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "resolution-member-1")
    void votingOnAClosedResolutionFails() {
        int resolutionId = openResolutionDirectly();
        QuarkusTransaction.requiringNew().run(() -> {
            var resolution = resolutionRepository.findById((long) resolutionId);
            resolution.status = org.chama.domain.enums.ResolutionStatus.PASSED;
        });

        given()
            .contentType("application/json")
            .body("{\"choice\":\"FOR\"}")
            .when().post("/api/chamas/{chamaId}/resolutions/{id}/votes", chamaId, resolutionId)
            .then().statusCode(400);
    }

    private int openResolutionAsSecretary() {
        String body = String.format(
            "{\"meetingId\":%d,\"title\":\"Approve loan for Member One\",\"description\":\"Show of hands\"}", meetingId);
        return given()
            .contentType("application/json")
            .body(body)
            .when().post("/api/chamas/{chamaId}/resolutions", chamaId)
            .then().statusCode(201)
            .extract().path("id");
    }

    // Same as above, but written straight through the repository layer, for tests whose fixed
    // @TestSecurity identity is a plain member rather than the secretary who would open it.
    private int openResolutionDirectly() {
        return QuarkusTransaction.requiringNew().call(() -> {
            var resolution = new org.chama.domain.model.Resolution();
            resolution.chama = chamaRepository.findById(chamaId);
            resolution.meeting = meetingRepository.findById(meetingId);
            resolution.title = "Approve loan for Member One";
            resolution.description = "Show of hands";
            resolution.openedBy = memberRepository.findById(secretaryId);
            resolutionRepository.persist(resolution);
            return resolution.id.intValue();
        });
    }

    // RestAssured's @TestSecurity identity is fixed per test method, so votes cast "as" a
    // different member than the test's own @TestSecurity user go straight through the
    // repository layer instead of a second HTTP identity.
    private void castVote(int resolutionId, String user, String choice) {
        QuarkusTransaction.requiringNew().run(() -> {
            var resolution = resolutionRepository.findById((long) resolutionId);
            var member = memberRepository.find("keycloakUserId", user).firstResult();
            var vote = new org.chama.domain.model.ResolutionVote();
            vote.resolution = resolution;
            vote.member = member;
            vote.choice = org.chama.domain.enums.VoteChoice.valueOf(choice);
            resolutionVoteRepository.persist(vote);
        });
    }
}
