package org.chama.rest;

import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.Response;
import org.chama.config.FlutterwaveConfig;
import org.chama.dto.FlutterwaveCallbackDto;
import org.chama.service.PaymentService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * PaymentCallbackResource.cardCallback() must fail closed (see MIGRATION_PLAN.md section 7):
 * reject when the secret hash isn't configured, reject on a hash mismatch, and only ever
 * delegate to PaymentService (which does its own server-to-server re-verification) once both
 * checks pass.
 */
class PaymentCallbackResourceSignatureTest {

    private PaymentCallbackResource resourceWith(String configuredHash) {
        PaymentCallbackResource resource = new PaymentCallbackResource();
        resource.paymentService = mock(PaymentService.class);
        resource.flutterwaveConfig = mock(FlutterwaveConfig.class);
        when(resource.flutterwaveConfig.secretHash()).thenReturn(configuredHash);
        return resource;
    }

    @Test
    void rejectsWhenSecretHashNotConfigured() {
        PaymentCallbackResource resource = resourceWith(null);
        HttpHeaders headers = mock(HttpHeaders.class);

        Response response = resource.cardCallback(
            new FlutterwaveCallbackDto("successful", "TXREF-1", 1L, null, "KES"), headers);

        assertEquals(401, response.getStatus());
        verify(resource.paymentService, never()).handleFlutterwaveWebhook(any());
    }

    @Test
    void rejectsWhenHashHeaderIsMissing() {
        PaymentCallbackResource resource = resourceWith("expected-secret");
        HttpHeaders headers = mock(HttpHeaders.class);
        when(headers.getHeaderString("verif-hash")).thenReturn(null);

        Response response = resource.cardCallback(
            new FlutterwaveCallbackDto("successful", "TXREF-1", 1L, null, "KES"), headers);

        assertEquals(401, response.getStatus());
        verify(resource.paymentService, never()).handleFlutterwaveWebhook(any());
    }

    @Test
    void rejectsWhenHashHeaderMismatches() {
        PaymentCallbackResource resource = resourceWith("expected-secret");
        HttpHeaders headers = mock(HttpHeaders.class);
        when(headers.getHeaderString("verif-hash")).thenReturn("wrong-secret");

        Response response = resource.cardCallback(
            new FlutterwaveCallbackDto("successful", "TXREF-1", 1L, null, "KES"), headers);

        assertEquals(401, response.getStatus());
        verify(resource.paymentService, never()).handleFlutterwaveWebhook(any());
    }

    @Test
    void delegatesWhenHashMatchesAndStatusSuccessful() {
        PaymentCallbackResource resource = resourceWith("expected-secret");
        HttpHeaders headers = mock(HttpHeaders.class);
        when(headers.getHeaderString("verif-hash")).thenReturn("expected-secret");

        Response response = resource.cardCallback(
            new FlutterwaveCallbackDto("successful", "TXREF-1", 1L, null, "KES"), headers);

        assertEquals(200, response.getStatus());
        verify(resource.paymentService, times(1)).handleFlutterwaveWebhook(any());
    }

    @Test
    void doesNotDelegateWhenStatusIsNotSuccessful() {
        PaymentCallbackResource resource = resourceWith("expected-secret");
        HttpHeaders headers = mock(HttpHeaders.class);
        when(headers.getHeaderString("verif-hash")).thenReturn("expected-secret");

        Response response = resource.cardCallback(
            new FlutterwaveCallbackDto("failed", "TXREF-1", 1L, null, "KES"), headers);

        assertEquals(200, response.getStatus());
        verify(resource.paymentService, never()).handleFlutterwaveWebhook(any());
    }

    @Test
    void doesNotDelegateWhenDtoBodyIsNull() {
        PaymentCallbackResource resource = resourceWith("expected-secret");
        HttpHeaders headers = mock(HttpHeaders.class);
        when(headers.getHeaderString("verif-hash")).thenReturn("expected-secret");

        Response response = resource.cardCallback(null, headers);

        assertEquals(200, response.getStatus());
        verify(resource.paymentService, never()).handleFlutterwaveWebhook(any());
    }
}
