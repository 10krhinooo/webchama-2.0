package org.chama.rest;

import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.ForbiddenException;
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
import org.chama.dto.CreditScoreDto;
import org.chama.dto.MemberDto;
import org.chama.dto.MemberInvitationDto;
import org.chama.dto.UpdateAutoPayDto;
import org.chama.dto.UpdateMemberDto;
import org.chama.dto.UpdateMemberStatusDto;
import org.chama.security.CurrentUser;
import org.chama.security.TenantAccessService;
import org.chama.service.CreditScoreService;
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
    CreditScoreService creditScoreService;

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

    /** CHAIRPERSON/TREASURER, or the member themselves, can view their own credit score. */
    @GET
    @Path("/{id}/credit-score")
    public CreditScoreDto creditScore(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id) {
        var self = tenantAccessService.currentMember(currentUser, chamaId);
        boolean ownScore = self.isPresent() && self.get().id.equals(id);
        if (!ownScore) {
            tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        }
        return creditScoreService.calculate(chamaId, id);
    }

    @POST
    public Response create(@PathParam("chamaId") Long chamaId, @Valid CreateMemberDto dto) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.CHAIRPERSON);
        var result = memberService.create(chamaId, dto);
        var member = result.member();
        return Response.status(Response.Status.CREATED)
            .entity(new MemberInvitationDto(MemberDto.from(member, memberService.rolesOf(member.id)), result.temporaryPassword()))
            .build();
    }

    /**
     * Recovery path for an invite whose original email never arrived, or whose one-time temporary
     * password was lost before anyone wrote it down (issue P1-11): resets the member's Keycloak
     * password to a fresh temporary one and re-sends the credential email.
     */
    @POST
    @Path("/{id}/resend-invite")
    // Overrides the class-level @Consumes: this endpoint takes no request body, and axios
    // (the frontend's HTTP client) sends a bodyless POST with no Content-Type header at all,
    // which the class-level "application/json" restriction would otherwise reject with 415.
    @Consumes(MediaType.WILDCARD)
    public MemberInvitationDto resendInvite(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.CHAIRPERSON);
        String temporaryPassword = memberService.resendInvite(chamaId, id);
        var member = memberService.get(chamaId, id);
        return new MemberInvitationDto(MemberDto.from(member, memberService.rolesOf(member.id)), temporaryPassword);
    }

    @PUT
    @Path("/{id}")
    public MemberDto update(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id, @Valid UpdateMemberDto dto) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.CHAIRPERSON);
        var member = memberService.update(chamaId, id, dto);
        return MemberDto.from(member, memberService.rolesOf(member.id));
    }

    /** Self-service: opt in/out of the scheduled auto-STK-push job for the caller's own contributions. */
    @PUT
    @Path("/mine/auto-pay")
    public MemberDto updateMyAutoPay(@PathParam("chamaId") Long chamaId, @Valid UpdateAutoPayDto dto) {
        var member = tenantAccessService.currentMember(currentUser, chamaId).orElseThrow(ForbiddenException::new);
        var updated = memberService.updateAutoPay(chamaId, member.id, dto.autoPayEnabled());
        return MemberDto.from(updated, memberService.rolesOf(updated.id));
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
