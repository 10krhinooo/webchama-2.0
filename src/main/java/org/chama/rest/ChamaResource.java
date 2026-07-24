package org.chama.rest;

import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.chama.domain.enums.MemberRoleType;
import org.chama.dto.ChamaDto;
import org.chama.dto.CreateChamaDto;
import org.chama.dto.SavingsProgressDto;
import org.chama.dto.UpdateChamaDto;
import org.chama.security.CurrentUser;
import org.chama.security.TenantAccessService;
import org.chama.service.ChamaService;

import java.util.List;

@Path("/api/chamas")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ChamaResource {

    @Inject
    ChamaService chamaService;

    @Inject
    TenantAccessService tenantAccessService;

    @Inject
    CurrentUser currentUser;

    @GET
    public List<ChamaDto> list() {
        return chamaService.listForUser(currentUser).stream().map(ChamaDto::from).toList();
    }

    @GET
    @Path("/{id}")
    public ChamaDto get(@PathParam("id") Long id) {
        tenantAccessService.requireMembership(currentUser, id);
        return ChamaDto.from(chamaService.get(id));
    }

    @GET
    @Path("/{id}/savings-progress")
    public SavingsProgressDto savingsProgress(@PathParam("id") Long id) {
        tenantAccessService.requireMembership(currentUser, id);
        return chamaService.getSavingsProgress(id);
    }

    @POST
    public Response create(@Valid CreateChamaDto dto) {
        var chama = chamaService.create(dto, currentUser);
        return Response.status(Response.Status.CREATED).entity(ChamaDto.from(chama)).build();
    }

    @PUT
    @Path("/{id}")
    public ChamaDto update(@PathParam("id") Long id, @Valid UpdateChamaDto dto) {
        tenantAccessService.requireRole(currentUser, id, MemberRoleType.CHAIRPERSON);
        return ChamaDto.from(chamaService.update(id, dto));
    }

    @DELETE
    @Path("/{id}")
    public Response delete(@PathParam("id") Long id) {
        tenantAccessService.requireRole(currentUser, id, MemberRoleType.CHAIRPERSON);
        chamaService.delete(id);
        return Response.noContent().build();
    }
}
