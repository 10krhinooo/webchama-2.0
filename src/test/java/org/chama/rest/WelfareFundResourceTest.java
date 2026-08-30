package org.chama.rest;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import jakarta.inject.Inject;
import org.chama.domain.enums.ChamaStatus;
import org.chama.domain.enums.ChamaType;
import org.chama.domain.enums.ContributionFrequency;
import org.chama.domain.enums.MemberRoleType;
import org.chama.domain.enums.MemberStatus;
import org.chama.domain.enums.PaymentMethod;
import org.chama.domain.enums.PaymentPurpose;
import org.chama.domain.enums.PaymentStatus;
import org.chama.domain.model.Chama;
import org.chama.domain.model.Member;
import org.chama.domain.model.MemberRole;
import org.chama.domain.model.Payment;
import org.chama.domain.model.WelfareContribution;
import org.chama.repository.ActivityLogRepository;
import jakarta.ws.rs.BadRequestException;
import org.chama.domain.enums.ApprovalTargetType;
import org.chama.repository.ApprovalRepository;
import org.chama.service.ApprovalService;
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
import org.chama.repository.WelfareContributionRepository;
import org.chama.repository.WelfareFundRepository;
import org.chama.repository.WelfareWithdrawalRepository;
import org.chama.service.FlutterwaveService;
import org.chama.service.MpesaService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.math.BigDecimal;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertThrows;

@QuarkusTest
class WelfareFundResourceTest {

    @Inject
    ActivityLogRepository activityLogRepository;

    @Inject
    ApprovalRepository approvalRepository;

    @Inject
    ApprovalService approvalService;

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
    PaymentRepository paymentRepository;

    @Inject
    WelfareFundRepository welfareFundRepository;

    @Inject
    WelfareContributionRepository welfareContributionRepository;

    @Inject
    WelfareWithdrawalRepository welfareWithdrawalRepository;

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
    MpesaService mpesaService;

    @InjectMock
    FlutterwaveService flutterwaveService;

    private Long chamaId;
    private Long memberId;
    private Long treasurerId;
    private Long chairpersonId;
    private Long secondTreasurerId;

    @BeforeEach
    void seed() {
        QuarkusTransaction.requiringNew().run(() -> {
            paymentRepository.deleteAll();
            approvalRepository.deleteAll();
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

            Chama chama = new Chama();
            chama.name = "Welfare Fund Test Chama";
            chama.type = ChamaType.MERRY_GO_ROUND;
            chama.currency = "KES";
            chama.contributionFrequency = ContributionFrequency.MONTHLY;
            chama.contributionAmount = new BigDecimal("500");
            chama.status = ChamaStatus.ACTIVE;
            chamaRepository.persist(chama);
            chamaId = chama.id;

            Member treasurer = new Member();
            treasurer.chama = chama;
            treasurer.keycloakUserId = "welfare-treasurer";
            treasurer.fullName = "Treasurer One";
            treasurer.phone = "254700000001";
            treasurer.status = MemberStatus.ACTIVE;
            memberRepository.persist(treasurer);
            MemberRole treasurerRole = new MemberRole();
            treasurerRole.member = treasurer;
            treasurerRole.role = MemberRoleType.TREASURER;
            treasurerRole.persist();
            treasurerId = treasurer.id;

            Member payer = new Member();
            payer.chama = chama;
            payer.keycloakUserId = "welfare-payer";
            payer.fullName = "Payer One";
            payer.phone = "254700000002";
            payer.status = MemberStatus.ACTIVE;
            memberRepository.persist(payer);
            MemberRole payerRole = new MemberRole();
            payerRole.member = payer;
            payerRole.role = MemberRoleType.MEMBER;
            payerRole.persist();
            memberId = payer.id;

            Member chairperson = new Member();
            chairperson.chama = chama;
            chairperson.keycloakUserId = "welfare-chairperson";
            chairperson.fullName = "Chairperson One";
            chairperson.phone = "254700000003";
            chairperson.status = MemberStatus.ACTIVE;
            memberRepository.persist(chairperson);
            MemberRole chairpersonRole = new MemberRole();
            chairpersonRole.member = chairperson;
            chairpersonRole.role = MemberRoleType.CHAIRPERSON;
            chairpersonRole.persist();
            chairpersonId = chairperson.id;

            // Dual sign-off needs two signatories who are neither of them the requester, so the
            // chama has to hold three managers for any of it to be exercisable.
            Member secondTreasurer = new Member();
            secondTreasurer.chama = chama;
            secondTreasurer.keycloakUserId = "welfare-treasurer-2";
            secondTreasurer.fullName = "Treasurer Two";
            secondTreasurer.phone = "254700000004";
            secondTreasurer.status = MemberStatus.ACTIVE;
            memberRepository.persist(secondTreasurer);
            MemberRole secondTreasurerRole = new MemberRole();
            secondTreasurerRole.member = secondTreasurer;
            secondTreasurerRole.role = MemberRoleType.TREASURER;
            secondTreasurerRole.persist();
            secondTreasurerId = secondTreasurer.id;
        });
    }

    @Test
    @TestSecurity(user = "welfare-treasurer")
    void newFundStartsAtZeroBalance() {
        given()
            .when().get("/api/chamas/{chamaId}/welfare-fund", chamaId)
            .then()
                .statusCode(200)
                .body("balance", equalTo(0.0f));
    }

    @Test
    @TestSecurity(user = "welfare-payer")
    void plainMemberCannotReadFundSummary() {
        given()
            .when().get("/api/chamas/{chamaId}/welfare-fund", chamaId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "welfare-treasurer")
    void treasurerRecordsManualContributionAndCreditsBalance() {
        String body = String.format("{\"memberId\":%d,\"amount\":300,\"method\":\"CASH\"}", memberId);

        given()
            .contentType("application/json")
            .body(body)
            .when().post("/api/chamas/{chamaId}/welfare-fund/contributions", chamaId)
            .then()
                .statusCode(201)
                .body("status", equalTo("PAID"))
                .body("amount", equalTo(300.0f))
                .body("paymentMethod", equalTo("CASH"));

        given()
            .when().get("/api/chamas/{chamaId}/welfare-fund", chamaId)
            .then()
                .statusCode(200)
                .body("balance", equalTo(300.0f));
    }

    @Test
    @TestSecurity(user = "welfare-payer")
    void memberInitiatesMpesaWelfareContribution() {
        Mockito.when(mpesaService.stkPush(Mockito.eq("254700000002"), amountOf("250"), Mockito.anyString()))
            .thenReturn("ws_CO_welfare_1");

        given()
            .contentType("application/json")
            .body("{\"amount\":250}")
            .when().post("/api/chamas/{chamaId}/welfare-fund/contributions/pay/mpesa", chamaId)
            .then()
                .statusCode(201)
                .body("status", equalTo("PENDING"))
                .body("purpose", equalTo("WELFARE"))
                .body("method", equalTo("MPESA"))
                // Not returned to the member who can trigger it, see PaymentFlowResourceTest.
                .body("providerReference", nullValue());

        given()
            .when().get("/api/chamas/{chamaId}/welfare-fund/contributions/mine", chamaId)
            .then()
                .statusCode(200)
                .body("size()", equalTo(1))
                .body("[0].status", equalTo("PENDING"))
                .body("[0].amount", equalTo(250.0f));
    }

    @Test
    @TestSecurity(user = "welfare-payer")
    void mpesaStkFailureMarksWelfarePaymentFailedAndReturnsBadRequest() {
        Mockito.when(mpesaService.stkPush(Mockito.anyString(), Mockito.any(), Mockito.anyString()))
            .thenThrow(new RuntimeException("M-Pesa STK push failed: timeout"));

        given()
            .contentType("application/json")
            .body("{\"amount\":100}")
            .when().post("/api/chamas/{chamaId}/welfare-fund/contributions/pay/mpesa", chamaId)
            .then().statusCode(400);
    }

    @Test
    @TestSecurity(user = "welfare-treasurer")
    void mpesaCallbackMarksWelfareContributionPaidAndCreditsFund() {
        Long contributionId = seedPendingWelfareContribution("ws_CO_welfare_callback", new BigDecimal("400"));
        Mockito.when(mpesaService.queryStkStatus("ws_CO_welfare_callback"))
            .thenReturn(new MpesaService.StkQueryResult("0", "The service request is processed successfully."));

        String callbackBody = "{\"Body\":{\"stkCallback\":{"
            + "\"CheckoutRequestID\":\"ws_CO_welfare_callback\",\"ResultCode\":0,\"ResultDesc\":\"Success\","
            + "\"CallbackMetadata\":{\"Item\":["
            + "{\"Name\":\"MpesaReceiptNumber\",\"Value\":\"NLJ7RT61SV\"},"
            + "{\"Name\":\"Amount\",\"Value\":400}"
            + "]}}}}";

        given()
            .contentType("application/json")
            .body(callbackBody)
            .when().post("/api/payments/mpesa-callback")
            .then().statusCode(200);

        given()
            .when().get("/api/chamas/{chamaId}/welfare-fund", chamaId)
            .then()
                .statusCode(200)
                .body("balance", equalTo(400.0f));

        given()
            .when().get("/api/chamas/{chamaId}/welfare-fund/contributions", chamaId)
            .then()
                .statusCode(200)
                .body("find { it.id == " + contributionId + " }.status", equalTo("PAID"));
    }

    @Test
    @TestSecurity(user = "welfare-treasurer")
    void treasurerCanWithdrawUpToTheAvailableBalance() {
        recordManualContribution(500);

        given()
            .contentType("application/json")
            .body("{\"amount\":200,\"reason\":\"Emergency medical expense for a member\"}")
            .when().post("/api/chamas/{chamaId}/welfare-fund/withdrawals", chamaId)
            .then()
                .statusCode(201)
                .body("amount", equalTo(200.0f))
                // Below the chama's approval threshold, so request and disbursement collapse into
                // the single step this has always been.
                .body("status", equalTo("DISBURSED"))
                .body("requestedByName", equalTo("Treasurer One"))
                .body("disbursedByName", equalTo("Treasurer One"));

        given()
            .when().get("/api/chamas/{chamaId}/welfare-fund", chamaId)
            .then()
                .statusCode(200)
                .body("balance", equalTo(300.0f));

        given()
            .when().get("/api/chamas/{chamaId}/welfare-fund/withdrawals", chamaId)
            .then()
                .statusCode(200)
                .body("size()", equalTo(1));
    }

    @Test
    @TestSecurity(user = "welfare-treasurer")
    void withdrawalExceedingBalanceIsRejected() {
        recordManualContribution(100);

        given()
            .contentType("application/json")
            .body("{\"amount\":500,\"reason\":\"Too much\"}")
            .when().post("/api/chamas/{chamaId}/welfare-fund/withdrawals", chamaId)
            .then().statusCode(400);

        given()
            .when().get("/api/chamas/{chamaId}/welfare-fund", chamaId)
            .then()
                .statusCode(200)
                .body("balance", equalTo(100.0f));
    }

    @Test
    @TestSecurity(user = "welfare-chairperson")
    void chairpersonSetsWelfareFundTarget() {
        given()
            .contentType("application/json")
            .body("{\"target\":50000}")
            .when().put("/api/chamas/{chamaId}/welfare-fund/target", chamaId)
            .then()
                .statusCode(200)
                .body("target", equalTo(50000));

        given()
            .when().get("/api/chamas/{chamaId}/welfare-fund", chamaId)
            .then()
                .statusCode(200)
                .body("target", equalTo(50000));
    }

    @Test
    @TestSecurity(user = "welfare-chairperson")
    void chairpersonClearsWelfareFundTargetWithNoBody() {
        given()
            .contentType("application/json")
            .body("{\"target\":50000}")
            .when().put("/api/chamas/{chamaId}/welfare-fund/target", chamaId)
            .then().statusCode(200);

        given()
            .contentType("application/json")
            .body("{}")
            .when().put("/api/chamas/{chamaId}/welfare-fund/target", chamaId)
            .then()
                .statusCode(200)
                .body("target", nullValue());
    }

    @Test
    @TestSecurity(user = "welfare-treasurer")
    void treasurerCannotSetWelfareFundTarget() {
        given()
            .contentType("application/json")
            .body("{\"target\":50000}")
            .when().put("/api/chamas/{chamaId}/welfare-fund/target", chamaId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "welfare-payer")
    void plainMemberCannotSetWelfareFundTarget() {
        given()
            .contentType("application/json")
            .body("{\"target\":50000}")
            .when().put("/api/chamas/{chamaId}/welfare-fund/target", chamaId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "welfare-payer")
    void plainMemberCannotCreateWithdrawal() {
        given()
            .contentType("application/json")
            .body("{\"amount\":10,\"reason\":\"x\"}")
            .when().post("/api/chamas/{chamaId}/welfare-fund/withdrawals", chamaId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "welfare-treasurer")
    void aWithdrawalAtOrAboveTheThresholdMovesNoMoneyUntilItIsSignedOff() {
        setApprovalThreshold("1000");
        recordManualContribution(5000);

        int withdrawalId = given()
            .contentType("application/json")
            .body("{\"amount\":2000,\"reason\":\"Funeral contribution for a member family\"}")
            .when().post("/api/chamas/{chamaId}/welfare-fund/withdrawals", chamaId)
            .then()
                .statusCode(201)
                .body("status", equalTo("PENDING_APPROVAL"))
                .body("disbursedByName", nullValue())
                .body("disbursedAt", nullValue())
                .extract().path("id");

        // The whole point: the fund is untouched while the request waits.
        given()
            .when().get("/api/chamas/{chamaId}/welfare-fund", chamaId)
            .then().statusCode(200).body("balance", equalTo(5000.0f));

        disbursing("pending")
            .when().put("/api/chamas/{chamaId}/welfare-fund/withdrawals/{id}/disburse", chamaId, withdrawalId)
            .then().statusCode(400);
    }

    @Test
    @TestSecurity(user = "welfare-treasurer")
    void theMemberWhoRequestedAWithdrawalCannotSignOffOnIt() {
        setApprovalThreshold("1000");
        recordManualContribution(5000);
        int withdrawalId = requestWithdrawal(2000, "Hospital bill for a member");
        Long approvalId = approvalIdFor(withdrawalId);

        // Otherwise a treasurer could request a withdrawal and immediately supply one of the two
        // signatures themselves, leaving one person between them and the fund.
        assertThrows(BadRequestException.class,
            () -> approvalService.approve(chamaId, approvalId, treasurerId));
    }

    @Test
    @TestSecurity(user = "welfare-treasurer")
    void twoSignaturesReleaseTheMoney() {
        setApprovalThreshold("1000");
        recordManualContribution(5000);
        int withdrawalId = requestWithdrawal(2000, "Hospital bill for a member");
        signOff(withdrawalId);

        disbursing("two-signatures")
            .when().put("/api/chamas/{chamaId}/welfare-fund/withdrawals/{id}/disburse", chamaId, withdrawalId)
            .then()
                .statusCode(200)
                .body("status", equalTo("DISBURSED"))
                .body("requestedByName", equalTo("Treasurer One"))
                .body("disbursedByName", equalTo("Treasurer One"));

        given()
            .when().get("/api/chamas/{chamaId}/welfare-fund", chamaId)
            .then().statusCode(200).body("balance", equalTo(3000.0f));
    }

    @Test
    @TestSecurity(user = "welfare-treasurer")
    void aWithdrawalCannotBeDisbursedTwice() {
        setApprovalThreshold("1000");
        recordManualContribution(5000);
        int withdrawalId = requestWithdrawal(2000, "Hospital bill for a member");
        signOff(withdrawalId);

        disbursing("twice")
            .when().put("/api/chamas/{chamaId}/welfare-fund/withdrawals/{id}/disburse", chamaId, withdrawalId)
            .then().statusCode(200);
        disbursing("twice")
            .when().put("/api/chamas/{chamaId}/welfare-fund/withdrawals/{id}/disburse", chamaId, withdrawalId)
            .then().statusCode(400);

        given()
            .when().get("/api/chamas/{chamaId}/welfare-fund", chamaId)
            .then().statusCode(200).body("balance", equalTo(3000.0f));
    }

    @Test
    @TestSecurity(user = "welfare-treasurer")
    void aWithdrawalDrainedWhileItWaitedIsRefusedRatherThanOverdrawingTheFund() {
        setApprovalThreshold("1000");
        recordManualContribution(5000);
        int first = requestWithdrawal(3000, "First emergency");
        int second = requestWithdrawal(3000, "Second emergency");
        signOff(first);
        signOff(second);

        disbursing("drained")
            .when().put("/api/chamas/{chamaId}/welfare-fund/withdrawals/{id}/disburse", chamaId, first)
            .then().statusCode(200);

        // Both were affordable when requested and both cleared sign-off, but the fund is a single
        // draining pot and only one of them still fits. This is why disbursement re-checks the
        // balance, which a payout does not have to.
        disbursing("drained")
            .when().put("/api/chamas/{chamaId}/welfare-fund/withdrawals/{id}/disburse", chamaId, second)
            .then().statusCode(400);

        given()
            .when().get("/api/chamas/{chamaId}/welfare-fund", chamaId)
            .then().statusCode(200).body("balance", equalTo(2000.0f));
    }

    @Test
    @TestSecurity(user = "welfare-payer")
    void aPlainMemberCannotDisburseAWithdrawal() {
        disbursing("plain-member")
            .when().put("/api/chamas/{chamaId}/welfare-fund/withdrawals/{id}/disburse", chamaId, 1)
            .then().statusCode(403);
    }

    /**
     * A caller identity unique to each test.
     *
     * <p>Disbursement endpoints are rate limited at ten a minute per client IP, and the whole suite
     * shares one loopback address, so the bucket is long gone by the time these tests run. The
     * filter honours X-Forwarded-For when the direct peer is loopback, which it is under
     * @QuarkusTest, so giving each test its own forwarded address gives it its own bucket without
     * weakening the limit itself.
     */
    private static String callerIp(String test) {
        return "198.51.100." + (Math.abs(test.hashCode()) % 200 + 1);
    }

    private void setApprovalThreshold(String threshold) {
        QuarkusTransaction.requiringNew().run(() ->
            chamaRepository.findById(chamaId).approvalThreshold = new BigDecimal(threshold));
    }

    private int requestWithdrawal(int amount, String reason) {
        return given()
            .contentType("application/json")
            .body(String.format("{\"amount\":%d,\"reason\":\"%s\"}", amount, reason))
            .when().post("/api/chamas/{chamaId}/welfare-fund/withdrawals", chamaId)
            .then().statusCode(201).extract().path("id");
    }

    /** A disburse call from an address of this test's own, see {@link #callerIp}. */
    private io.restassured.specification.RequestSpecification disbursing(String test) {
        return given().header("X-Forwarded-For", callerIp(test));
    }

    private Long approvalIdFor(int withdrawalId) {
        return QuarkusTransaction.requiringNew().call(() -> approvalRepository
            .findLatestByTarget(ApprovalTargetType.WELFARE_WITHDRAWAL, (long) withdrawalId)
            .orElseThrow().id);
    }

    /**
     * Both sign-offs, each from a different member. Driven through ApprovalService rather than the
     * REST layer because @TestSecurity fixes one identity for the whole test method, and the point
     * of dual sign-off is that two different people act.
     */
    private void signOff(int withdrawalId) {
        Long approvalId = approvalIdFor(withdrawalId);
        approvalService.approve(chamaId, approvalId, chairpersonId);
        approvalService.approve(chamaId, approvalId, secondTreasurerId);
    }

    private void recordManualContribution(int amount) {
        String body = String.format("{\"memberId\":%d,\"amount\":%d,\"method\":\"CASH\"}", memberId, amount);
        given()
            .contentType("application/json")
            .body(body)
            .when().post("/api/chamas/{chamaId}/welfare-fund/contributions", chamaId)
            .then().statusCode(201);
    }

    private Long seedPendingWelfareContribution(String providerReference, BigDecimal amount) {
        Long[] contributionId = new Long[1];
        QuarkusTransaction.requiringNew().run(() -> {
            WelfareContribution contribution = new WelfareContribution();
            contribution.chama = chamaRepository.findById(chamaId);
            contribution.member = memberRepository.findById(memberId);
            contribution.amount = amount;
            welfareContributionRepository.persist(contribution);
            contributionId[0] = contribution.id;

            Payment payment = new Payment();
            payment.chama = chamaRepository.findById(chamaId);
            payment.member = memberRepository.findById(memberId);
            payment.welfareContribution = contribution;
            payment.purpose = PaymentPurpose.WELFARE;
            payment.amount = amount;
            payment.method = PaymentMethod.MPESA;
            payment.status = PaymentStatus.PENDING;
            payment.providerReference = providerReference;
            paymentRepository.persist(payment);
        });
        return contributionId[0];
    }

    /**
     * NUMERIC(12,2) columns come back from Postgres at scale 2 (e.g. 250.00), which
     * BigDecimal.equals() treats as different from a scale-0 literal (250), even though
     * compareTo() says they're equal. Mockito's eq() uses equals(), so stub matching on amount
     * needs this instead.
     */
    private static BigDecimal amountOf(String value) {
        return org.mockito.ArgumentMatchers.argThat(actual -> actual != null && actual.compareTo(new BigDecimal(value)) == 0);
    }
}
