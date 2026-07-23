package org.chama.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.chama.config.B2cConfig;
import org.jboss.logging.Logger;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;

/**
 * Pure Daraja B2C HTTP client, no persistence, mirroring MpesaService's split between the raw
 * provider integration and LoanDisbursementService's DB orchestration on top of it. Kept separate
 * so the HTTP/error-mapping logic can be exercised against a local stub server (DarajaB2cClientTest)
 * without needing a database, the same pattern MpesaServiceTest uses for STK push.
 */
@ApplicationScoped
public class DarajaB2cClient {

    private static final Logger LOG = Logger.getLogger(DarajaB2cClient.class);

    @Inject
    B2cConfig b2cConfig;

    private final HttpClient http = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10)).build();

    public record B2cAckResult(String conversationId, String originatorConversationId) {}

    /** Initiates a Daraja B2C paymentrequest. Returns the acknowledgement's conversation IDs. */
    public B2cAckResult requestPayout(String phone, BigDecimal amount, String occasion) {
        try {
            String token = getAccessToken();
            String normalized = MpesaService.normalizePhone(phone);

            String body = "{"
                + "\"InitiatorName\":\"" + b2cConfig.initiatorName() + "\","
                + "\"SecurityCredential\":\"" + b2cConfig.securityCredential() + "\","
                + "\"CommandID\":\"BusinessPayment\","
                + "\"Amount\":\"" + amount.toBigInteger() + "\","
                + "\"PartyA\":\"" + b2cConfig.shortcode() + "\","
                + "\"PartyB\":\"" + normalized + "\","
                + "\"Remarks\":\"Chama loan disbursement\","
                + "\"QueueTimeOutURL\":\"" + b2cConfig.queueTimeoutUrl() + "\","
                + "\"ResultURL\":\"" + b2cConfig.resultUrl() + "\","
                + "\"Occasion\":\"" + occasion + "\""
                + "}";

            LOG.infof("[B2C] Disbursement request: phone=%s, amount=%s, shortcode=%s",
                maskPhone(normalized), amount.toBigInteger(), b2cConfig.shortcode());

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(b2cConfig.baseUrl() + "/mpesa/b2c/v1/paymentrequest"))
                .timeout(Duration.ofSeconds(30))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + token)
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            LOG.infof("[B2C] Disbursement request: status=%d", response.statusCode());

            if (response.statusCode() != 200) {
                String message = extractJson(response.body(), "errorMessage");
                throw new RuntimeException(message != null
                    ? "B2C request rejected: " + message
                    : "B2C request failed (HTTP " + response.statusCode() + ").");
            }

            String conversationId = extractJson(response.body(), "ConversationID");
            String originatorConversationId = extractJson(response.body(), "OriginatorConversationID");
            if (conversationId == null || originatorConversationId == null) {
                throw new RuntimeException("No ConversationID in B2C response.");
            }
            return new B2cAckResult(conversationId, originatorConversationId);

        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            LOG.errorf(e, "[B2C] Disbursement request failed for phone=%s", maskPhone(phone));
            throw new RuntimeException("B2C disbursement request failed: " + e.getMessage(), e);
        }
    }

    /**
     * Fires a Daraja TransactionStatusQuery for a still-pending disbursement. The actual result
     * arrives asynchronously through the same ResultURL callback, this call only re-triggers it
     * (issue #35), the synchronous response here only confirms Daraja accepted the query.
     */
    public void queryTransactionStatus(String originatorConversationId) {
        try {
            String token = getAccessToken();
            String body = "{"
                + "\"Initiator\":\"" + b2cConfig.initiatorName() + "\","
                + "\"SecurityCredential\":\"" + b2cConfig.securityCredential() + "\","
                + "\"CommandID\":\"TransactionStatusQuery\","
                + "\"TransactionID\":\"" + originatorConversationId + "\","
                + "\"PartyA\":\"" + b2cConfig.shortcode() + "\","
                + "\"IdentifierType\":\"4\","
                + "\"ResultURL\":\"" + b2cConfig.resultUrl() + "\","
                + "\"QueueTimeOutURL\":\"" + b2cConfig.queueTimeoutUrl() + "\","
                + "\"Remarks\":\"Loan disbursement reconciliation\","
                + "\"Occasion\":\"Reconciliation\""
                + "}";

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(b2cConfig.baseUrl() + "/mpesa/transactionstatus/v1/query"))
                .timeout(Duration.ofSeconds(30))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + token)
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            LOG.infof("[B2C] TransactionStatusQuery: status=%d", response.statusCode());

            if (response.statusCode() != 200) {
                throw new RuntimeException("B2C TransactionStatusQuery failed (HTTP " + response.statusCode() + ").");
            }
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("B2C TransactionStatusQuery failed: " + e.getMessage(), e);
        }
    }

    private String getAccessToken() throws Exception {
        String credentials = Base64.getEncoder().encodeToString(
            (b2cConfig.consumerKey() + ":" + b2cConfig.consumerSecret())
                .getBytes(StandardCharsets.UTF_8));

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(b2cConfig.baseUrl() + "/oauth/v1/generate?grant_type=client_credentials"))
            .timeout(Duration.ofSeconds(15))
            .header("Authorization", "Basic " + credentials)
            .GET()
            .build();

        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new RuntimeException("B2C OAuth failed (HTTP " + response.statusCode() + ").");
        }

        String token = extractJson(response.body(), "access_token");
        if (token == null) {
            throw new RuntimeException("Could not obtain B2C access token.");
        }
        return token;
    }

    private static String maskPhone(String phone) {
        if (phone == null || phone.length() < 6) return "****";
        return phone.substring(0, 4) + "****" + phone.substring(phone.length() - 2);
    }

    private static String extractJson(String json, String key) {
        int keyPos = json.indexOf("\"" + key + "\"");
        if (keyPos < 0) return null;
        int colon = json.indexOf(":", keyPos);
        if (colon < 0) return null;
        int quoteOpen = json.indexOf("\"", colon + 1);
        if (quoteOpen < 0) return null;
        int quoteClose = json.indexOf("\"", quoteOpen + 1);
        return quoteClose < 0 ? null : json.substring(quoteOpen + 1, quoteClose);
    }
}
