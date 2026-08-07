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
import org.chama.domain.model.Penalty;
import org.chama.dto.CreatePenaltyDto;
import org.chama.dto.PenaltyDto;
import org.chama.dto.SettlePenaltyDto;
import org.chama.dto.WaivePenaltyDto;
import org.chama.security.CurrentUser;
import org.chama.security.TenantAccessService;
import org.chama.service.PenaltyService;

import java.util.List;

@Path("/api/chamas/{chamaId}/penalties")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class PenaltyResource {

    @Inject
    PenaltyService penaltyService;

    @Inject
    TenantAccessService tenantAccessService;

    @Inject
    CurrentUser currentUser;

    @GET
    public List<PenaltyDto> list(@PathParam("chamaId") Long chamaId) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        return penaltyService.listForChama(chamaId).stream().map(PenaltyDto::from).toList();
    }

    @GET
    @Path("/mine")
    public List<PenaltyDto> mine(@PathParam("chamaId") Long chamaId) {
        var member = tenantAccessService.currentMember(currentUser, chamaId).orElseThrow(ForbiddenException::new);
        return penaltyService.listForMember(chamaId, member.id).stream().map(PenaltyDto::from).toList();
    }

    @GET
    @Path("/{id}")
    public PenaltyDto get(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id) {
        Penalty penalty = penaltyService.get(chamaId, id);
        requireTreasuryRoleOrOwnPenalty(chamaId, penalty);
        return PenaltyDto.from(penalty);
    }

    /** CHAIRPERSON/TREASURER-only: impose a penalty on a member. */
    @POST
    public Response create(@PathParam("chamaId") Long chamaId, @Valid CreatePenaltyDto dto) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        Penalty penalty = penaltyService.create(chamaId, dto);
        return Response.status(Response.Status.CREATED).entity(PenaltyDto.from(penalty)).build();
    }

    /** CHAIRPERSON/TREASURER-only: move a PENDING penalty to APPROVED, recording who decided it and when. */
    @PUT
    @Path("/{id}/approve")
    public PenaltyDto approve(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        var decider = tenantAccessService.currentMember(currentUser, chamaId).orElseThrow(ForbiddenException::new);
        return PenaltyDto.from(penaltyService.approve(chamaId, id, decider.id));
    }

    /** CHAIRPERSON/TREASURER-only: forgive a penalty, recording why. */
    @PUT
    @Path("/{id}/waive")
    public PenaltyDto waive(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id, @Valid WaivePenaltyDto dto) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        var decider = tenantAccessService.currentMember(currentUser, chamaId).orElseThrow(ForbiddenException::new);
        return PenaltyDto.from(penaltyService.waive(chamaId, id, decider.id, dto.reason()));
    }

    /** CHAIRPERSON/TREASURER-only: record a member settling an APPROVED penalty. */
    @PUT
    @Path("/{id}/settle")
    public PenaltyDto settle(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id, SettlePenaltyDto dto) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        var decider = tenantAccessService.currentMember(currentUser, chamaId).orElseThrow(ForbiddenException::new);
        return PenaltyDto.from(penaltyService.settle(chamaId, id, decider.id, dto.methodOrDefault()));
    }

    private void requireTreasuryRoleOrOwnPenalty(Long chamaId, Penalty penalty) {
        var self = tenantAccessService.currentMember(currentUser, chamaId);
        boolean ownPenalty = self.isPresent() && self.get().id.equals(penalty.member.id);
        if (!ownPenalty) {
            tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        }
    }
}
