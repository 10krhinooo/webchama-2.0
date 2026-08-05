package org.chama.rest;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import jakarta.inject.Inject;
import org.chama.domain.enums.ActivityEventType;
import org.chama.domain.enums.ChamaStatus;
import org.chama.domain.enums.ChamaType;
import org.chama.domain.enums.ContributionFrequency;
import org.chama.domain.enums.MemberRoleType;
import org.chama.domain.enums.MemberStatus;
import org.chama.domain.model.ActivityLog;
import org.chama.domain.model.Chama;
import org.chama.domain.model.Member;
import org.chama.domain.model.MemberRole;
import org.chama.repository.ActivityLogRepository;
import org.chama.repository.ApprovalRepository;
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
import org.chama.repository.WelfareContributionRepository;
import org.chama.repository.WelfareFundRepository;
import org.chama.repository.WelfareWithdrawalRepository;
import org.chama.repository.MemberRoleRepository;
import org.chama.repository.PaymentRepository;
import org.chama.repository.PayoutRepository;
import org.chama.repository.PayoutScheduleRepository;
import org.chama.repository.PenaltyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;

@QuarkusTest
class ActivityLogResourceTest {

    @Inject
    ActivityLogRepository activityLogRepository;

    @Inject
    ApprovalRepository approvalRepository;

    @Inject
    ChamaRepository chamaRepository;

    @Inject
    MemberRepository memberRepository;

    @Inject
    WelfareWithdrawalRepository welfareWithdrawalRepository;

    @Inject
    WelfareContributionRepository welfareContributionRepository;

    @Inject
    WelfareFundRepository welfareFundRepository;

    @Inject
    MemberRoleRepository memberRoleRepository;

    @Inject
    DocumentDeliveryAttemptRepository documentDeliveryAttemptRepository;

    @Inject
    GeneratedDocumentRepository generatedDocumentRepository;

    @Inject
    PaymentRepository paymentRepository;

    @Inject
    MeetingAttendanceRepository meetingAttendanceRepository;

    @Inject
    MeetingRepository meetingRepository;

    @Inject
    PenaltyRepository penaltyRepository;

    @Inject
    PayoutRepository payoutRepository;

    @Inject
    PayoutScheduleRepository payoutScheduleRepository;

    @Inject
    ContributionRepository contributionRepository;

    @Inject
    LoanRepaymentRepository loanRepaymentRepository;

    @Inject
    LoanDisbursementRepository loanDisbursementRepository;

    @Inject
    LoanRepository loanRepository;

    private Long chamaId;
    private Long otherChamaId;

    @BeforeEach
    void seed() {
        QuarkusTransaction.requiringNew().run(() -> {
            activityLogRepository.deleteAll();
            documentDeliveryAttemptRepository.deleteAll();
            generatedDocumentRepository.deleteAll();
            paymentRepository.deleteAll();
            meetingAttendanceRepository.deleteAll();
            meetingRepository.deleteAll();
            penaltyRepository.deleteAll();
            payoutRepository.deleteAll();
            payoutScheduleRepository.deleteAll();
            contributionRepository.deleteAll();
            loanRepaymentRepository.deleteAll();
            loanDisbursementRepository.deleteAll();
            loanRepository.deleteAll();
            approvalRepository.deleteAll();
            welfareWithdrawalRepository.deleteAll();
            welfareContributionRepository.deleteAll();
            welfareFundRepository.deleteAll();
            memberRoleRepository.deleteAll();
            memberRepository.deleteAll();
            chamaRepository.deleteAll();

            Chama chama = newChama("Activity Log Test Chama");
            chamaId = chama.id;
            Chama other = newChama("Other Chama");
            otherChamaId = other.id;

            newMember(chama, "activity-treasurer", MemberRoleType.TREASURER);
            newMember(chama, "activity-secretary", MemberRoleType.SECRETARY);
            newMember(chama, "activity-member", MemberRoleType.MEMBER);

            for (int i = 0; i < 3; i++) {
                ActivityLog entry = new ActivityLog();
                entry.chama = chama;
                entry.eventType = ActivityEventType.CONTRIBUTION_PAID;
                entry.description = "Entry " + i;
                activityLogRepository.persist(entry);
            }
            ActivityLog otherEntry = new ActivityLog();
            otherEntry.chama = other;
            otherEntry.eventType = ActivityEventType.MEMBER_INVITED;
            otherEntry.description = "Other chama entry";
            activityLogRepository.persist(otherEntry);
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
        chamaRepository.persist(chama);
        return chama;
    }

    private void newMember(Chama chama, String keycloakUserId, MemberRoleType roleType) {
        Member member = new Member();
        member.chama = chama;
        member.keycloakUserId = keycloakUserId;
        member.fullName = keycloakUserId;
        member.phone = "254700000300";
        member.status = MemberStatus.ACTIVE;
        member.joinDate = LocalDate.now();
        memberRepository.persist(member);
        MemberRole role = new MemberRole();
        role.member = member;
        role.role = roleType;
        role.persist();
    }

    @Test
    @TestSecurity(user = "activity-treasurer")
    void treasurerCanListTheChamasActivityLog() {
        given()
            .when().get("/api/chamas/{chamaId}/activity-log", chamaId)
            .then()
                .statusCode(200)
                .body("$", hasSize(3));
    }

    @Test
    @TestSecurity(user = "activity-secretary")
    void secretaryCanAlsoListTheActivityLog() {
        given()
            .when().get("/api/chamas/{chamaId}/activity-log", chamaId)
            .then()
                .statusCode(200)
                .body("$", hasSize(3));
    }

    @Test
    @TestSecurity(user = "activity-member")
    void aPlainMemberCannotListTheActivityLog() {
        given()
            .when().get("/api/chamas/{chamaId}/activity-log", chamaId)
            .then()
                .statusCode(403);
    }

    @Test
    @TestSecurity(user = "activity-treasurer")
    void listingIsPaged() {
        given()
            .queryParam("page", 0)
            .queryParam("size", 2)
            .when().get("/api/chamas/{chamaId}/activity-log", chamaId)
            .then()
                .statusCode(200)
                .body("$", hasSize(2));
    }

    @Test
    @TestSecurity(user = "activity-treasurer")
    void listingNeverLeaksAnotherChamasEntries() {
        given()
            .when().get("/api/chamas/{chamaId}/activity-log", chamaId)
            .then()
                .statusCode(200)
                .body("description", org.hamcrest.Matchers.not(org.hamcrest.Matchers.hasItem("Other chama entry")));
    }

    @Test
    @TestSecurity(user = "activity-treasurer")
    void treasurerCannotListAnotherChamasActivityLogByGuessingItsId() {
        given()
            .when().get("/api/chamas/{chamaId}/activity-log", otherChamaId)
            .then()
                .statusCode(403);
    }

    @Test
    @TestSecurity(user = "activity-member")
    void aPlainMemberCannotOpenTheStream() {
        given()
            .when().get("/api/chamas/{chamaId}/activity-log/stream", chamaId)
            .then()
                .statusCode(403);
    }

    @Test
    void anUnauthenticatedCallerCannotListTheActivityLog() {
        given()
            .when().get("/api/chamas/{chamaId}/activity-log", chamaId)
            .then()
                .statusCode(401);
    }
}
