package org.chama.rest;

import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.chama.domain.enums.MemberRoleType;
import org.chama.dto.CreateMemberDto;
import org.chama.dto.MemberDto;
import org.chama.dto.UpdateMemberDto;
import org.chama.dto.UpdateMemberStatusDto;
import org.chama.security.CurrentUser;
import org.chama.security.TenantAccessService;
import org.chama.service.MemberService;

import java.util.List;

@Path("/api/chamas/{chamaId}/members")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class MemberResource {

    @Inject
    MemberService memberService;

    @Inject
    TenantAccessService tenantAccessService;

    @Inject
    CurrentUser currentUser;

    @GET
    public List<MemberDto> list(@PathParam("chamaId") Long chamaId) {
        tenantAccessService.requireMembership(currentUser, chamaId);
        return memberService.listForChama(chamaId).stream()
            .map(m -> MemberDto.from(m, memberService.rolesOf(m.id)))
            .toList();
    }

    @GET
    @Path("/mine")
    public MemberDto mine(@PathParam("chamaId") Long chamaId) {
        tenantAccessService.requireMembership(currentUser, chamaId);
        var member = tenantAccessService.currentMember(currentUser, chamaId).orElseThrow(NotFoundException::new);
        return MemberDto.from(member, memberService.rolesOf(member.id));
    }

    @GET
    @Path("/{id}")
    public MemberDto get(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id) {
        tenantAccessService.requireMembership(currentUser, chamaId);
        var member = memberService.get(chamaId, id);
        return MemberDto.from(member, memberService.rolesOf(member.id));
    }

    @POST
    public Response create(@PathParam("chamaId") Long chamaId, @Valid CreateMemberDto dto) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.CHAIRPERSON);
        var member = memberService.create(chamaId, dto);
        return Response.status(Response.Status.CREATED)
            .entity(MemberDto.from(member, memberService.rolesOf(member.id)))
            .build();
    }

    @PUT
    @Path("/{id}")
    public MemberDto update(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id, @Valid UpdateMemberDto dto) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.CHAIRPERSON);
        var member = memberService.update(chamaId, id, dto);
        return MemberDto.from(member, memberService.rolesOf(member.id));
    }

    @PUT
    @Path("/{id}/status")
    public MemberDto updateStatus(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id, @Valid UpdateMemberStatusDto dto) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.CHAIRPERSON);
        var member = memberService.updateStatus(chamaId, id, dto.status());
        return MemberDto.from(member, memberService.rolesOf(member.id));
    }

    @DELETE
    @Path("/{id}")
    public Response delete(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.CHAIRPERSON);
        memberService.delete(chamaId, id);
        return Response.noContent().build();
    }
}
