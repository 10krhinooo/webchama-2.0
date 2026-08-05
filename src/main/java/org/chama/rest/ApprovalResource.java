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
import org.chama.dto.ApprovalDto;
import org.chama.dto.RequestApprovalDto;
import org.chama.security.CurrentUser;
import org.chama.security.TenantAccessService;
import org.chama.service.ApprovalService;

import java.util.List;

/**
 * Maker-checker dual sign-off queue (issues #52/#53). Restricted to TREASURER/CHAIRPERSON
 * throughout, both requesting and signing off are staff-only actions, there is no member-facing
 * self-service view of this resource.
 */
@Path("/api/chamas/{chamaId}/approvals")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ApprovalResource {

    @Inject
    ApprovalService approvalService;

    @Inject
    TenantAccessService tenantAccessService;

    @Inject
    CurrentUser currentUser;

    @GET
    public List<ApprovalDto> list(@PathParam("chamaId") Long chamaId) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        return approvalService.listForChama(chamaId).stream().map(ApprovalDto::from).toList();
    }

    @GET
    @Path("/pending")
    public List<ApprovalDto> pending(@PathParam("chamaId") Long chamaId) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        return approvalService.listPendingForChama(chamaId).stream().map(ApprovalDto::from).toList();
    }

    @GET
    @Path("/{id}")
    public ApprovalDto get(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        return ApprovalDto.from(approvalService.get(chamaId, id));
    }

    /** The "maker" step: open a dual sign-off request for a loan disbursement or payout. */
    @POST
    public Response request(@PathParam("chamaId") Long chamaId, @Valid RequestApprovalDto dto) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        var requester = tenantAccessService.currentMember(currentUser, chamaId).orElseThrow(ForbiddenException::new);
        var approval = approvalService.request(
            chamaId, dto.targetType(), dto.targetId(), dto.memberId(), dto.amount(), dto.reason(), requester.id);
        return Response.status(Response.Status.CREATED).entity(ApprovalDto.from(approval)).build();
    }

    /** The "checker" step: sign off. Two distinct signatories are required before it clears. */
    @PUT
    @Path("/{id}/approve")
    public ApprovalDto approve(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        var signer = tenantAccessService.currentMember(currentUser, chamaId).orElseThrow(ForbiddenException::new);
        return ApprovalDto.from(approvalService.approve(chamaId, id, signer.id));
    }

    /** Either signatory can reject a pending request outright. */
    @PUT
    @Path("/{id}/reject")
    public ApprovalDto reject(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        var signer = tenantAccessService.currentMember(currentUser, chamaId).orElseThrow(ForbiddenException::new);
        return ApprovalDto.from(approvalService.reject(chamaId, id, signer.id));
    }
}
