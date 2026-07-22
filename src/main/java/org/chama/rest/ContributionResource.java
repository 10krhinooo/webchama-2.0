package org.chama.rest;

import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
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
import org.chama.dto.ContributionDto;
import org.chama.dto.CreateContributionDto;
import org.chama.dto.RecordPaymentDto;
import org.chama.security.CurrentUser;
import org.chama.security.TenantAccessService;
import org.chama.service.ContributionService;

import java.util.List;

@Path("/api/chamas/{chamaId}/contributions")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ContributionResource {

    @Inject
    ContributionService contributionService;

    @Inject
    TenantAccessService tenantAccessService;

    @Inject
    CurrentUser currentUser;

    @GET
    public List<ContributionDto> list(@PathParam("chamaId") Long chamaId) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        return contributionService.listForChama(chamaId).stream().map(ContributionDto::from).toList();
    }

    @GET
    @Path("/mine")
    public List<ContributionDto> mine(@PathParam("chamaId") Long chamaId) {
        var member = tenantAccessService.currentMember(currentUser, chamaId)
            .orElseThrow(ForbiddenException::new);
        return contributionService.listForMember(chamaId, member.id).stream().map(ContributionDto::from).toList();
    }

    @GET
    @Path("/{id}")
    public ContributionDto get(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        return ContributionDto.from(contributionService.get(chamaId, id));
    }

    @POST
    public Response create(@PathParam("chamaId") Long chamaId, @Valid CreateContributionDto dto) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        var contribution = contributionService.create(chamaId, dto);
        return Response.status(Response.Status.CREATED).entity(ContributionDto.from(contribution)).build();
    }

    @PUT
    @Path("/{id}/payment")
    public ContributionDto recordPayment(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id, @Valid RecordPaymentDto dto) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        return ContributionDto.from(contributionService.recordPayment(chamaId, id, dto.amount(), dto.method()));
    }

    @DELETE
    @Path("/{id}")
    public Response delete(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        contributionService.delete(chamaId, id);
        return Response.noContent().build();
    }
}
