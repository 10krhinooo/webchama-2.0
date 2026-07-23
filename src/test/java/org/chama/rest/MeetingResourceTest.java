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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;

@QuarkusTest
class MeetingResourceTest {

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

    private Long chamaId;
    private Long secretaryId;
    private Long memberId;

    @BeforeEach
    void seed() {
        QuarkusTransaction.requiringNew().run(() -> {
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
            chamaRepository.deleteAll();

            Chama chama = new Chama();
            chama.name = "Meeting Test Chama";
            chama.type = ChamaType.TABLE_BANKING;
            chama.currency = "KES";
            chama.contributionFrequency = ContributionFrequency.MONTHLY;
            chama.contributionAmount = new BigDecimal("500");
            chama.status = ChamaStatus.ACTIVE;
            chamaRepository.persist(chama);
            chamaId = chama.id;

            Member secretary = new Member();
            secretary.chama = chama;
            secretary.keycloakUserId = "meeting-secretary-1";
            secretary.fullName = "Secretary One";
            secretary.phone = "254700000401";
            secretary.status = MemberStatus.ACTIVE;
            memberRepository.persist(secretary);
            MemberRole secretaryRole = new MemberRole();
            secretaryRole.member = secretary;
            secretaryRole.role = MemberRoleType.SECRETARY;
            secretaryRole.persist();
            secretaryId = secretary.id;

            Member member = new Member();
            member.chama = chama;
            member.keycloakUserId = "meeting-member-1";
            member.fullName = "Member One";
            member.phone = "254700000402";
            member.status = MemberStatus.ACTIVE;
            memberRepository.persist(member);
            MemberRole memberRole = new MemberRole();
            memberRole.member = member;
            memberRole.role = MemberRoleType.MEMBER;
            memberRole.persist();
            memberId = member.id;
        });
    }

    @Test
    @TestSecurity(user = "meeting-secretary-1")
    void secretaryCanScheduleAMeeting() {
        given()
            .contentType("application/json")
            .body("{\"meetingDate\":\"2026-08-15\",\"agenda\":\"Discuss Q3 contributions\"}")
            .when().post("/api/chamas/{chamaId}/meetings", chamaId)
            .then()
                .statusCode(201)
                .body("agenda", equalTo("Discuss Q3 contributions"))
                .body("meetingDate", equalTo("2026-08-15"))
                .body("minutes", nullValue());
    }

    @Test
    @TestSecurity(user = "meeting-member-1")
    void memberCannotScheduleAMeeting() {
        given()
            .contentType("application/json")
            .body("{\"meetingDate\":\"2026-08-15\",\"agenda\":\"Discuss Q3 contributions\"}")
            .when().post("/api/chamas/{chamaId}/meetings", chamaId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "meeting-member-1")
    void memberCanListAndViewMeetings() {
        int meetingId = createMeetingAsSecretaryDirectly();

        given()
            .when().get("/api/chamas/{chamaId}/meetings", chamaId)
            .then().statusCode(200).body("$", hasSize(1));

        given()
            .when().get("/api/chamas/{chamaId}/meetings/{id}", chamaId, meetingId)
            .then().statusCode(200).body("id", equalTo(meetingId));
    }

    @Test
    @TestSecurity(user = "meeting-secretary-1")
    void secretaryCanFillInMinutesAfterTheMeeting() {
        int meetingId = createMeetingAsSecretary();

        given()
            .contentType("application/json")
            .body("{\"minutes\":\"Agreed to raise monthly contribution to 600.\"}")
            .when().put("/api/chamas/{chamaId}/meetings/{id}/minutes", chamaId, meetingId)
            .then()
                .statusCode(200)
                .body("minutes", equalTo("Agreed to raise monthly contribution to 600."));
    }

    @Test
    @TestSecurity(user = "meeting-member-1")
    void memberCannotFillInMinutes() {
        int meetingId = createMeetingAsSecretaryDirectly();

        given()
            .contentType("application/json")
            .body("{\"minutes\":\"Trying to sneak in edits.\"}")
            .when().put("/api/chamas/{chamaId}/meetings/{id}/minutes", chamaId, meetingId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "meeting-secretary-1")
    void secretaryCanRecordAndUpdateAttendance() {
        int meetingId = createMeetingAsSecretary();

        given()
            .contentType("application/json")
            .body("{\"status\":\"PRESENT\"}")
            .when().put("/api/chamas/{chamaId}/meetings/{id}/attendance/{memberId}", chamaId, meetingId, memberId)
            .then().statusCode(200).body("status", equalTo("PRESENT"));

        given()
            .when().get("/api/chamas/{chamaId}/meetings/{id}/attendance", chamaId, meetingId)
            .then().statusCode(200).body("$", hasSize(1)).body("[0].status", equalTo("PRESENT"));

        given()
            .contentType("application/json")
            .body("{\"status\":\"EXCUSED\"}")
            .when().put("/api/chamas/{chamaId}/meetings/{id}/attendance/{memberId}", chamaId, meetingId, memberId)
            .then().statusCode(200).body("status", equalTo("EXCUSED"));

        given()
            .when().get("/api/chamas/{chamaId}/meetings/{id}/attendance", chamaId, meetingId)
            .then().statusCode(200).body("$", hasSize(1)).body("[0].status", equalTo("EXCUSED"));
    }

    @Test
    @TestSecurity(user = "meeting-member-1")
    void memberCannotRecordAttendance() {
        int meetingId = createMeetingAsSecretaryDirectly();

        given()
            .contentType("application/json")
            .body("{\"status\":\"PRESENT\"}")
            .when().put("/api/chamas/{chamaId}/meetings/{id}/attendance/{memberId}", chamaId, meetingId, memberId)
            .then().statusCode(403);
    }

    private int createMeetingAsSecretary() {
        return given()
            .contentType("application/json")
            .body("{\"meetingDate\":\"2026-08-15\",\"agenda\":\"Discuss Q3 contributions\"}")
            .when().post("/api/chamas/{chamaId}/meetings", chamaId)
            .then().statusCode(201)
            .extract().path("id");
    }

    private int createMeetingAsSecretaryDirectly() {
        return QuarkusTransaction.requiringNew().call(() -> {
            var meeting = new org.chama.domain.model.Meeting();
            meeting.chama = chamaRepository.findById(chamaId);
            meeting.meetingDate = java.time.LocalDate.of(2026, 8, 15);
            meeting.agenda = "Discuss Q3 contributions";
            meetingRepository.persist(meeting);
            return meeting.id.intValue();
        });
    }
}
