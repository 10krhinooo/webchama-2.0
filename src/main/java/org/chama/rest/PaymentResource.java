package org.chama.rest;

import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import org.chama.domain.enums.MemberRoleType;
import org.chama.dto.PaymentDto;
import org.chama.repository.PaymentRepository;
import org.chama.security.CurrentUser;
import org.chama.security.TenantAccessService;

import java.util.List;

/**
 * Read-only view of every Payment attempt (not just the current contribution/welfare status), so
 * a member can see their own payment is PENDING/SUCCESS/FAILED instead of firing a repeat STK
 * push while unsure whether the first one is still in flight, and staff can see the same across
 * the whole chama.
 */
@Path("/api/chamas/{chamaId}/payments")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class PaymentResource {

    @Inject
    PaymentRepository paymentRepository;

    @Inject
    TenantAccessService tenantAccessService;

    @Inject
    CurrentUser currentUser;

    @GET
    public List<PaymentDto> list(@PathParam("chamaId") Long chamaId) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        return paymentRepository.findByChama(chamaId).stream().map(PaymentDto::from).toList();
    }

    @GET
    @Path("/mine")
    public List<PaymentDto> mine(@PathParam("chamaId") Long chamaId) {
        var member = tenantAccessService.currentMember(currentUser, chamaId)
            .orElseThrow(ForbiddenException::new);
        return paymentRepository.findByChamaAndMember(chamaId, member.id).stream().map(PaymentDto::from).toList();
    }
}
