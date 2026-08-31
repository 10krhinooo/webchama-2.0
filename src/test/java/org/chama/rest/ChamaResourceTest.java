package org.chama.rest;

import io.quarkus.mailer.Mail;
import io.quarkus.mailer.MockMailbox;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.chama.domain.enums.ContributionStatus;
import org.chama.domain.model.Chama;
import org.chama.domain.model.Contribution;
import org.chama.domain.model.Member;
import org.chama.domain.model.MemberRole;
import org.chama.domain.enums.MemberRoleType;
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
import org.chama.repository.MeetingAttendanceRepository;
import org.chama.repository.MeetingRepository;
import org.chama.repository.MemberRoleRepository;
import org.chama.repository.PaymentRepository;
import org.chama.repository.PayoutRepository;
import org.chama.repository.PayoutScheduleRepository;
import org.chama.repository.PenaltyRepository;
import org.chama.repository.ActivityLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;

import static io.restassured.RestAssured.given;
import static org.awaitility.Awaitility.await;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@QuarkusTest
class ChamaResourceTest {

    @Inject
    MockMailbox mailbox;

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

    @Inject
    PaymentRepository paymentRepository;

    @BeforeEach
    @Transactional
    void cleanDatabase() {
        mailbox.clear();
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
    }

    private static final String CREATE_BODY = """
        {"name":"Tumaini Chama","type":"MERRY_GO_ROUND","contributionFrequency":"MONTHLY",
         "contributionAmount":1000,"creatorFullName":"Founder","creatorPhone":"254700000000"}
        """;

    @Test
    @TestSecurity(user = "founder")
    void creatingAChamaMakesTheCreatorItsChairperson() {
        int chamaId = given()
            .contentType("application/json")
            .body(CREATE_BODY)
            .when().post("/api/chamas")
            .then()
                .statusCode(201)
                .body("name", equalTo("Tumaini Chama"))
                .extract().path("id");

        given()
            .when().get("/api/chamas/{id}/members", chamaId)
            .then()
                .statusCode(200)
                .body("[0].fullName", equalTo("Founder"))
                .body("[0].roles[0]", equalTo("CHAIRPERSON"));
    }

    @Test
    @TestSecurity(user = "founder")
    void chairpersonCanUpdateTheirOwnChama() {
        int chamaId = given()
            .contentType("application/json")
            .body(CREATE_BODY)
            .when().post("/api/chamas")
            .then().statusCode(201)
            .extract().path("id");

        var updateBody = """
            {"name":"Renamed Chama","type":"TABLE_BANKING","contributionFrequency":"WEEKLY",
             "contributionAmount":250}
            """;
        given()
            .contentType("application/json")
            .body(updateBody)
            .when().put("/api/chamas/{id}", chamaId)
            .then()
                .statusCode(200)
                .body("name", equalTo("Renamed Chama"))
                .body("type", equalTo("TABLE_BANKING"));
    }

    @Test
    @TestSecurity(user = "founder")
    void chairpersonCanDeleteTheirOwnChama() {
        int chamaId = given()
            .contentType("application/json")
            .body(CREATE_BODY)
            .when().post("/api/chamas")
            .then().statusCode(201)
            .extract().path("id");

        given().when().delete("/api/chamas/{id}", chamaId).then().statusCode(204);
        given().when().get("/api/chamas/{id}", chamaId).then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "founder")
    void deletingAChamaWithADisbursedLoanDoesNotCrashOnTheLoanDisbursementForeignKey() {
        int chamaId = given()
            .contentType("application/json")
            .body(CREATE_BODY)
            .when().post("/api/chamas")
            .then().statusCode(201)
            .extract().path("id");

        QuarkusTransaction.requiringNew().run(() -> {
            Chama chama = chamaRepository.findById((long) chamaId);

            Member borrower = new Member();
            borrower.chama = chama;
            borrower.keycloakUserId = "founder-borrower";
            borrower.fullName = "Borrower";
            borrower.phone = "254700000077";
            borrower.status = org.chama.domain.enums.MemberStatus.ACTIVE;
            memberRepository.persist(borrower);

            org.chama.domain.model.Loan loan = new org.chama.domain.model.Loan();
            loan.chama = chama;
            loan.member = borrower;
            loan.principal = new BigDecimal("3000");
            loan.interestRate = new BigDecimal("0");
            loan.interestMethod = org.chama.domain.enums.InterestMethod.FLAT;
            loan.termMonths = 3;
            loan.status = org.chama.domain.enums.LoanStatus.DISBURSED;
            loanRepository.persist(loan);

            org.chama.domain.model.LoanDisbursement disbursement = new org.chama.domain.model.LoanDisbursement();
            disbursement.loan = loan;
            disbursement.conversationId = "AG_CHAMA_DELETE_1";
            disbursement.originatorConversationId = "orig-AG_CHAMA_DELETE_1";
            disbursement.targetPhone = "254700000077";
            disbursement.amount = new BigDecimal("3000");
            disbursement.status = org.chama.domain.enums.LoanDisbursementStatus.COMPLETED;
            loanDisbursementRepository.persist(disbursement);
        });

        given().when().delete("/api/chamas/{id}", chamaId).then().statusCode(204);
    }

    @Test
    void creatingAChamaRequiresAuthentication() {
        given()
            .contentType("application/json")
            .body(CREATE_BODY)
            .when().post("/api/chamas")
            .then().statusCode(401);
    }

    @Test
    @TestSecurity(user = "founder")
    void creatingAChamaValidatesRequiredFields() {
        given()
            .contentType("application/json")
            .body("{}")
            .when().post("/api/chamas")
            .then().statusCode(400);
    }

    @Test
    @TestSecurity(user = "founder")
    void mineListsEachChamaWithTheCallersRoleInIt() {
        given()
            .contentType("application/json")
            .body(CREATE_BODY)
            .when().post("/api/chamas")
            .then().statusCode(201);

        given()
            .when().get("/api/chamas/mine")
            .then()
                .statusCode(200)
                .body("[0].name", equalTo("Tumaini Chama"))
                .body("[0].roles[0]", equalTo("CHAIRPERSON"))
                .body("[0].superAdmin", equalTo(false));
    }

    @Test
    @TestSecurity(user = "founder")
    void reminderSettingsStartSwitchedOffAndAreCreatedOnFirstRead() {
        int id = given()
            .contentType("application/json")
            .body(CREATE_BODY)
            .when().post("/api/chamas")
            .then().statusCode(201).extract().path("id");

        given()
            .when().get("/api/chamas/{id}/reminder-settings", id)
            .then()
                .statusCode(200)
                .body("enabled", equalTo(false))
                .body("daysBeforeDue", equalTo(3))
                .body("sendHour", equalTo(8));
    }

    @Test
    @TestSecurity(user = "founder")
    void aChairpersonTurnsRemindersOnAndTheSettingSticks() {
        int id = given()
            .contentType("application/json")
            .body(CREATE_BODY)
            .when().post("/api/chamas")
            .then().statusCode(201).extract().path("id");

        given()
            .contentType("application/json")
            .body("{\"enabled\":true,\"daysBeforeDue\":5,\"overdueEveryDays\":14,\"sendHour\":17}")
            .when().put("/api/chamas/{id}/reminder-settings", id)
            .then()
                .statusCode(200)
                .body("enabled", equalTo(true))
                .body("daysBeforeDue", equalTo(5));

        given()
            .when().get("/api/chamas/{id}/reminder-settings", id)
            .then().statusCode(200).body("overdueEveryDays", equalTo(14)).body("sendHour", equalTo(17));
    }

    @Test
    @TestSecurity(user = "founder")
    void reminderSettingsRejectValuesOutsideTheirBounds() {
        int id = given()
            .contentType("application/json")
            .body(CREATE_BODY)
            .when().post("/api/chamas")
            .then().statusCode(201).extract().path("id");

        // A send hour of 24 or a ninety day lead would otherwise pass validation and fail on the
        // database check constraint as a 500.
        given()
            .contentType("application/json")
            .body("{\"enabled\":true,\"daysBeforeDue\":90,\"overdueEveryDays\":7,\"sendHour\":8}")
            .when().put("/api/chamas/{id}/reminder-settings", id)
            .then().statusCode(400);

        given()
            .contentType("application/json")
            .body("{\"enabled\":true,\"daysBeforeDue\":3,\"overdueEveryDays\":7,\"sendHour\":24}")
            .when().put("/api/chamas/{id}/reminder-settings", id)
            .then().statusCode(400);
    }

    @Test
    @TestSecurity(user = "nobody")
    void aNonMemberCannotReadOrChangeReminderSettings() {
        given()
            .when().get("/api/chamas/{id}/reminder-settings", 1)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "nobody")
    void mineIsEmptyForAUserWithNoChamas() {
        given()
            .when().get("/api/chamas/mine")
            .then()
                .statusCode(200)
                .body("size()", equalTo(0));
    }

    @Test
    @TestSecurity(user = "admin", roles = "SUPER_ADMIN")
    void mineShowsRealRolesForAChamaASuperAdminActuallyFounded() {
        given()
            .contentType("application/json")
            .body(CREATE_BODY)
            .when().post("/api/chamas")
            .then().statusCode(201);

        given()
            .when().get("/api/chamas/mine")
            .then()
                .statusCode(200)
                .body("[0].superAdmin", equalTo(true))
                .body("[0].roles[0]", equalTo("CHAIRPERSON"));
    }

    @Test
    @TestSecurity(user = "admin2", roles = "SUPER_ADMIN")
    void mineIsEmptyForASuperAdminWithNoChamaMembershipOfTheirOwn() {
        given()
            .when().get("/api/chamas/mine")
            .then()
                .statusCode(200)
                .body("size()", equalTo(0));
    }

    @Test
    @TestSecurity(user = "founder")
    void savingsProgressHasNoTargetWhenNoneIsSet() {
        int chamaId = given()
            .contentType("application/json")
            .body(CREATE_BODY)
            .when().post("/api/chamas")
            .then().statusCode(201)
            .extract().path("id");

        given()
            .when().get("/api/chamas/{id}/savings-progress", chamaId)
            .then()
                .statusCode(200)
                .body("target", equalTo(null))
                .body("totalPaid", equalTo(0));
    }

    @Test
    @TestSecurity(user = "founder")
    void savingsProgressSumsAllTimeContributionsAgainstTheSetTarget() {
        int chamaId = given()
            .contentType("application/json")
            .body(CREATE_BODY)
            .when().post("/api/chamas")
            .then().statusCode(201)
            .extract().path("id");

        var updateBody = """
            {"name":"Tumaini Chama","type":"MERRY_GO_ROUND","contributionFrequency":"MONTHLY",
             "contributionAmount":1000,"savingsTarget":50000}
            """;
        given()
            .contentType("application/json")
            .body(updateBody)
            .when().put("/api/chamas/{id}", chamaId)
            .then().statusCode(200)
            .body("savingsTarget", equalTo(50000));

        QuarkusTransaction.requiringNew().run(() -> {
            Chama chama = chamaRepository.findById((long) chamaId);
            Member member = memberRepository.list("chama.id", (long) chamaId).get(0);

            Contribution first = new Contribution();
            first.chama = chama;
            first.member = member;
            first.period = LocalDate.now().minusMonths(1);
            first.amountDue = new BigDecimal("1000");
            first.amountPaid = new BigDecimal("1000");
            first.status = ContributionStatus.PAID;
            contributionRepository.persist(first);

            Contribution second = new Contribution();
            second.chama = chama;
            second.member = member;
            second.period = LocalDate.now();
            second.amountDue = new BigDecimal("1000");
            second.amountPaid = new BigDecimal("400");
            second.status = ContributionStatus.PARTIAL;
            contributionRepository.persist(second);
        });

        given()
            .when().get("/api/chamas/{id}/savings-progress", chamaId)
            .then()
                .statusCode(200)
                .body("target", equalTo(50000))
                .body("totalPaid", equalTo(1400.00f));
    }

    @Test
    @TestSecurity(user = "founder")
    void creatingAChamaGeneratesAUniqueJoinCode() {
        given()
            .contentType("application/json")
            .body(CREATE_BODY)
            .when().post("/api/chamas")
            .then()
                .statusCode(201)
                .body("joinCode", org.hamcrest.Matchers.notNullValue())
                .body("joinCode.length()", equalTo(8));
    }

    @Test
    @TestSecurity(user = "second-timer")
    void anAlreadyRegisteredUserCanJoinAnotherChamaWithItsJoinCode() {
        String joinCode = QuarkusTransaction.requiringNew().call(() -> {
            Chama chama = new Chama();
            chama.name = "Somebody Else's Chama";
            chama.type = org.chama.domain.enums.ChamaType.MERRY_GO_ROUND;
            chama.contributionFrequency = org.chama.domain.enums.ContributionFrequency.MONTHLY;
            chama.contributionAmount = new BigDecimal("500");
            chamaRepository.persist(chama);
            return chama.joinCode;
        });

        String joinBody = String.format("""
            {"joinCode":"%s","fullName":"Second Timer","phone":"254700000010"}
            """, joinCode);
        given()
            .contentType("application/json")
            .body(joinBody)
            .when().post("/api/chamas/join")
            .then()
                .statusCode(201)
                .body("fullName", equalTo("Second Timer"))
                .body("roles[0]", equalTo("MEMBER"));
    }

    @Test
    @TestSecurity(user = "founder")
    void joiningWithAnUnknownCodeReturns404() {
        String joinBody = """
            {"joinCode":"NOPE0000","fullName":"Nobody","phone":"254700000011"}
            """;
        given()
            .contentType("application/json")
            .body(joinBody)
            .when().post("/api/chamas/join")
            .then().statusCode(404);
    }

    @Test
    @TestSecurity(user = "founder")
    void joiningAChamaTheCallerAlreadyBelongsToIsRejected() {
        String joinCode = given()
            .contentType("application/json")
            .body(CREATE_BODY)
            .when().post("/api/chamas")
            .then().statusCode(201)
            .extract().path("joinCode");

        String joinBody = String.format("""
            {"joinCode":"%s","fullName":"Founder Again","phone":"254700000000"}
            """, joinCode);
        given()
            .contentType("application/json")
            .body(joinBody)
            .when().post("/api/chamas/join")
            .then().statusCode(400);
    }

    @Test
    @TestSecurity(user = "founder")
    void onlyTheChairpersonCanRegenerateTheJoinCode() {
        int chamaId = given()
            .contentType("application/json")
            .body(CREATE_BODY)
            .when().post("/api/chamas")
            .then().statusCode(201)
            .extract().path("id");
        String originalCode = given()
            .when().get("/api/chamas/{id}", chamaId)
            .then().statusCode(200)
            .extract().path("joinCode");

        String newCode = given()
            .contentType("application/json")
            .when().post("/api/chamas/{id}/join-code/regenerate", chamaId)
            .then()
                .statusCode(200)
                .extract().path("joinCode");

        org.junit.jupiter.api.Assertions.assertNotEquals(originalCode, newCode);

        String rejoinWithOldCode = String.format("""
            {"joinCode":"%s","fullName":"Late Joiner","phone":"254700000012"}
            """, originalCode);
        given()
            .contentType("application/json")
            .body(rejoinWithOldCode)
            .when().post("/api/chamas/join")
            .then().statusCode(404);
    }

    @Test
    @TestSecurity(user = "not-chairperson")
    void aNonChairpersonCannotRegenerateTheJoinCode() {
        int chamaId = QuarkusTransaction.requiringNew().call(() -> {
            Chama chama = new Chama();
            chama.name = "Somebody Else's Chama";
            chama.type = org.chama.domain.enums.ChamaType.MERRY_GO_ROUND;
            chama.contributionFrequency = org.chama.domain.enums.ContributionFrequency.MONTHLY;
            chama.contributionAmount = new BigDecimal("500");
            chamaRepository.persist(chama);
            return chama.id.intValue();
        });

        given()
            .contentType("application/json")
            .when().post("/api/chamas/{id}/join-code/regenerate", chamaId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "founder")
    void chairpersonCanEmailTheJoinCodeToAProspectiveMember() {
        int chamaId = given()
            .contentType("application/json")
            .body(CREATE_BODY)
            .when().post("/api/chamas")
            .then().statusCode(201)
            .extract().path("id");
        String joinCode = given()
            .when().get("/api/chamas/{id}", chamaId)
            .then().statusCode(200)
            .extract().path("joinCode");

        given()
            .contentType("application/json")
            .body("{\"email\":\"prospect@example.com\"}")
            .when().post("/api/chamas/{id}/join-code/invite", chamaId)
            .then().statusCode(202);

        await().atMost(Duration.ofSeconds(5)).untilAsserted(() -> {
            List<Mail> sent = mailbox.getMailsSentTo("prospect@example.com");
            assertEquals(1, sent.size());
            Mail mail = sent.get(0);
            assertTrue(mail.getSubject().contains("Tumaini Chama"));
            assertTrue(mail.getHtml().contains(joinCode));
        });
    }

    @Test
    @TestSecurity(user = "not-chairperson")
    void aNonChairpersonCannotEmailTheJoinCode() {
        int chamaId = QuarkusTransaction.requiringNew().call(() -> {
            Chama chama = new Chama();
            chama.name = "Somebody Else's Chama";
            chama.type = org.chama.domain.enums.ChamaType.MERRY_GO_ROUND;
            chama.contributionFrequency = org.chama.domain.enums.ContributionFrequency.MONTHLY;
            chama.contributionAmount = new BigDecimal("500");
            chamaRepository.persist(chama);
            return chama.id.intValue();
        });

        given()
            .contentType("application/json")
            .body("{\"email\":\"prospect@example.com\"}")
            .when().post("/api/chamas/{id}/join-code/invite", chamaId)
            .then().statusCode(403);
    }

    // A one-pixel PNG and a one-pixel JPEG, as their own leading bytes. The upload identifies an
    // image by these rather than by what the request claims, so the tests need real ones.
    private static final byte[] PNG = java.util.Base64.getDecoder().decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");

    private int createChama() {
        return given()
            .contentType("application/json")
            .body(CREATE_BODY)
            .when().post("/api/chamas")
            .then().statusCode(201)
            .extract().path("id");
    }

    @Test
    @TestSecurity(user = "founder")
    void aChamaCarriesTheDetailsItPutsOnTheDocumentsItIssues() {
        int chamaId = createChama();

        given()
            .contentType("application/json")
            .body("""
                {"name":"Tumaini Chama","type":"MERRY_GO_ROUND","contributionFrequency":"MONTHLY",
                 "contributionAmount":1000,"postalAddress":"P.O. Box 4021-00100, Nairobi",
                 "physicalAddress":"Kenyatta Avenue, Nairobi","contactPhone":"+254700111222",
                 "contactEmail":"tumaini@example.com","registrationNumber":"CBO/2019/4021"}
                """)
            .when().put("/api/chamas/{id}", chamaId)
            .then()
                .statusCode(200)
                .body("postalAddress", equalTo("P.O. Box 4021-00100, Nairobi"))
                .body("physicalAddress", equalTo("Kenyatta Avenue, Nairobi"))
                .body("contactPhone", equalTo("+254700111222"))
                .body("contactEmail", equalTo("tumaini@example.com"))
                .body("registrationNumber", equalTo("CBO/2019/4021"));
    }

    @Test
    @TestSecurity(user = "founder")
    void anEmptyDetailFieldIsStoredAsAbsentRatherThanAsBlank() {
        int chamaId = createChama();

        // An empty form field and an absent one mean the same thing, so the letterhead has one
        // case to collapse around rather than two.
        given()
            .contentType("application/json")
            .body("""
                {"name":"Tumaini Chama","type":"MERRY_GO_ROUND","contributionFrequency":"MONTHLY",
                 "contributionAmount":1000,"postalAddress":"   ","contactEmail":""}
                """)
            .when().put("/api/chamas/{id}", chamaId)
            .then()
                .statusCode(200)
                .body("postalAddress", nullValue())
                .body("contactEmail", nullValue());
    }

    @Test
    @TestSecurity(user = "founder")
    void aChairpersonUploadsAndRemovesALogo() {
        int chamaId = createChama();

        given().when().get("/api/chamas/{id}", chamaId).then().body("hasLogo", equalTo(false));
        given().when().get("/api/chamas/{id}/logo", chamaId).then().statusCode(404);

        given()
            .contentType("image/png")
            .body(PNG)
            .when().put("/api/chamas/{id}/logo", chamaId)
            .then().statusCode(200).body("hasLogo", equalTo(true));

        given()
            .when().get("/api/chamas/{id}/logo", chamaId)
            .then()
                .statusCode(200)
                .contentType("image/png")
                .header("Cache-Control", "private, max-age=300");

        given().when().delete("/api/chamas/{id}/logo", chamaId).then().statusCode(200).body("hasLogo", equalTo(false));
        given().when().get("/api/chamas/{id}/logo", chamaId).then().statusCode(404);
    }

    @Test
    @TestSecurity(user = "founder")
    void aFileThatClaimsToBeAnImageAndIsNotIsRejected() {
        int chamaId = createChama();

        // Otherwise it would be served straight back to every member of the chama with an
        // image content type on it.
        given()
            .contentType("image/png")
            .body("<html><script>alert(1)</script></html>".getBytes(java.nio.charset.StandardCharsets.UTF_8))
            .when().put("/api/chamas/{id}/logo", chamaId)
            .then().statusCode(400);
    }

    @Test
    @TestSecurity(user = "founder")
    void anOversizedLogoIsRejected() {
        int chamaId = createChama();

        byte[] tooBig = new byte[256 * 1024 + 1];
        System.arraycopy(PNG, 0, tooBig, 0, PNG.length);

        given()
            .contentType("image/png")
            .body(tooBig)
            .when().put("/api/chamas/{id}/logo", chamaId)
            .then().statusCode(400);
    }

    @Test
    @TestSecurity(user = "founder")
    void anEmptyLogoUploadIsRejected() {
        int chamaId = createChama();

        given()
            .contentType("image/png")
            .body(new byte[0])
            .when().put("/api/chamas/{id}/logo", chamaId)
            .then().statusCode(400);
    }
}
