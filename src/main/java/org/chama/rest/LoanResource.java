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
import org.chama.domain.model.Loan;
import org.chama.dto.CreateLoanDto;
import org.chama.dto.LoanDto;
import org.chama.dto.LoanRepaymentDto;
import org.chama.dto.RecordLoanRepaymentDto;
import org.chama.security.CurrentUser;
import org.chama.security.TenantAccessService;
import org.chama.service.LoanService;

import java.util.List;

@Path("/api/chamas/{chamaId}/loans")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class LoanResource {

    @Inject
    LoanService loanService;

    @Inject
    TenantAccessService tenantAccessService;

    @Inject
    CurrentUser currentUser;

    @GET
    public List<LoanDto> list(@PathParam("chamaId") Long chamaId) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        return loanService.listForChama(chamaId).stream().map(LoanDto::from).toList();
    }

    @GET
    @Path("/mine")
    public List<LoanDto> mine(@PathParam("chamaId") Long chamaId) {
        var member = tenantAccessService.currentMember(currentUser, chamaId).orElseThrow(ForbiddenException::new);
        return loanService.listForMember(chamaId, member.id).stream().map(LoanDto::from).toList();
    }

    @GET
    @Path("/{id}")
    public LoanDto get(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id) {
        Loan loan = loanService.get(chamaId, id);
        requireTreasuryRoleOrOwnLoan(chamaId, loan);
        return LoanDto.from(loan);
    }

    /** A member requests a loan for themselves; treasurer/chairperson may request one on behalf of any member. */
    @POST
    public Response create(@PathParam("chamaId") Long chamaId, @Valid CreateLoanDto dto) {
        var self = tenantAccessService.currentMember(currentUser, chamaId);
        boolean requestingOwnLoan = self.isPresent() && self.get().id.equals(dto.memberId());
        if (!requestingOwnLoan) {
            tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        }
        Loan loan = loanService.create(chamaId, dto);
        return Response.status(Response.Status.CREATED).entity(LoanDto.from(loan)).build();
    }

    @GET
    @Path("/{id}/repayments")
    public List<LoanRepaymentDto> repayments(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id) {
        requireTreasuryRoleOrOwnLoan(chamaId, loanService.get(chamaId, id));
        return loanService.getRepayments(chamaId, id).stream().map(LoanRepaymentDto::from).toList();
    }

    @PUT
    @Path("/{id}/repayments/{repaymentId}/payment")
    public LoanRepaymentDto recordRepayment(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id,
                                             @PathParam("repaymentId") Long repaymentId,
                                             @Valid RecordLoanRepaymentDto dto) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        return LoanRepaymentDto.from(loanService.recordRepayment(chamaId, id, repaymentId, dto.amount()));
    }

    private void requireTreasuryRoleOrOwnLoan(Long chamaId, Loan loan) {
        var self = tenantAccessService.currentMember(currentUser, chamaId);
        boolean ownLoan = self.isPresent() && self.get().id.equals(loan.member.id);
        if (!ownLoan) {
            tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        }
    }
}
