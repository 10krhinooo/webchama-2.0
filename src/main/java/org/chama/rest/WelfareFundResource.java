package org.chama.rest;

import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.chama.domain.enums.MemberRoleType;
import org.chama.dto.CreateWelfareWithdrawalDto;
import org.chama.dto.InitiateWelfareMpesaPaymentDto;
import org.chama.dto.PaymentDto;
import org.chama.dto.RecordWelfareContributionDto;
import org.chama.dto.WelfareContributionDto;
import org.chama.dto.WelfareFundDto;
import org.chama.dto.WelfareWithdrawalDto;
import org.chama.security.CurrentUser;
import org.chama.security.TenantAccessService;
import org.chama.service.PaymentService;
import org.chama.service.WelfareContributionService;
import org.chama.service.WelfareFundService;

import java.util.List;

/**
 * The chama's welfare/emergency fund (issue #65): a genuinely distinct pot from regular
 * contributions, with its own running balance, contribution history, and disbursement flow.
 */
@Path("/api/chamas/{chamaId}/welfare-fund")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class WelfareFundResource {

    @Inject
    WelfareFundService welfareFundService;

    @Inject
    WelfareContributionService welfareContributionService;

    @Inject
    PaymentService paymentService;

    @Inject
    TenantAccessService tenantAccessService;

    @Inject
    CurrentUser currentUser;

    @GET
    public WelfareFundDto getFund(@PathParam("chamaId") Long chamaId) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        return WelfareFundDto.from(welfareFundService.getOrCreate(chamaId));
    }

    @GET
    @Path("/contributions")
    public List<WelfareContributionDto> listContributions(@PathParam("chamaId") Long chamaId) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        return welfareContributionService.listForChama(chamaId).stream().map(WelfareContributionDto::from).toList();
    }

    @GET
    @Path("/contributions/mine")
    public List<WelfareContributionDto> myContributions(@PathParam("chamaId") Long chamaId) {
        var member = tenantAccessService.currentMember(currentUser, chamaId).orElseThrow(ForbiddenException::new);
        return welfareContributionService.listForMember(chamaId, member.id).stream()
            .map(WelfareContributionDto::from).toList();
    }

    /** Treasurer/chairperson recording a contribution paid outside M-Pesa (cash/bank in hand), credited immediately. */
    @POST
    @Path("/contributions")
    public Response recordContribution(@PathParam("chamaId") Long chamaId, @Valid RecordWelfareContributionDto dto) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        var contribution = welfareContributionService.recordManual(chamaId, dto.memberId(), dto.amount(), dto.method());
        return Response.status(Response.Status.CREATED).entity(WelfareContributionDto.from(contribution)).build();
    }

    /** Self-service: a member tops up the welfare fund by an amount of their own choosing via M-Pesa STK push. */
    @POST
    @Path("/contributions/pay/mpesa")
    public Response payWithMpesa(@PathParam("chamaId") Long chamaId, @Valid InitiateWelfareMpesaPaymentDto dto) {
        var member = tenantAccessService.currentMember(currentUser, chamaId).orElseThrow(ForbiddenException::new);
        var payment = paymentService.initiateMpesaWelfareContribution(chamaId, member, dto.amount());
        return Response.status(Response.Status.CREATED).entity(PaymentDto.from(payment)).build();
    }

    @GET
    @Path("/withdrawals")
    public List<WelfareWithdrawalDto> listWithdrawals(@PathParam("chamaId") Long chamaId) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        return welfareFundService.listWithdrawals(chamaId).stream().map(WelfareWithdrawalDto::from).toList();
    }

    /** Chairperson/treasurer marks an emergency payout disbursed from the fund. */
    @POST
    @Path("/withdrawals")
    public Response createWithdrawal(@PathParam("chamaId") Long chamaId, @Valid CreateWelfareWithdrawalDto dto) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        var member = tenantAccessService.currentMember(currentUser, chamaId).orElseThrow(ForbiddenException::new);
        var withdrawal = welfareFundService.withdraw(chamaId, dto.amount(), dto.reason(), member);
        return Response.status(Response.Status.CREATED).entity(WelfareWithdrawalDto.from(withdrawal)).build();
    }
}
