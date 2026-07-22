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
import org.chama.domain.model.Contribution;
import org.chama.domain.model.Member;
import org.chama.domain.model.MemberRole;
import org.chama.domain.model.Payment;
import org.chama.repository.ChamaRepository;
import org.chama.repository.ContributionRepository;
import org.chama.repository.MemberRepository;
import org.chama.repository.MemberRoleRepository;
import org.chama.repository.PaymentRepository;
import org.chama.service.FlutterwaveService;
import org.chama.service.MpesaService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.math.BigDecimal;
import java.time.LocalDate;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.startsWith;
import static org.mockito.ArgumentMatchers.argThat;

@QuarkusTest
class PaymentFlowResourceTest {

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

    @InjectMock
    MpesaService mpesaService;

    @InjectMock
    FlutterwaveService flutterwaveService;

    private Long chamaId;
    private Long payerId;
    private Long contributionId;

    @BeforeEach
    void seed() {
        QuarkusTransaction.requiringNew().run(() -> {
            paymentRepository.deleteAll();
            contributionRepository.deleteAll();
            memberRoleRepository.deleteAll();
            memberRepository.deleteAll();
            chamaRepository.deleteAll();

            Chama chama = new Chama();
            chama.name = "Payment Test Chama";
            chama.type = ChamaType.MERRY_GO_ROUND;
            chama.currency = "KES";
            chama.contributionFrequency = ContributionFrequency.MONTHLY;
            chama.contributionAmount = new BigDecimal("500");
            chama.status = ChamaStatus.ACTIVE;
            chamaRepository.persist(chama);
            chamaId = chama.id;

            Member treasurer = new Member();
            treasurer.chama = chama;
            treasurer.keycloakUserId = "treasurer-1";
            treasurer.fullName = "Treasurer One";
            treasurer.phone = "254700000001";
            treasurer.status = MemberStatus.ACTIVE;
            memberRepository.persist(treasurer);
            MemberRole treasurerRole = new MemberRole();
            treasurerRole.member = treasurer;
            treasurerRole.role = MemberRoleType.TREASURER;
            treasurerRole.persist();

            Member payer = new Member();
            payer.chama = chama;
            payer.keycloakUserId = "payer-1";
            payer.fullName = "Payer One";
            payer.phone = "254700000002";
            payer.status = MemberStatus.ACTIVE;
            memberRepository.persist(payer);
            MemberRole payerRole = new MemberRole();
            payerRole.member = payer;
            payerRole.role = MemberRoleType.MEMBER;
            payerRole.persist();
            payerId = payer.id;

            Member otherMember = new Member();
            otherMember.chama = chama;
            otherMember.keycloakUserId = "other-1";
            otherMember.fullName = "Other Member";
            otherMember.phone = "254700000003";
            otherMember.status = MemberStatus.ACTIVE;
            memberRepository.persist(otherMember);
            MemberRole otherRole = new MemberRole();
            otherRole.member = otherMember;
            otherRole.role = MemberRoleType.MEMBER;
            otherRole.persist();

            Contribution contribution = new Contribution();
            contribution.chama = chama;
            contribution.member = payer;
            contribution.period = LocalDate.of(2026, 7, 1);
            contribution.amountDue = new BigDecimal("500");
            contributionRepository.persist(contribution);
            contributionId = contribution.id;
        });
    }

    @Test
    @TestSecurity(user = "payer-1")
    void memberInitiatesMpesaStkPushForOwnContribution() {
        Mockito.when(mpesaService.stkPush(Mockito.eq("254700000002"), amountOf("500"), Mockito.anyString()))
            .thenReturn("ws_CO_123");

        given()
            .contentType("application/json")
            .when().post("/api/chamas/{chamaId}/contributions/{id}/pay/mpesa", chamaId, contributionId)
            .then()
                .statusCode(201)
                .body("status", equalTo("PENDING"))
                .body("method", equalTo("MPESA"))
                .body("providerReference", equalTo("ws_CO_123"));
    }

    @Test
    @TestSecurity(user = "other-1")
    void memberCannotInitiatePaymentForAnotherMembersContribution() {
        given()
            .contentType("application/json")
            .when().post("/api/chamas/{chamaId}/contributions/{id}/pay/mpesa", chamaId, contributionId)
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "payer-1")
    void mpesaStkFailureMarksPaymentFailedAndReturnsBadRequest() {
        Mockito.when(mpesaService.stkPush(Mockito.anyString(), Mockito.any(), Mockito.anyString()))
            .thenThrow(new RuntimeException("M-Pesa STK push failed: timeout"));

        given()
            .contentType("application/json")
            .when().post("/api/chamas/{chamaId}/contributions/{id}/pay/mpesa", chamaId, contributionId)
            .then().statusCode(400);
    }

    @Test
    @TestSecurity(user = "payer-1")
    void memberInitiatesCardPaymentForOwnContribution() {
        Mockito.when(flutterwaveService.initializePayment(
                Mockito.anyString(), amountOf("500"),
                Mockito.eq("payer@example.com"), Mockito.anyString(), Mockito.anyString()))
            .thenReturn("https://checkout.flutterwave.com/pay/abc123");

        given()
            .contentType("application/json")
            .body("{\"email\":\"payer@example.com\"}")
            .when().post("/api/chamas/{chamaId}/contributions/{id}/pay/card", chamaId, contributionId)
            .then()
                .statusCode(200)
                .body("paymentLink", equalTo("https://checkout.flutterwave.com/pay/abc123"))
                .body("txRef", startsWith("CHAMA-" + chamaId + "-C" + contributionId));
    }

    @Test
    @TestSecurity(user = "treasurer-1")
    void mpesaCallbackMarksPaymentAndContributionPaid() {
        seedPendingPayment("ws_CO_999", PaymentMethod.MPESA);

        String callbackBody = "{\"Body\":{\"stkCallback\":{"
            + "\"CheckoutRequestID\":\"ws_CO_999\",\"ResultCode\":0,\"ResultDesc\":\"Success\","
            + "\"CallbackMetadata\":{\"Item\":["
            + "{\"Name\":\"MpesaReceiptNumber\",\"Value\":\"NLJ7RT61SV\"},"
            + "{\"Name\":\"Amount\",\"Value\":500}"
            + "]}}}}";

        given()
            .contentType("application/json")
            .body(callbackBody)
            .when().post("/api/payments/mpesa-callback")
            .then().statusCode(200);

        given()
            .when().get("/api/chamas/{chamaId}/contributions/{id}", chamaId, contributionId)
            .then()
                .statusCode(200)
                .body("status", equalTo("PAID"))
                .body("amountPaid", equalTo(500.0f))
                .body("paymentMethod", equalTo("MPESA"));
    }

    @Test
    @TestSecurity(user = "treasurer-1")
    void mpesaCallbackIsIdempotentOnRetry() {
        seedPendingPayment("ws_CO_retry", PaymentMethod.MPESA);

        String callbackBody = "{\"Body\":{\"stkCallback\":{"
            + "\"CheckoutRequestID\":\"ws_CO_retry\",\"ResultCode\":0,\"ResultDesc\":\"Success\","
            + "\"CallbackMetadata\":{\"Item\":[{\"Name\":\"MpesaReceiptNumber\",\"Value\":\"NLJ7RT61SV\"}]}}}}";

        given().contentType("application/json").body(callbackBody)
            .when().post("/api/payments/mpesa-callback").then().statusCode(200);
        given().contentType("application/json").body(callbackBody)
            .when().post("/api/payments/mpesa-callback").then().statusCode(200);

        given()
            .when().get("/api/chamas/{chamaId}/contributions/{id}", chamaId, contributionId)
            .then()
                .statusCode(200)
                .body("amountPaid", equalTo(500.0f));
    }

    @Test
    @TestSecurity(user = "treasurer-1")
    void mpesaCallbackWithNonZeroResultCodeMarksPaymentFailedWithoutCreditingContribution() {
        seedPendingPayment("ws_CO_cancelled", PaymentMethod.MPESA);

        String callbackBody = "{\"Body\":{\"stkCallback\":{"
            + "\"CheckoutRequestID\":\"ws_CO_cancelled\",\"ResultCode\":1032,\"ResultDesc\":\"Cancelled\"}}}";

        given().contentType("application/json").body(callbackBody)
            .when().post("/api/payments/mpesa-callback").then().statusCode(200);

        given()
            .when().get("/api/chamas/{chamaId}/contributions/{id}", chamaId, contributionId)
            .then()
                .statusCode(200)
                .body("status", equalTo("PENDING"))
                .body("amountPaid", equalTo(0.0f));
    }

    @Test
    void mpesaCallbackForUnknownCheckoutIdIsIgnored() {
        String callbackBody = "{\"Body\":{\"stkCallback\":{"
            + "\"CheckoutRequestID\":\"unknown-id\",\"ResultCode\":0,\"ResultDesc\":\"Success\"}}}";

        given()
            .contentType("application/json")
            .body(callbackBody)
            .when().post("/api/payments/mpesa-callback")
            .then().statusCode(200);
    }

    @Test
    @TestSecurity(user = "treasurer-1")
    void flutterwaveWebhookReVerifiesServerSideBeforeMarkingContributionPaid() {
        seedPendingPayment("TXREF-CARD-1", PaymentMethod.CARD);

        Mockito.when(flutterwaveService.verifyPaymentById(Mockito.eq(77L), amountOf("500")))
            .thenReturn(true);

        given()
            .contentType("application/json")
            .header("verif-hash", "changeme")
            .body("{\"status\":\"successful\",\"tx_ref\":\"TXREF-CARD-1\",\"id\":77,\"amount\":500,\"currency\":\"KES\"}")
            .when().post("/api/payments/card/callback")
            .then().statusCode(200);

        given()
            .when().get("/api/chamas/{chamaId}/contributions/{id}", chamaId, contributionId)
            .then()
                .statusCode(200)
                .body("status", equalTo("PAID"))
                .body("paymentMethod", equalTo("CARD"));
    }

    @Test
    @TestSecurity(user = "treasurer-1")
    void flutterwaveWebhookDoesNotCreditWhenServerSideReVerificationFails() {
        seedPendingPayment("TXREF-CARD-2", PaymentMethod.CARD);

        Mockito.when(flutterwaveService.verifyPaymentById(Mockito.eq(88L), amountOf("500")))
            .thenReturn(false);

        given()
            .contentType("application/json")
            .header("verif-hash", "changeme")
            .body("{\"status\":\"successful\",\"tx_ref\":\"TXREF-CARD-2\",\"id\":88,\"amount\":500,\"currency\":\"KES\"}")
            .when().post("/api/payments/card/callback")
            .then().statusCode(200);

        given()
            .when().get("/api/chamas/{chamaId}/contributions/{id}", chamaId, contributionId)
            .then()
                .statusCode(200)
                .body("status", equalTo("PENDING"));
    }

    @Test
    void flutterwaveWebhookRejectedWithoutValidHashHeader() {
        given()
            .contentType("application/json")
            .header("verif-hash", "wrong-hash")
            .body("{\"status\":\"successful\",\"tx_ref\":\"TXREF-CARD-3\",\"id\":99,\"amount\":500,\"currency\":\"KES\"}")
            .when().post("/api/payments/card/callback")
            .then().statusCode(401);
    }

    @Test
    @TestSecurity(user = "payer-1")
    void cardPaymentInitiationFailureMarksPaymentFailedAndReturnsBadRequest() {
        Mockito.when(flutterwaveService.initializePayment(
                Mockito.anyString(), Mockito.any(), Mockito.anyString(), Mockito.anyString(), Mockito.anyString()))
            .thenThrow(new RuntimeException("Flutterwave returned HTTP 400"));

        given()
            .contentType("application/json")
            .body("{\"email\":\"payer@example.com\"}")
            .when().post("/api/chamas/{chamaId}/contributions/{id}/pay/card", chamaId, contributionId)
            .then().statusCode(400);
    }

    @Test
    @TestSecurity(user = "payer-1")
    void cannotInitiatePaymentForAnAlreadyFullyPaidContribution() {
        QuarkusTransaction.requiringNew().run(() -> {
            Contribution contribution = contributionRepository.findById(contributionId);
            contribution.amountPaid = contribution.amountDue;
        });

        given()
            .contentType("application/json")
            .when().post("/api/chamas/{chamaId}/contributions/{id}/pay/mpesa", chamaId, contributionId)
            .then().statusCode(400);
    }

    @Test
    @TestSecurity(user = "payer-1")
    void verifyCardPaymentReturnsPaidStatusFromReVerification() {
        seedPendingPayment("TXREF-CARD-verify", PaymentMethod.CARD);

        Mockito.when(flutterwaveService.verifyPaymentById(Mockito.eq(55L), amountOf("500")))
            .thenReturn(true);

        given()
            .queryParam("txRef", "TXREF-CARD-verify")
            .queryParam("transactionId", 55)
            .when().get("/api/chamas/{chamaId}/contributions/{id}/pay/card/verify", chamaId, contributionId)
            .then()
                .statusCode(200)
                .body("paid", equalTo(true));
    }

    /**
     * NUMERIC(12,2) columns come back from Postgres at scale 2 (e.g. 500.00), which
     * BigDecimal.equals() treats as different from a scale-0 literal (500), even though
     * compareTo() says they're equal. Mockito's eq() uses equals(), so stub matching on amount
     * needs this instead.
     */
    private static BigDecimal amountOf(String value) {
        return argThat(actual -> actual != null && actual.compareTo(new BigDecimal(value)) == 0);
    }

    private void seedPendingPayment(String providerReference, PaymentMethod method) {
        QuarkusTransaction.requiringNew().run(() -> {
            Payment payment = new Payment();
            payment.chama = chamaRepository.findById(chamaId);
            payment.member = memberRepository.findById(payerId);
            payment.contribution = contributionRepository.findById(contributionId);
            payment.purpose = PaymentPurpose.CONTRIBUTION;
            payment.amount = new BigDecimal("500");
            payment.method = method;
            payment.status = PaymentStatus.PENDING;
            payment.providerReference = providerReference;
            paymentRepository.persist(payment);
        });
    }
}
