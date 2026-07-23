package org.chama.rest;

import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.chama.dto.B2cResultCallbackDto;
import org.chama.service.LoanDisbursementService;

/**
 * Daraja B2C ResultURL and QueueTimeOutURL callbacks. @PermitAll by necessity, Safaricom is an
 * external caller with no Keycloak session, same reasoning as PaymentCallbackResource's M-Pesa
 * callback. Both paths share one handler: LoanDisbursementService.applyResultCallback validates
 * the ConversationID against a known-PENDING row before touching anything, so an unsolicited or
 * replayed call is a silent no-op rather than a forged disbursement update (issue #34).
 */
@Path("/api/payments")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@PermitAll
public class B2cCallbackResource {

    @Inject
    LoanDisbursementService loanDisbursementService;

    @POST
    @Path("/b2c-callback")
    public Response resultCallback(B2cResultCallbackDto dto) {
        if (dto != null) {
            loanDisbursementService.applyResultCallback(dto.result());
        }
        return Response.ok().build();
    }

    @POST
    @Path("/b2c-timeout")
    public Response timeoutCallback(B2cResultCallbackDto dto) {
        if (dto != null) {
            loanDisbursementService.applyResultCallback(dto.result());
        }
        return Response.ok().build();
    }
}
