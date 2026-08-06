package org.chama.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.chama.config.FlutterwaveConfig;
import org.jboss.logging.Logger;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Flutterwave Standard checkout, the diaspora-contribution channel for members without M-Pesa or
 * paying from outside Kenya.
 */
@ApplicationScoped
public class FlutterwaveService {

    private static final Logger LOG = Logger.getLogger(FlutterwaveService.class);

    @Inject
    FlutterwaveConfig config;

    @Inject
    ObjectMapper objectMapper;

    private final HttpClient http = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10)).build();

    /**
     * Calls POST /v3/payments on Flutterwave Standard checkout.
     * Returns the hosted payment link for the member to complete their card payment.
     */
    public String initializePayment(String txRef, BigDecimal amount,
                                    String memberEmail, String memberName, String memberPhone) {
        String body = buildPaymentBody(txRef, amount, memberEmail, memberName, memberPhone);

        try {
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(config.baseUrl() + "/v3/payments"))
                .timeout(Duration.ofSeconds(15))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + config.secretKey())
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());

            LOG.infof("[FLUTTERWAVE] Init response: status=%d body=%s",
                response.statusCode(), response.body());

            if (response.statusCode() != 200) {
                throw new RuntimeException(
                    "Flutterwave returned HTTP " + response.statusCode() + ": " + response.body());
            }

            String link = extractJsonString(response.body(), "link");
            if (link == null || link.isBlank()) {
                throw new RuntimeException("No payment link in Flutterwave response: " + response.body());
            }
            return link;

        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            LOG.errorf(e, "[FLUTTERWAVE] Failed to initialize payment for txRef=%s", txRef);
            throw new RuntimeException("Failed to initialize card payment: " + e.getMessage(), e);
        }
    }

    /**
     * Verifies by transaction ID using GET /v3/transactions/{id}/verify. Preferred over tx_ref
     * search, available immediately after redirect. Rejects unless the provider's own recorded
     * amount/currency match what we expect to be paid, a bare "successful" status is not
     * sufficient, a caller could otherwise pay an arbitrary (e.g. trivially small) amount and
     * still have it accepted.
     */
    public boolean verifyPaymentById(Long transactionId, BigDecimal expectedAmount) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(config.baseUrl() + "/v3/transactions/" + transactionId + "/verify"))
                .timeout(Duration.ofSeconds(15))
                .header("Authorization", "Bearer " + config.secretKey())
                .GET()
                .build();

            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());

            String responseBody = response.body();
            LOG.infof("[FLUTTERWAVE] Verify-by-id response: status=%d body=%s",
                response.statusCode(), responseBody);

            if (response.statusCode() != 200) return false;

            JsonNode data = objectMapper.readTree(responseBody).path("data");
            return verifyTransactionData(data.isMissingNode() ? null : data, expectedAmount);

        } catch (Exception e) {
            LOG.warnf(e, "[FLUTTERWAVE] Verification-by-id failed for id=%d", transactionId);
            return false;
        }
    }

    /**
     * Fallback: verifies by tx_ref using GET /v3/transactions?tx_ref={txRef}. May have a short
     * delay before the transaction is indexed. This is a search endpoint, so "data" is an array
     * of matching transactions rather than a single object.
     */
    public boolean verifyPayment(String txRef, BigDecimal expectedAmount) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(config.baseUrl() + "/v3/transactions?tx_ref=" + txRef))
                .timeout(Duration.ofSeconds(15))
                .header("Authorization", "Bearer " + config.secretKey())
                .GET()
                .build();

            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());

            String responseBody = response.body();
            LOG.infof("[FLUTTERWAVE] Verify response: status=%d body=%s",
                response.statusCode(), responseBody);

            if (response.statusCode() != 200) return false;

            JsonNode data = objectMapper.readTree(responseBody).path("data");
            JsonNode transaction = data.isArray()
                ? (data.size() > 0 ? data.get(0) : null)
                : (data.isMissingNode() ? null : data);

            return verifyTransactionData(transaction, expectedAmount);

        } catch (Exception e) {
            LOG.warnf(e, "[FLUTTERWAVE] Verification failed for txRef=%s", txRef);
            return false;
        }
    }

    /**
     * Confirms the provider's own transaction record actually says "successful" for the expected
     * currency/amount, rather than trusting a top-level status string alone.
     */
    private boolean verifyTransactionData(JsonNode transaction, BigDecimal expectedAmount) {
        if (transaction == null || transaction.isMissingNode() || transaction.isNull()) return false;
        if (expectedAmount == null) return false;

        String status = transaction.path("status").asText("");
        if (!"successful".equalsIgnoreCase(status)) return false;

        String currency = transaction.path("currency").asText("");
        if (!"KES".equalsIgnoreCase(currency)) {
            LOG.warnf("[FLUTTERWAVE] Currency mismatch: expected KES, got %s", currency);
            return false;
        }

        JsonNode amountNode = transaction.path("amount");
        if (amountNode.isMissingNode() || amountNode.isNull()) return false;

        BigDecimal actualAmount = amountNode.decimalValue();
        if (actualAmount.compareTo(expectedAmount) != 0) {
            LOG.warnf("[FLUTTERWAVE] Amount mismatch (possible tamper): expected=%s actual=%s",
                expectedAmount, actualAmount);
            return false;
        }

        return true;
    }

    private String buildPaymentBody(String txRef, BigDecimal amount,
                                    String memberEmail, String memberName, String memberPhone) {
        return "{"
            + "\"tx_ref\":\"" + esc(txRef) + "\","
            + "\"amount\":" + amount.toPlainString() + ","
            + "\"currency\":\"KES\","
            + "\"redirect_url\":\"" + esc(config.redirectUrl()) + "\","
            + "\"webhook_url\":\"" + esc(config.callbackUrl()) + "\","
            + "\"customer\":{"
            +   "\"email\":\"" + esc(memberEmail) + "\","
            +   "\"name\":\"" + esc(memberName) + "\","
            +   "\"phone_number\":\"" + esc(memberPhone) + "\""
            + "},"
            + "\"customizations\":{"
            +   "\"title\":\"Webchama\","
            +   "\"description\":\"Chama contribution\""
            + "}"
            + "}";
    }

    /** Extracts the first occurrence of "key":"value" from a JSON string. */
    private static String extractJsonString(String json, String key) {
        String search = "\"" + key + "\":\"";
        int start = json.indexOf(search);
        if (start < 0) return null;
        start += search.length();
        int end = json.indexOf("\"", start);
        if (end < 0) return null;
        return json.substring(start, end);
    }

    /** Escapes special characters for JSON string values. */
    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\n", "\\n").replace("\r", "\\r");
    }
}
