package org.chama.rest;

import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.chama.domain.enums.MemberRoleType;
import org.chama.domain.model.GeneratedDocument;
import org.chama.domain.model.Member;
import org.chama.dto.GenerateCustomDocumentRequest;
import org.chama.dto.GeneratedDocumentDto;
import org.chama.repository.GeneratedDocumentRepository;
import org.chama.security.CurrentUser;
import org.chama.security.TenantAccessService;
import org.chama.service.ContributionService;
import org.chama.service.DocumentGenerationService;
import org.chama.service.LoanService;
import org.chama.service.PayoutService;
import org.chama.service.notification.DocumentEmailService;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;

/**
 * Generation and read endpoints for the three record-derived document types (issue #42), a
 * freeform generator (issue #106) for an ad-hoc invoice/receipt against any existing chama member,
 * and a one-click AGM/auditor annual financial statement export (issue #66). Financial documents,
 * generation and listing are TREASURER/CHAIRPERSON-only, same convention as penalties/payouts. A
 * member may still fetch their own document by id, self-service, same pattern as PayoutResource's
 * requireTreasuryRoleOrOwnDocument. Sending a generated document by email is issue #38, WhatsApp
 * (issue #40) is not wired up here yet.
 */
@Path("/api/chamas/{chamaId}")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
public class DocumentResource {

    @Inject
    DocumentGenerationService documentGenerationService;

    @Inject
    DocumentEmailService documentEmailService;

    @Inject
    GeneratedDocumentRepository generatedDocumentRepository;

    @Inject
    ContributionService contributionService;

    @Inject
    LoanService loanService;

    @Inject
    PayoutService payoutService;

    @Inject
    TenantAccessService tenantAccessService;

    @Inject
    CurrentUser currentUser;

    @POST
    @Path("/contributions/{contributionId}/documents/receipt")
    public Response generateContributionReceipt(@PathParam("chamaId") Long chamaId, @PathParam("contributionId") Long contributionId) {
        // Gated on the record, before anything is generated. Checking the document afterwards
        // would let a refused request still file a receipt against someone else's contribution.
        requireTreasuryRoleOrOwnRecord(chamaId, contributionService.get(chamaId, contributionId).member.id);
        boolean existed = generatedDocumentRepository.findByContribution(contributionId).isPresent();
        GeneratedDocument doc = documentGenerationService.generateContributionReceipt(chamaId, contributionId);
        // 200 when the document was already on file, 201 only when this call created it.
        return Response.status(existed ? Response.Status.OK : Response.Status.CREATED)
            .entity(GeneratedDocumentDto.from(doc, true)).build();
    }

    @POST
    @Path("/loans/{loanId}/documents/statement")
    public Response generateLoanStatement(@PathParam("chamaId") Long chamaId, @PathParam("loanId") Long loanId) {
        // Gated on the record, before anything is generated. Checking the document afterwards
        // would let a refused request still file a receipt against someone else's contribution.
        requireTreasuryRoleOrOwnRecord(chamaId, loanService.get(chamaId, loanId).member.id);
        boolean existed = generatedDocumentRepository.findByLoan(loanId).isPresent();
        GeneratedDocument doc = documentGenerationService.generateLoanStatement(chamaId, loanId);
        // 200 when the document was already on file, 201 only when this call created it.
        return Response.status(existed ? Response.Status.OK : Response.Status.CREATED)
            .entity(GeneratedDocumentDto.from(doc, true)).build();
    }

    @POST
    @Path("/payouts/{payoutId}/documents/receipt")
    public Response generatePayoutReceipt(@PathParam("chamaId") Long chamaId, @PathParam("payoutId") Long payoutId) {
        // Gated on the record, before anything is generated. Checking the document afterwards
        // would let a refused request still file a receipt against someone else's contribution.
        requireTreasuryRoleOrOwnRecord(chamaId, payoutService.get(chamaId, payoutId).member.id);
        boolean existed = generatedDocumentRepository.findByPayout(payoutId).isPresent();
        GeneratedDocument doc = documentGenerationService.generatePayoutReceipt(chamaId, payoutId);
        // 200 when the document was already on file, 201 only when this call created it.
        return Response.status(existed ? Response.Status.OK : Response.Status.CREATED)
            .entity(GeneratedDocumentDto.from(doc, true)).build();
    }

    @POST
    @Path("/documents/generate")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response generateCustomDocument(@PathParam("chamaId") Long chamaId, GenerateCustomDocumentRequest request) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        GeneratedDocument doc = documentGenerationService.generateCustomDocument(chamaId, request);
        return Response.status(Response.Status.CREATED).entity(GeneratedDocumentDto.from(doc, true)).build();
    }

    @POST
    @Path("/documents/agm-statement")
    public Response generateAgmStatement(@PathParam("chamaId") Long chamaId,
            @QueryParam("from") String from, @QueryParam("to") String to) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        Member officer = tenantAccessService.currentMember(currentUser, chamaId).orElseThrow(ForbiddenException::new);
        LocalDate periodStart = parseDate(from, "from");
        LocalDate periodEnd = parseDate(to, "to");
        GeneratedDocument doc = documentGenerationService.generateAgmStatement(chamaId, officer.id, periodStart, periodEnd);
        return Response.status(Response.Status.CREATED).entity(GeneratedDocumentDto.from(doc, true)).build();
    }

    @GET
    @Path("/documents")
    public List<GeneratedDocumentDto> list(@PathParam("chamaId") Long chamaId,
            @QueryParam("page") @DefaultValue("0") int page,
            @QueryParam("size") @DefaultValue("20") int size) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        return generatedDocumentRepository.findRecentForChama(chamaId, page, size).stream()
            .map(doc -> GeneratedDocumentDto.from(doc, false))
            .toList();
    }

    @GET
    @Path("/documents/mine")
    public List<GeneratedDocumentDto> mine(@PathParam("chamaId") Long chamaId) {
        Member self = tenantAccessService.currentMember(currentUser, chamaId)
            .orElseThrow(ForbiddenException::new);
        return generatedDocumentRepository.findForMember(chamaId, self.id).stream()
            .map(doc -> GeneratedDocumentDto.from(doc, false))
            .toList();
    }

    @GET
    @Path("/documents/{id}")
    public GeneratedDocumentDto get(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id,
            @QueryParam("pdf") @DefaultValue("false") boolean includePdf) {
        GeneratedDocument doc = findForChama(chamaId, id);
        requireTreasuryRoleOrOwnDocument(chamaId, doc);
        return GeneratedDocumentDto.from(doc, includePdf);
    }

    @POST
    @Path("/documents/{id}/send/email")
    public GeneratedDocumentDto sendEmail(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        GeneratedDocument doc = findForChama(chamaId, id);
        return GeneratedDocumentDto.from(documentEmailService.send(doc), false);
    }

    private GeneratedDocument findForChama(Long chamaId, Long id) {
        GeneratedDocument doc = generatedDocumentRepository.findByIdOptional(id).orElseThrow(NotFoundException::new);
        if (!doc.chama.id.equals(chamaId)) {
            throw new NotFoundException();
        }
        return doc;
    }

    /**
     * A member may produce a document for their own contribution, loan or payout, and for nobody
     * else's. The custom invoice and the AGM statement stay treasury-only: those are issued *to*
     * someone rather than *by* them.
     */
    private void requireTreasuryRoleOrOwnRecord(Long chamaId, Long ownerMemberId) {
        var self = tenantAccessService.currentMember(currentUser, chamaId);
        if (self.isEmpty() || !self.get().id.equals(ownerMemberId)) {
            tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        }
    }

    private void requireTreasuryRoleOrOwnDocument(Long chamaId, GeneratedDocument doc) {
        var self = tenantAccessService.currentMember(currentUser, chamaId);
        boolean ownDocument = self.isPresent() && self.get().id.equals(doc.member.id);
        if (!ownDocument) {
            tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        }
    }

    private LocalDate parseDate(String value, String paramName) {
        if (value == null || value.isBlank()) {
            throw new BadRequestException(paramName + " is required (an ISO date, yyyy-MM-dd)");
        }
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException e) {
            throw new BadRequestException(paramName + " must be an ISO date (yyyy-MM-dd)");
        }
    }
}
