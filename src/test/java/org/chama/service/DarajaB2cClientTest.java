package org.chama.service;

import com.sun.net.httpserver.HttpServer;
import org.chama.config.B2cConfig;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.io.IOException;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Exercises DarajaB2cClient against a local stub HTTP server instead of the real Daraja sandbox,
 * same approach as MpesaServiceTest, so the paymentrequest/transactionstatus paths (including
 * Daraja's error-mapping) are covered without a network dependency.
 */
class DarajaB2cClientTest {

    private HttpServer server;

    @AfterEach
    void stopServer() {
        if (server != null) server.stop(0);
    }

    private DarajaB2cClient clientWith(String baseUrl) {
        B2cConfig config = Mockito.mock(B2cConfig.class);
        Mockito.when(config.consumerKey()).thenReturn("key");
        Mockito.when(config.consumerSecret()).thenReturn("secret");
        Mockito.when(config.baseUrl()).thenReturn(baseUrl);
        Mockito.when(config.shortcode()).thenReturn("600000");
        Mockito.when(config.initiatorName()).thenReturn("testapi");
        Mockito.when(config.securityCredential()).thenReturn("encrypted-credential");
        Mockito.when(config.resultUrl()).thenReturn("http://localhost/api/payments/b2c-callback");
        Mockito.when(config.queueTimeoutUrl()).thenReturn("http://localhost/api/payments/b2c-timeout");

        DarajaB2cClient client = new DarajaB2cClient();
        client.b2cConfig = config;
        return client;
    }

    private String startServer(String oauthBody, int oauthStatus, String payoutBody, int payoutStatus,
                                String queryBody, int queryStatus) throws IOException {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/oauth/v1/generate", exchange -> respond(exchange, oauthStatus, oauthBody));
        server.createContext("/mpesa/b2c/v1/paymentrequest", exchange -> respond(exchange, payoutStatus, payoutBody));
        server.createContext("/mpesa/transactionstatus/v1/query", exchange -> respond(exchange, queryStatus, queryBody));
        server.start();
        return "http://localhost:" + server.getAddress().getPort();
    }

    private void respond(com.sun.net.httpserver.HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    @Test
    void requestPayoutReturnsConversationIdsOnSuccess() throws IOException {
        String baseUrl = startServer(
            "{\"access_token\":\"abc123\"}", 200,
            "{\"ConversationID\":\"AG_1\",\"OriginatorConversationID\":\"16740-1\","
                + "\"ResponseCode\":\"0\",\"ResponseDescription\":\"Accept the service request successfully.\"}", 200,
            "{}", 200);

        DarajaB2cClient.B2cAckResult result = clientWith(baseUrl)
            .requestPayout("0712345678", new BigDecimal("5000"), "Loan disbursement 1");

        assertEquals("AG_1", result.conversationId());
        assertEquals("16740-1", result.originatorConversationId());
    }

    @Test
    void requestPayoutMapsDarajaErrorMessage() throws IOException {
        String baseUrl = startServer(
            "{\"access_token\":\"abc123\"}", 200,
            "{\"errorCode\":\"401.002.01\",\"errorMessage\":\"Invalid Access Token\"}", 400,
            "{}", 200);

        RuntimeException ex = assertThrows(RuntimeException.class,
            () -> clientWith(baseUrl).requestPayout("0712345678", new BigDecimal("5000"), "Loan disbursement 1"));

        assertTrue(ex.getMessage().contains("Invalid Access Token"));
    }

    @Test
    void requestPayoutFailsWhenOAuthTokenRequestFails() throws IOException {
        String baseUrl = startServer(
            "{\"error\":\"invalid_client\"}", 400,
            "{}", 200,
            "{}", 200);

        assertThrows(RuntimeException.class,
            () -> clientWith(baseUrl).requestPayout("0712345678", new BigDecimal("5000"), "Loan disbursement 1"));
    }

    @Test
    void requestPayoutFailsWhenResponseMissingConversationId() throws IOException {
        String baseUrl = startServer(
            "{\"access_token\":\"abc123\"}", 200,
            "{\"ResponseCode\":\"0\"}", 200,
            "{}", 200);

        assertThrows(RuntimeException.class,
            () -> clientWith(baseUrl).requestPayout("0712345678", new BigDecimal("5000"), "Loan disbursement 1"));
    }

    @Test
    void queryTransactionStatusSucceedsOnAcceptedAck() throws IOException {
        String baseUrl = startServer(
            "{\"access_token\":\"abc123\"}", 200,
            "{}", 200,
            "{\"ResponseCode\":\"0\",\"ResponseDescription\":\"Accept the service request successfully.\"}", 200);

        clientWith(baseUrl).queryTransactionStatus("16740-1");
    }

    @Test
    void queryTransactionStatusThrowsOnNonOkResponse() throws IOException {
        String baseUrl = startServer(
            "{\"access_token\":\"abc123\"}", 200,
            "{}", 200,
            "{\"errorMessage\":\"Invalid request\"}", 400);

        assertThrows(RuntimeException.class, () -> clientWith(baseUrl).queryTransactionStatus("16740-1"));
    }
}
