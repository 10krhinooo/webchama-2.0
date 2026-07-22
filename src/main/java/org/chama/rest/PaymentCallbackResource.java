package org.chama.rest;

import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.chama.config.FlutterwaveConfig;
import org.chama.dto.FlutterwaveCallbackDto;
import org.chama.dto.MpesaCallbackDto;
import org.chama.service.PaymentService;
import org.jboss.logging.Logger;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Payment provider webhooks. Both are @PermitAll by necessity (Daraja/Flutterwave are external
 * callers with no Keycloak session), the Flutterwave callback carries its own signature scheme
 * instead, the M-Pesa callback has no equivalent from Daraja and instead relies on idempotency
 * (a payment only transitions out of PENDING once) plus RateLimitFilter.
 */
@Path("/api/payments")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@PermitAll
public class PaymentCallbackResource {

    private static final Logger LOG = Logger.getLogger(PaymentCallbackResource.class);

    @Inject
    PaymentService paymentService;

    @Inject
    FlutterwaveConfig flutterwaveConfig;

    @POST
    @Path("/mpesa-callback")
    public Response mpesaCallback(MpesaCallbackDto dto) {
        paymentService.handleMpesaCallback(dto);
        return Response.ok().build();
    }

    @POST
    @Path("/card/callback")
    public Response cardCallback(FlutterwaveCallbackDto dto, @Context HttpHeaders headers) {
        // Fail closed: if the secret hash isn't configured, reject every webhook rather than
        // accepting them unverified.
        String expected = flutterwaveConfig.secretHash();
        if (expected == null || expected.isBlank()) {
            LOG.error("[FLUTTERWAVE] secretHash not configured, rejecting webhook");
            return Response.status(Response.Status.UNAUTHORIZED).build();
        }

        String incoming = headers.getHeaderString("verif-hash");
        byte[] expectedBytes = expected.getBytes(StandardCharsets.UTF_8);
        byte[] incomingBytes = (incoming != null ? incoming : "").getBytes(StandardCharsets.UTF_8);
        if (!MessageDigest.isEqual(expectedBytes, incomingBytes)) {
            LOG.warn("[FLUTTERWAVE] Webhook rejected, hash mismatch");
            return Response.status(Response.Status.UNAUTHORIZED).build();
        }

        if (dto != null && "successful".equalsIgnoreCase(dto.status()) && dto.txRef() != null) {
            paymentService.handleFlutterwaveWebhook(dto);
        }
        return Response.ok().build();
    }
}
