package org.chama.rest;

import io.quarkus.mailer.Mail;
import io.quarkus.mailer.MockMailbox;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import jakarta.inject.Inject;
import org.chama.domain.enums.ChamaStatus;
import org.chama.domain.enums.ChamaType;
import org.chama.domain.enums.ContributionFrequency;
import org.chama.domain.enums.MemberRoleType;
import org.chama.domain.model.Chama;
import org.chama.domain.model.Contribution;
import org.chama.domain.model.Member;
import org.chama.domain.model.MemberRole;
import org.chama.repository.ApprovalRepository;
import org.chama.repository.ChamaRepository;
import org.chama.repository.ContributionRepository;
import org.chama.repository.DocumentDeliveryAttemptRepository;
import org.chama.repository.GeneratedDocumentRepository;
import org.chama.repository.LoanDisbursementRepository;
import org.chama.repository.LoanRepaymentRepository;
import org.chama.repository.LoanRepository;
import org.chama.repository.MemberRepository;
import org.chama.repository.WelfareContributionRepository;
import org.chama.repository.WelfareFundRepository;
import org.chama.repository.WelfareWithdrawalRepository;
import org.chama.repository.MemberRoleRepository;
import org.chama.repository.MeetingAttendanceRepository;
import org.chama.repository.MeetingRepository;
import org.chama.repository.PaymentRepository;
import org.chama.repository.PayoutRepository;
import org.chama.repository.PayoutScheduleRepository;
import org.chama.repository.PenaltyRepository;
import org.chama.repository.ActivityLogRepository;
import org.chama.service.KeycloakAdminService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;

import static io.restassured.RestAssured.given;
import static org.awaitility.Awaitility.await;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@QuarkusTest
class MemberResourceTest {

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

    @InjectMock
    KeycloakAdminService keycloakAdminService;

    @Inject
    MockMailbox mailbox;

    @Inject
    PaymentRepository paymentRepository;

    private Long chamaId;
    private Long chairId;

    @BeforeEach
    void seed() throws Exception {
        mailbox.clear();
        Mockito.when(keycloakAdminService.findUserByEmail(Mockito.anyString())).thenReturn(null);
        Mockito.when(keycloakAdminService.generateTempPassword()).thenReturn("Temp1234!");
        Mockito.when(keycloakAdminService.createUser(Mockito.anyString(), Mockito.anyString(), Mockito.anyString()))
            .thenReturn("kc-generated-id");

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
            paymentRepository.deleteAll();
            contributionRepository.deleteAll();
            approvalRepository.deleteAll();
            welfareWithdrawalRepository.deleteAll();
            welfareContributionRepository.deleteAll();
            welfareFundRepository.deleteAll();
            memberRoleRepository.deleteAll();
            memberRepository.deleteAll();
            activityLogRepository.deleteAll();
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
            chairId = chair.id;
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
            {"email":"new.member@example.com","fullName":"New Member","phone":"254700000002","roles":["MEMBER"]}
            """;
        int memberId = given()
            .contentType("application/json")
            .body(createBody)
            .when().post("/api/chamas/{chamaId}/members", chamaId)
            .then()
                .statusCode(201)
                .body("member.fullName", equalTo("New Member"))
                .body("temporaryPassword", equalTo("Temp1234!"))
                .extract().path("member.id");

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
    void deletingAMemberWithContributionHistoryIsRejectedInsteadOfCrashing() {
        Long memberWithHistoryId = QuarkusTransaction.requiringNew().call(() -> {
            Member member = new Member();
            member.chama = chamaRepository.findById(chamaId);
            member.keycloakUserId = "member-with-history";
            member.fullName = "Has History";
            member.phone = "254700000099";
            member.status = org.chama.domain.enums.MemberStatus.ACTIVE;
            memberRepository.persist(member);

            Contribution contribution = new Contribution();
            contribution.chama = chamaRepository.findById(chamaId);
            contribution.member = member;
            contribution.period = LocalDate.of(2026, 1, 1);
            contribution.amountDue = new BigDecimal("500");
            contributionRepository.persist(contribution);

            return member.id;
        });

        given()
            .when().delete("/api/chamas/{chamaId}/members/{id}", chamaId, memberWithHistoryId)
            .then().statusCode(400);

        given()
            .when().get("/api/chamas/{chamaId}/members/{id}", chamaId, memberWithHistoryId)
            .then().statusCode(200);
    }

    @Test
    @TestSecurity(user = "chair-1")
    void sendsACredentialEmailWhenANewAccountIsProvisioned() {
        String createBody = """
            {"email":"emailed.member@example.com","fullName":"Emailed Member","phone":"254700000008","roles":["MEMBER"]}
            """;
        given()
            .contentType("application/json")
            .body(createBody)
            .when().post("/api/chamas/{chamaId}/members", chamaId)
            .then().statusCode(201);

        // MemberInvitationEmailService sends off the request thread (see its
        // class comment), so the mailbox is populated shortly after, not
        // necessarily by the time the create request returns.
        await().atMost(Duration.ofSeconds(5)).untilAsserted(() -> {
            List<Mail> sent = mailbox.getMailsSentTo("emailed.member@example.com");
            assertEquals(1, sent.size());
            Mail mail = sent.get(0);
            assertEquals("Your Webchama account is ready", mail.getSubject());
            assertTrue(mail.getHtml().contains("Emailed"));
            assertTrue(mail.getHtml().contains("Temp1234!"));
            assertTrue(mail.getHtml().contains("emailed.member@example.com"));
        });
    }

    @Test
    @TestSecurity(user = "chair-1")
    void doesNotSendACredentialEmailWhenReusingAnExistingAccount() throws Exception {
        Mockito.when(keycloakAdminService.findUserByEmail("no.new.email@example.com")).thenReturn("kc-existing-id");

        String createBody = """
            {"email":"no.new.email@example.com","fullName":"No New Email","phone":"254700000009","roles":["MEMBER"]}
            """;
        given()
            .contentType("application/json")
            .body(createBody)
            .when().post("/api/chamas/{chamaId}/members", chamaId)
            .then().statusCode(201);

        assertEquals(0, mailbox.getMailsSentTo("no.new.email@example.com").size());
    }

    @Test
    @TestSecurity(user = "chair-1")
    void resendInviteResetsThePasswordAndReSendsTheCredentialEmail() throws Exception {
        String createBody = """
            {"email":"resend.member@example.com","fullName":"Resend Member","phone":"254700000010","roles":["MEMBER"]}
            """;
        int memberId = given()
            .contentType("application/json")
            .body(createBody)
            .when().post("/api/chamas/{chamaId}/members", chamaId)
            .then().statusCode(201)
            .extract().path("member.id");

        Mockito.when(keycloakAdminService.getUserEmail("kc-generated-id")).thenReturn("resend.member@example.com");
        Mockito.when(keycloakAdminService.generateTempPassword()).thenReturn("Resent5678!");

        given()
            .when().post("/api/chamas/{chamaId}/members/{id}/resend-invite", chamaId, memberId)
            .then()
                .statusCode(200)
                .body("member.id", equalTo(memberId))
                .body("temporaryPassword", equalTo("Resent5678!"));

        Mockito.verify(keycloakAdminService).resetPassword("kc-generated-id", "Resent5678!");

        await().atMost(Duration.ofSeconds(5)).untilAsserted(() -> {
            List<Mail> sent = mailbox.getMailsSentTo("resend.member@example.com");
            assertEquals(2, sent.size());
            assertTrue(sent.get(1).getHtml().contains("Resent5678!"));
        });
    }

    @Test
    @TestSecurity(user = "not-a-member")
    void onlyAChairpersonCanResendAnInvite() {
        int memberId = QuarkusTransaction.requiringNew().call(() -> {
            Member member = new Member();
            member.chama = chamaRepository.findById(chamaId);
            member.keycloakUserId = "guarded-kc-id";
            member.fullName = "Guarded Member";
            member.phone = "254700000011";
            member.status = org.chama.domain.enums.MemberStatus.ACTIVE;
            memberRepository.persist(member);
            return member.id.intValue();
        });

        given()
            .when().post("/api/chamas/{chamaId}/members/{id}/resend-invite", chamaId, memberId)
            .then().statusCode(403);
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
    void chairpersonCanViewAnyMembersCreditScore() {
        given()
            .when().get("/api/chamas/{chamaId}/members/{id}/credit-score", chamaId, chairId)
            .then()
                .statusCode(200)
                .body("memberId", equalTo(chairId.intValue()))
                // Nothing has been recorded for this member, so there is no number to report.
                .body("score", nullValue())
                .body("band", equalTo("INSUFFICIENT_HISTORY"));
    }

    @Test
    @TestSecurity(user = "chair-1")
    void chairpersonCanReadEveryScoreInOneRequest() {
        given()
            .when().get("/api/chamas/{chamaId}/members/credit-scores", chamaId)
            .then()
                .statusCode(200)
                .body("size()", greaterThan(0))
                .body("memberId", hasItem(chairId.intValue()));
    }

    @Test
    @TestSecurity(user = "scores-plain-member")
    void aPlainMemberCannotReadTheWholeChamasScores() {
        QuarkusTransaction.requiringNew().run(() -> {
            Member plain = new Member();
            plain.chama = chamaRepository.findById(chamaId);
            plain.keycloakUserId = "scores-plain-member";
            plain.fullName = "Scores Plain Member";
            plain.phone = "254700000009";
            memberRepository.persist(plain);
            MemberRole role = new MemberRole();
            role.member = plain;
            role.role = MemberRoleType.MEMBER;
            role.persist();
        });

        // Their own score is theirs to see. Everyone's, side by side, is treasury information.
        given()
            .when().get("/api/chamas/{chamaId}/members/credit-scores", chamaId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "new-member")
    void aPlainMemberCanViewTheirOwnCreditScoreButNotAnotherMembers() {
        Long plainId = QuarkusTransaction.requiringNew().call(() -> {
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
            return plain.id;
        });

        given()
            .when().get("/api/chamas/{chamaId}/members/{id}/credit-score", chamaId, plainId)
            .then().statusCode(200);

        given()
            .when().get("/api/chamas/{chamaId}/members/{id}/credit-score", chamaId, chairId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "chair-1")
    void chairpersonCanSuspendAndReactivateAMember() {
        String createBody = """
            {"email":"status.member@example.com","fullName":"Status Member","phone":"254700000004","roles":["MEMBER"]}
            """;
        int memberId = given()
            .contentType("application/json")
            .body(createBody)
            .when().post("/api/chamas/{chamaId}/members", chamaId)
            .then()
                .statusCode(201)
                .extract().path("member.id");

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
    @TestSecurity(user = "chair-1")
    void invitingAnEmailThatAlreadyHasAKeycloakAccountReusesItWithoutANewPassword() throws Exception {
        Mockito.when(keycloakAdminService.findUserByEmail("existing@example.com")).thenReturn("kc-existing-id");

        String createBody = """
            {"email":"existing@example.com","fullName":"Existing Person","phone":"254700000006","roles":["MEMBER"]}
            """;
        given()
            .contentType("application/json")
            .body(createBody)
            .when().post("/api/chamas/{chamaId}/members", chamaId)
            .then()
                .statusCode(201)
                .body("member.fullName", equalTo("Existing Person"))
                .body("temporaryPassword", equalTo(null));

        Mockito.verify(keycloakAdminService, Mockito.never()).createUser(Mockito.anyString(), Mockito.anyString(), Mockito.anyString());
    }

    @Test
    @TestSecurity(user = "chair-1")
    void surfacesAFriendlyErrorWhenKeycloakProvisioningFails() throws Exception {
        Mockito.when(keycloakAdminService.findUserByEmail(Mockito.anyString()))
            .thenThrow(new RuntimeException("Keycloak unreachable"));

        String createBody = """
            {"email":"broken@example.com","fullName":"Broken Person","phone":"254700000007","roles":["MEMBER"]}
            """;
        given()
            .contentType("application/json")
            .body(createBody)
            .when().post("/api/chamas/{chamaId}/members", chamaId)
            .then()
                .statusCode(502)
                .body("userMessage", equalTo("Could not create the member's account right now. Try again shortly."));
    }

    @Test
    @TestSecurity(user = "chair-1")
    void memberCanOptInAndOutOfAutoPay() {
        given()
            .contentType("application/json")
            .body("{\"autoPayEnabled\":true}")
            .when().put("/api/chamas/{chamaId}/members/mine/auto-pay", chamaId)
            .then()
                .statusCode(200)
                .body("autoPayEnabled", equalTo(true));

        given()
            .contentType("application/json")
            .body("{\"autoPayEnabled\":false}")
            .when().put("/api/chamas/{chamaId}/members/mine/auto-pay", chamaId)
            .then()
                .statusCode(200)
                .body("autoPayEnabled", equalTo(false));
    }

    @Test
    @TestSecurity(user = "not-a-member")
    void nonMemberCannotToggleAutoPay() {
        given()
            .contentType("application/json")
            .body("{\"autoPayEnabled\":true}")
            .when().put("/api/chamas/{chamaId}/members/mine/auto-pay", chamaId)
            .then().statusCode(403);
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

    @Test
    @TestSecurity(user = "chair-1")
    void aMemberCanExportTheirOwnData() {
        given()
            .when().get("/api/chamas/{chamaId}/members/mine/export", chamaId)
            .then()
                .statusCode(200)
                .body("profile.fullName", equalTo("Chair One"))
                .body("contributions", equalTo(List.of()))
                .body("loans", equalTo(List.of()));
    }

    @Test
    @TestSecurity(user = "not-a-member")
    void nonMemberCannotExportData() {
        given()
            .when().get("/api/chamas/{chamaId}/members/mine/export", chamaId)
            .then().statusCode(403);
    }
}
