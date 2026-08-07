package org.chama.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.chama.config.MpesaConfig;
import org.eclipse.microprofile.faulttolerance.CircuitBreaker;
import org.eclipse.microprofile.faulttolerance.Retry;
import org.eclipse.microprofile.faulttolerance.Timeout;
import org.jboss.logging.Logger;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Base64;

/**
 * Daraja STK push integration for chama contribution payments. C2B till reconciliation and the
 * startup URL-registration job are not implemented here (issue #23, optional, deferred).
 *
 * <p>{@code @Timeout}/{@code @CircuitBreaker} apply class-wide so a degraded Daraja doesn't tie up
 * a worker thread for the full manual HTTP timeout on every request and a sustained outage fails
 * fast instead. {@code @Retry} is only added to {@link #queryStkStatus}, a read-only query safe to
 * repeat; {@link #stkPush} is deliberately never retried automatically, since a retry after a
 * network-level failure (where it's unknown whether Daraja already queued the push) would risk
 * sending a member a second STK prompt for the same payment.
 */
@ApplicationScoped
@Timeout(value = 45, unit = ChronoUnit.SECONDS)
@CircuitBreaker(requestVolumeThreshold = 4, failureRatio = 0.5, delay = 30, delayUnit = ChronoUnit.SECONDS)
public class MpesaService {

    private static final Logger LOG = Logger.getLogger(MpesaService.class);
    private static final DateTimeFormatter TS_FMT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    @Inject
    MpesaConfig mpesaConfig;

    private final HttpClient http = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10)).build();

    /**
     * Initiates a Daraja STK push and returns the CheckoutRequestID. Normalises phone to
     * 254XXXXXXXXX format before sending.
     */
    public String stkPush(String phone, BigDecimal amount, String accountRef) {
        try {
            String token = getAccessToken();
            String timestamp = LocalDateTime.now().format(TS_FMT);
            String password = Base64.getEncoder().encodeToString(
                (mpesaConfig.shortcode() + mpesaConfig.passkey() + timestamp)
                    .getBytes(StandardCharsets.UTF_8));
            String normalized = normalizePhone(phone);

            LOG.infof("[M-PESA] STK push request: phone=%s, amount=%s, type=%s, shortcode=%s",
                maskPhone(normalized), amount.toBigInteger(), mpesaConfig.transactionType(),
                mpesaConfig.shortcode());

            String body = "{"
                + "\"BusinessShortCode\":\"" + mpesaConfig.shortcode() + "\","
                + "\"Password\":\"" + password + "\","
                + "\"Timestamp\":\"" + timestamp + "\","
                + "\"TransactionType\":\"" + mpesaConfig.transactionType() + "\","
                + "\"Amount\":\"" + amount.toBigInteger() + "\","
                + "\"PartyA\":\"" + normalized + "\","
                + "\"PartyB\":\"" + mpesaConfig.tillNumber() + "\","
                + "\"PhoneNumber\":\"" + normalized + "\","
                + "\"CallBackURL\":\"" + mpesaConfig.callbackUrl() + "\","
                + "\"AccountReference\":\"" + accountRef + "\","
                + "\"TransactionDesc\":\"Chama Contribution\""
                + "}";

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(mpesaConfig.baseUrl() + "/mpesa/stkpush/v1/processrequest"))
                .timeout(Duration.ofSeconds(30))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + token)
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());

            LOG.infof("[M-PESA] STK push: status=%d %s", response.statusCode(), logSafeSummary(response.body()));

            if (response.statusCode() != 200) {
                throw new RuntimeException(parseDarajaError(response.body()));
            }

            String checkoutId = extractJson(response.body(), "CheckoutRequestID");
            if (checkoutId == null)
                throw new RuntimeException("No CheckoutRequestID in M-Pesa response.");
            return checkoutId;

        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            LOG.errorf(e, "[M-PESA] STK push failed for phone=%s", maskPhone(phone));
            throw new RuntimeException("M-Pesa STK push failed: " + e.getMessage(), e);
        }
    }

    private String getAccessToken() throws Exception {
        String credentials = Base64.getEncoder().encodeToString(
            (mpesaConfig.consumerKey() + ":" + mpesaConfig.consumerSecret())
                .getBytes(StandardCharsets.UTF_8));

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(mpesaConfig.baseUrl() + "/oauth/v1/generate?grant_type=client_credentials"))
            .timeout(Duration.ofSeconds(15))
            .header("Authorization", "Basic " + credentials)
            .GET()
            .build();

        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());

        // Never log the response body here, it contains the raw bearer access_token in plaintext.
        LOG.infof("[M-PESA] OAuth token request: status=%d", response.statusCode());

        if (response.statusCode() != 200) {
            LOG.errorf("[M-PESA] OAuth token request failed: status=%d %s",
                response.statusCode(), logSafeSummary(response.body()));
            throw new RuntimeException(
                "M-Pesa OAuth failed (HTTP " + response.statusCode() + "). "
                    + "Verify that mpesa.base-url matches the environment for your credentials.");
        }

        String token = extractJson(response.body(), "access_token");
        if (token == null) {
            LOG.errorf("[M-PESA] OAuth response missing access_token: %s", logSafeSummary(response.body()));
            throw new RuntimeException("Could not obtain M-Pesa access token.");
        }
        return token;
    }

    /** Queries the status of a previously initiated STK push via the M-Pesa Express STK Query endpoint. */
    @Retry(maxRetries = 3, delay = 500, delayUnit = ChronoUnit.MILLIS)
    public StkQueryResult queryStkStatus(String checkoutRequestId) {
        try {
            String token = getAccessToken();
            String timestamp = LocalDateTime.now().format(TS_FMT);
            String password = Base64.getEncoder().encodeToString(
                (mpesaConfig.shortcode() + mpesaConfig.passkey() + timestamp)
                    .getBytes(StandardCharsets.UTF_8));

            String body = "{"
                + "\"BusinessShortCode\":\"" + mpesaConfig.shortcode() + "\","
                + "\"Password\":\"" + password + "\","
                + "\"Timestamp\":\"" + timestamp + "\","
                + "\"CheckoutRequestID\":\"" + checkoutRequestId + "\""
                + "}";

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(mpesaConfig.baseUrl() + "/mpesa/stkpushquery/v1/query"))
                .timeout(Duration.ofSeconds(30))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + token)
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());

            LOG.infof("[M-PESA] STK query: status=%d %s", response.statusCode(), logSafeSummary(response.body()));

            if (response.statusCode() != 200) {
                String errorCode = extractJson(response.body(), "errorCode");
                // Daraja returns HTTP 500 + errorCode 500.001.1001 while the transaction is still
                // awaiting the subscriber's PIN entry, this is expected, not a failure.
                if ("500.001.1001".equals(errorCode)) {
                    LOG.infof("[M-PESA] STK query: transaction still being processed");
                    return new StkQueryResult("PENDING", "Payment is still being processed. Please check again shortly.");
                }
                LOG.errorf("[M-PESA] STK query failed: status=%d %s",
                    response.statusCode(), logSafeSummary(response.body()));
                throw new RuntimeException("M-Pesa STK query failed (HTTP " + response.statusCode() + ").");
            }

            String resultCode = extractJson(response.body(), "ResultCode");
            String resultDesc = extractJson(response.body(), "ResultDesc");
            if (resultCode == null) resultCode = extractJson(response.body(), "ResponseCode");
            if (resultDesc == null) resultDesc = extractJson(response.body(), "ResponseDescription");
            return new StkQueryResult(
                resultCode != null ? resultCode : "UNKNOWN",
                resultDesc != null ? resultDesc : "No description returned"
            );

        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            LOG.errorf(e, "[M-PESA] STK query failed for checkoutId=%s", checkoutRequestId);
            throw new RuntimeException("M-Pesa STK query failed: " + e.getMessage(), e);
        }
    }

    public record StkQueryResult(String resultCode, String resultDesc) {
        public boolean isPaid() { return "0".equals(resultCode); }
    }

    /** Maps a Daraja error response body to a user-readable message. */
    private static String parseDarajaError(String body) {
        String code = extractJson(body, "errorCode");
        String message = extractJson(body, "errorMessage");
        if (code == null && message == null) return "M-Pesa request failed. Please try again.";
        return switch (code != null ? code : "") {
            case "400.002.02" -> "Invalid phone number. Please use a Safaricom number in the format 07XXXXXXXX.";
            case "400.002.05" -> "Invalid amount. Please check the amount and try again.";
            case "400.002.01" -> "M-Pesa authentication error. Please contact support.";
            case "500.001.1001" -> "A payment is already in progress for this number. Please wait a moment and try again.";
            default -> message != null
                ? "M-Pesa: " + message.replace("Bad Request - ", "")
                : "M-Pesa request failed. Please try again.";
        };
    }

    /** Converts 07... or +254... or 254... to 254XXXXXXXXX */
    public static String normalizePhone(String phone) {
        if (phone == null) return "";
        String p = phone.trim().replaceAll("\\s+", "");
        if (p.startsWith("+")) p = p.substring(1);
        if (p.startsWith("0")) p = "254" + p.substring(1);
        return p;
    }

    /** Masks a phone number for logs, e.g. "2547****89". */
    private static String maskPhone(String phone) {
        if (phone == null || phone.length() < 6) return "****";
        return phone.substring(0, 4) + "****" + phone.substring(phone.length() - 2);
    }

    /**
     * Summarizes a Daraja response body for logging without leaking secrets (e.g. the OAuth
     * access_token) or raw payloads (which may contain phone numbers).
     */
    private static String logSafeSummary(String body) {
        if (body == null) return "(no body)";
        String errorCode = extractJson(body, "errorCode");
        if (errorCode != null) return "errorCode=" + errorCode;
        String resultCode = extractJson(body, "ResultCode");
        if (resultCode == null) resultCode = extractJson(body, "ResponseCode");
        if (resultCode != null) return "resultCode=" + resultCode;
        return "(" + body.length() + " bytes)";
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
