package org.chama.service;

import com.sun.net.httpserver.HttpServer;
import org.chama.config.MpesaConfig;
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
 * Exercises MpesaService against a local stub HTTP server instead of the real Daraja sandbox, so
 * the STK push / query paths (including Daraja's error-mapping and "still processing" case) are
 * covered without a network dependency.
 */
class MpesaServiceTest {

    private HttpServer server;

    @AfterEach
    void stopServer() {
        if (server != null) server.stop(0);
    }

    private MpesaService serviceWith(String baseUrl) {
        MpesaConfig config = Mockito.mock(MpesaConfig.class);
        Mockito.when(config.consumerKey()).thenReturn("key");
        Mockito.when(config.consumerSecret()).thenReturn("secret");
        Mockito.when(config.shortcode()).thenReturn("174379");
        Mockito.when(config.tillNumber()).thenReturn("174379");
        Mockito.when(config.passkey()).thenReturn("passkey");
        Mockito.when(config.baseUrl()).thenReturn(baseUrl);
        Mockito.when(config.transactionType()).thenReturn("CustomerPayBillOnline");
        Mockito.when(config.callbackUrl()).thenReturn("http://localhost/api/payments/mpesa-callback");

        MpesaService service = new MpesaService();
        service.mpesaConfig = config;
        return service;
    }

    private String startServer(String oauthBody, int oauthStatus, String stkBody, int stkStatus) throws IOException {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/oauth/v1/generate", exchange -> respond(exchange, oauthStatus, oauthBody));
        server.createContext("/mpesa/stkpush/v1/processrequest", exchange -> respond(exchange, stkStatus, stkBody));
        server.createContext("/mpesa/stkpushquery/v1/query", exchange -> respond(exchange, stkStatus, stkBody));
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
    void stkPushReturnsCheckoutRequestIdOnSuccess() throws IOException {
        String baseUrl = startServer(
            "{\"access_token\":\"abc123\"}", 200,
            "{\"CheckoutRequestID\":\"ws_CO_1\"}", 200);

        String checkoutId = serviceWith(baseUrl).stkPush("0712345678", new BigDecimal("500"), "REF-1");

        assertEquals("ws_CO_1", checkoutId);
    }

    @Test
    void stkPushMapsDarajaErrorCodeToUserMessage() throws IOException {
        String baseUrl = startServer(
            "{\"access_token\":\"abc123\"}", 200,
            "{\"errorCode\":\"400.002.02\",\"errorMessage\":\"Bad Request - invalid phone\"}", 400);

        RuntimeException ex = assertThrows(RuntimeException.class,
            () -> serviceWith(baseUrl).stkPush("0712345678", new BigDecimal("500"), "REF-1"));

        assertTrue(ex.getMessage().contains("Invalid phone number"));
    }

    @Test
    void stkPushFailsWhenOAuthTokenRequestFails() throws IOException {
        String baseUrl = startServer(
            "{\"error\":\"invalid_client\"}", 400,
            "{}", 200);

        assertThrows(RuntimeException.class,
            () -> serviceWith(baseUrl).stkPush("0712345678", new BigDecimal("500"), "REF-1"));
    }

    @Test
    void queryStkStatusReportsPaidOnResultCodeZero() throws IOException {
        String baseUrl = startServer(
            "{\"access_token\":\"abc123\"}", 200,
            "{\"ResultCode\":\"0\",\"ResultDesc\":\"The service request is processed successfully.\"}", 200);

        MpesaService.StkQueryResult result = serviceWith(baseUrl).queryStkStatus("ws_CO_1");

        assertTrue(result.isPaid());
    }

    @Test
    void queryStkStatusReportsPendingWhileStillAwaitingPin() throws IOException {
        String baseUrl = startServer(
            "{\"access_token\":\"abc123\"}", 200,
            "{\"errorCode\":\"500.001.1001\",\"errorMessage\":\"still processing\"}", 500);

        MpesaService.StkQueryResult result = serviceWith(baseUrl).queryStkStatus("ws_CO_1");

        assertEquals("PENDING", result.resultCode());
        assertTrue(!result.isPaid());
    }

    @Test
    void normalizePhoneConvertsAllInputFormsTo254() {
        assertEquals("254712345678", MpesaService.normalizePhone("0712345678"));
        assertEquals("254712345678", MpesaService.normalizePhone("+254712345678"));
        assertEquals("254712345678", MpesaService.normalizePhone("254712345678"));
        assertEquals("", MpesaService.normalizePhone(null));
    }
}
