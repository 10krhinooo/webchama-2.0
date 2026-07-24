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
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.chama.domain.enums.MemberRoleType;
import org.chama.dto.ContributionDto;
import org.chama.dto.CreateContributionDto;
import org.chama.dto.InitiateCardPaymentDto;
import org.chama.dto.PaymentDto;
import org.chama.dto.RecordPaymentDto;
import org.chama.security.CurrentUser;
import org.chama.security.TenantAccessService;
import org.chama.service.ContributionService;
import org.chama.service.PaymentService;

import java.util.List;
import java.util.Map;

@Path("/api/chamas/{chamaId}/contributions")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ContributionResource {

    @Inject
    ContributionService contributionService;

    @Inject
    PaymentService paymentService;

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

    /** Self-service: the caller's own on-time contribution streak (issue #61), a light engagement nudge. */
    @GET
    @Path("/mine/streak")
    public Map<String, Integer> myStreak(@PathParam("chamaId") Long chamaId) {
        var member = tenantAccessService.currentMember(currentUser, chamaId)
            .orElseThrow(ForbiddenException::new);
        return Map.of("streak", contributionService.currentStreak(chamaId, member.id));
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

    /** Self-service: a member pays their own contribution's remaining balance via M-Pesa STK push. */
    @POST
    @Path("/{id}/pay/mpesa")
    public Response payWithMpesa(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id) {
        var member = tenantAccessService.currentMember(currentUser, chamaId).orElseThrow(ForbiddenException::new);
        var payment = paymentService.initiateMpesaPayment(chamaId, id, member);
        return Response.status(Response.Status.CREATED).entity(PaymentDto.from(payment)).build();
    }

    /** Self-service: a member pays their own contribution's remaining balance via Flutterwave card checkout. */
    @POST
    @Path("/{id}/pay/card")
    public Response payWithCard(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id,
                                 @Valid InitiateCardPaymentDto dto) {
        var member = tenantAccessService.currentMember(currentUser, chamaId).orElseThrow(ForbiddenException::new);
        var init = paymentService.initiateCardPayment(chamaId, id, member, dto.email());
        return Response.ok(Map.of(
            "paymentLink", init.paymentLink(),
            "txRef", init.payment().providerReference
        )).build();
    }

    @GET
    @Path("/{id}/pay/card/verify")
    public Response verifyCardPayment(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id,
                                       @QueryParam("txRef") String txRef,
                                       @QueryParam("transactionId") Long transactionId) {
        tenantAccessService.requireMembership(currentUser, chamaId);
        boolean paid = paymentService.verifyCardPayment(chamaId, id, txRef, transactionId);
        return Response.ok(Map.of("paid", paid)).build();
    }
}
