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
import org.chama.domain.enums.VoteChoice;
import org.chama.domain.model.Resolution;
import org.chama.dto.CastVoteDto;
import org.chama.dto.CreateResolutionDto;
import org.chama.dto.ResolutionDto;
import org.chama.dto.ResolutionVoteDto;
import org.chama.security.CurrentUser;
import org.chama.security.TenantAccessService;
import org.chama.service.ResolutionService;

import java.util.List;

@Path("/api/chamas/{chamaId}/resolutions")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ResolutionResource {

    @Inject
    ResolutionService resolutionService;

    @Inject
    TenantAccessService tenantAccessService;

    @Inject
    CurrentUser currentUser;

    @GET
    public List<ResolutionDto> list(@PathParam("chamaId") Long chamaId) {
        tenantAccessService.requireMembership(currentUser, chamaId);
        return resolutionService.listForChama(chamaId).stream().map(this::toDto).toList();
    }

    @GET
    @Path("/{id}")
    public ResolutionDto get(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id) {
        tenantAccessService.requireMembership(currentUser, chamaId);
        return toDto(resolutionService.get(chamaId, id));
    }

    @GET
    @Path("/{id}/votes")
    public List<ResolutionVoteDto> votes(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id) {
        tenantAccessService.requireMembership(currentUser, chamaId);
        return resolutionService.getVotes(chamaId, id).stream().map(ResolutionVoteDto::from).toList();
    }

    /** SECRETARY/CHAIRPERSON-only: opens a resolution against a meeting for a show-of-hands decision. */
    @POST
    public Response open(@PathParam("chamaId") Long chamaId, @Valid CreateResolutionDto dto) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.SECRETARY, MemberRoleType.CHAIRPERSON);
        var openedBy = tenantAccessService.currentMember(currentUser, chamaId).orElseThrow(ForbiddenException::new);
        Resolution resolution = resolutionService.open(chamaId, dto, openedBy.id);
        return Response.status(Response.Status.CREATED).entity(toDto(resolution)).build();
    }

    /** Any member: casts their own vote (FOR/AGAINST/ABSTAIN) on an open resolution. */
    @POST
    @Path("/{id}/votes")
    public Response castVote(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id, @Valid CastVoteDto dto) {
        var member = tenantAccessService.currentMember(currentUser, chamaId).orElseThrow(ForbiddenException::new);
        resolutionService.castVote(chamaId, id, member.id, dto.choice());
        return Response.status(Response.Status.CREATED).entity(toDto(resolutionService.get(chamaId, id))).build();
    }

    /** SECRETARY/CHAIRPERSON-only: closes an open resolution, tallying votes into a final status. */
    @PUT
    @Path("/{id}/close")
    public ResolutionDto close(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.SECRETARY, MemberRoleType.CHAIRPERSON);
        return toDto(resolutionService.close(chamaId, id));
    }

    private ResolutionDto toDto(Resolution resolution) {
        long forVotes = resolutionService.countVotes(resolution.id, VoteChoice.FOR);
        long againstVotes = resolutionService.countVotes(resolution.id, VoteChoice.AGAINST);
        long abstainVotes = resolutionService.countVotes(resolution.id, VoteChoice.ABSTAIN);
        return ResolutionDto.from(resolution, forVotes, againstVotes, abstainVotes);
    }
}
