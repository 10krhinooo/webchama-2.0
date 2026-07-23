package org.chama.rest;

import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.chama.domain.enums.MemberRoleType;
import org.chama.domain.model.Payout;
import org.chama.dto.CreatePayoutDto;
import org.chama.dto.GeneratePayoutScheduleDto;
import org.chama.dto.PayoutDto;
import org.chama.dto.PayoutScheduleEntryDto;
import org.chama.security.CurrentUser;
import org.chama.security.TenantAccessService;
import org.chama.service.PayoutService;

import java.util.List;

@Path("/api/chamas/{chamaId}")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class PayoutResource {

    @Inject
    PayoutService payoutService;

    @Inject
    TenantAccessService tenantAccessService;

    @Inject
    CurrentUser currentUser;

    @GET
    @Path("/payout-schedule")
    public List<PayoutScheduleEntryDto> schedule(@PathParam("chamaId") Long chamaId) {
        tenantAccessService.requireMembership(currentUser, chamaId);
        return payoutService.listSchedule(chamaId).stream().map(PayoutScheduleEntryDto::from).toList();
    }

    /** CHAIRPERSON/TREASURER-only: (re)generate the rotation order from the chama's active members. */
    @POST
    @Path("/payout-schedule")
    public Response generateSchedule(@PathParam("chamaId") Long chamaId, @Valid GeneratePayoutScheduleDto dto) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        var entries = payoutService.generateSchedule(chamaId, dto).stream().map(PayoutScheduleEntryDto::from).toList();
        return Response.status(Response.Status.CREATED).entity(entries).build();
    }

    @GET
    @Path("/payouts")
    public List<PayoutDto> list(@PathParam("chamaId") Long chamaId) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        return payoutService.listForChama(chamaId).stream().map(PayoutDto::from).toList();
    }

    @GET
    @Path("/payouts/mine")
    public List<PayoutDto> mine(@PathParam("chamaId") Long chamaId) {
        var member = tenantAccessService.currentMember(currentUser, chamaId).orElseThrow(ForbiddenException::new);
        return payoutService.listForMember(chamaId, member.id).stream().map(PayoutDto::from).toList();
    }

    @GET
    @Path("/payouts/{id}")
    public PayoutDto get(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id) {
        Payout payout = payoutService.get(chamaId, id);
        requireTreasuryRoleOrOwnPayout(chamaId, payout);
        return PayoutDto.from(payout);
    }

    /** CHAIRPERSON/TREASURER-only: create the payout for the next round of the rotation. */
    @POST
    @Path("/payouts")
    public Response create(@PathParam("chamaId") Long chamaId, @Valid CreatePayoutDto dto) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        Payout payout = payoutService.createNextPayout(chamaId, dto);
        return Response.status(Response.Status.CREATED).entity(PayoutDto.from(payout)).build();
    }

    /** CHAIRPERSON/TREASURER-only: move a SCHEDULED payout to DISBURSED. */
    @PUT
    @Path("/payouts/{id}/disburse")
    public PayoutDto disburse(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        return PayoutDto.from(payoutService.markDisbursed(chamaId, id));
    }

    private void requireTreasuryRoleOrOwnPayout(Long chamaId, Payout payout) {
        var self = tenantAccessService.currentMember(currentUser, chamaId);
        boolean ownPayout = self.isPresent() && self.get().id.equals(payout.member.id);
        if (!ownPayout) {
            tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        }
    }
}
