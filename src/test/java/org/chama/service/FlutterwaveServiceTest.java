package org.chama.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.chama.config.FlutterwaveConfig;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.io.IOException;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Exercises FlutterwaveService against a local stub HTTP server, including the tamper checks in
 * verifyTransactionData (amount/currency/status must all match the provider's own record, not
 * just a bare "successful" string).
 */
class FlutterwaveServiceTest {

    private HttpServer server;

    @AfterEach
    void stopServer() {
        if (server != null) server.stop(0);
    }

    private FlutterwaveService serviceWith(String baseUrl) {
        FlutterwaveConfig config = Mockito.mock(FlutterwaveConfig.class);
        Mockito.when(config.secretKey()).thenReturn("secret");
        Mockito.when(config.baseUrl()).thenReturn(baseUrl);
        Mockito.when(config.callbackUrl()).thenReturn("http://localhost/api/payments/card/callback");
        Mockito.when(config.redirectUrl()).thenReturn("http://localhost/result");

        FlutterwaveService service = new FlutterwaveService();
        service.config = config;
        service.objectMapper = new ObjectMapper();
        return service;
    }

    private String startServer(String path, String body, int status) throws IOException {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext(path, exchange -> {
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        });
        server.start();
        return "http://localhost:" + server.getAddress().getPort();
    }

    @Test
    void initializePaymentReturnsHostedLinkOnSuccess() throws IOException {
        String baseUrl = startServer("/v3/payments",
            "{\"status\":\"success\",\"data\":{\"link\":\"https://checkout.flutterwave.com/pay/abc\"}}", 200);

        String link = serviceWith(baseUrl).initializePayment(
            "TXREF-1", new BigDecimal("500"), "member@example.com", "Member One", "254712345678");

        assertEquals("https://checkout.flutterwave.com/pay/abc", link);
    }

    @Test
    void initializePaymentThrowsWhenProviderRejects() throws IOException {
        String baseUrl = startServer("/v3/payments", "{\"status\":\"error\",\"message\":\"bad request\"}", 400);

        assertThrows(RuntimeException.class, () -> serviceWith(baseUrl).initializePayment(
            "TXREF-1", new BigDecimal("500"), "member@example.com", "Member One", "254712345678"));
    }

    @Test
    void verifyPaymentByIdReturnsTrueWhenAmountAndCurrencyMatch() throws IOException {
        String baseUrl = startServer("/v3/transactions/77/verify",
            "{\"status\":\"success\",\"data\":{\"status\":\"successful\",\"currency\":\"KES\",\"amount\":500}}", 200);

        assertTrue(serviceWith(baseUrl).verifyPaymentById(77L, new BigDecimal("500")));
    }

    @Test
    void verifyPaymentByIdReturnsFalseOnAmountMismatch() throws IOException {
        String baseUrl = startServer("/v3/transactions/77/verify",
            "{\"status\":\"success\",\"data\":{\"status\":\"successful\",\"currency\":\"KES\",\"amount\":1}}", 200);

        assertFalse(serviceWith(baseUrl).verifyPaymentById(77L, new BigDecimal("500")));
    }

    @Test
    void verifyPaymentByIdReturnsFalseOnCurrencyMismatch() throws IOException {
        String baseUrl = startServer("/v3/transactions/77/verify",
            "{\"status\":\"success\",\"data\":{\"status\":\"successful\",\"currency\":\"USD\",\"amount\":500}}", 200);

        assertFalse(serviceWith(baseUrl).verifyPaymentById(77L, new BigDecimal("500")));
    }

    @Test
    void verifyPaymentByIdReturnsFalseWhenStatusNotSuccessful() throws IOException {
        String baseUrl = startServer("/v3/transactions/77/verify",
            "{\"status\":\"success\",\"data\":{\"status\":\"failed\",\"currency\":\"KES\",\"amount\":500}}", 200);

        assertFalse(serviceWith(baseUrl).verifyPaymentById(77L, new BigDecimal("500")));
    }

    @Test
    void verifyPaymentByIdReturnsFalseOnHttpFailure() throws IOException {
        String baseUrl = startServer("/v3/transactions/77/verify", "{}", 500);

        assertFalse(serviceWith(baseUrl).verifyPaymentById(77L, new BigDecimal("500")));
    }

    @Test
    void verifyPaymentByTxRefSearchesAndReturnsTrueOnFirstMatchingResult() throws IOException {
        String baseUrl = startServer("/v3/transactions",
            "{\"status\":\"success\",\"data\":[{\"status\":\"successful\",\"currency\":\"KES\",\"amount\":500}]}", 200);

        assertTrue(serviceWith(baseUrl).verifyPayment("TXREF-1", new BigDecimal("500")));
    }

    @Test
    void verifyPaymentByTxRefReturnsFalseWhenSearchResultIsEmpty() throws IOException {
        String baseUrl = startServer("/v3/transactions", "{\"status\":\"success\",\"data\":[]}", 200);

        assertFalse(serviceWith(baseUrl).verifyPayment("TXREF-1", new BigDecimal("500")));
    }
}
