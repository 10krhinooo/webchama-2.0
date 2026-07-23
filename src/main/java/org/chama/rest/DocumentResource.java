package org.chama.rest;

import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.ws.rs.DefaultValue;
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
import org.chama.dto.GeneratedDocumentDto;
import org.chama.repository.GeneratedDocumentRepository;
import org.chama.security.CurrentUser;
import org.chama.security.TenantAccessService;
import org.chama.service.DocumentGenerationService;

import java.util.List;

/**
 * Generation and read endpoints for the three document types (issue #42). Financial documents,
 * generation and listing are TREASURER/CHAIRPERSON-only, same convention as penalties/payouts. A
 * member may still fetch their own document by id, self-service, same pattern as PayoutResource's
 * requireTreasuryRoleOrOwnDocument. Sending a generated document (email/whatsapp) is not wired up
 * here, that lands with the delivery channels (issues #38/#39/#40).
 */
@Path("/api/chamas/{chamaId}")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
public class DocumentResource {

    @Inject
    DocumentGenerationService documentGenerationService;

    @Inject
    GeneratedDocumentRepository generatedDocumentRepository;

    @Inject
    TenantAccessService tenantAccessService;

    @Inject
    CurrentUser currentUser;

    @POST
    @Path("/contributions/{contributionId}/documents/receipt")
    public Response generateContributionReceipt(@PathParam("chamaId") Long chamaId, @PathParam("contributionId") Long contributionId) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        GeneratedDocument doc = documentGenerationService.generateContributionReceipt(chamaId, contributionId);
        return Response.status(Response.Status.CREATED).entity(GeneratedDocumentDto.from(doc, true)).build();
    }

    @POST
    @Path("/loans/{loanId}/documents/statement")
    public Response generateLoanStatement(@PathParam("chamaId") Long chamaId, @PathParam("loanId") Long loanId) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        GeneratedDocument doc = documentGenerationService.generateLoanStatement(chamaId, loanId);
        return Response.status(Response.Status.CREATED).entity(GeneratedDocumentDto.from(doc, true)).build();
    }

    @POST
    @Path("/payouts/{payoutId}/documents/receipt")
    public Response generatePayoutReceipt(@PathParam("chamaId") Long chamaId, @PathParam("payoutId") Long payoutId) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        GeneratedDocument doc = documentGenerationService.generatePayoutReceipt(chamaId, payoutId);
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
    @Path("/documents/{id}")
    public GeneratedDocumentDto get(@PathParam("chamaId") Long chamaId, @PathParam("id") Long id,
            @QueryParam("pdf") @DefaultValue("false") boolean includePdf) {
        GeneratedDocument doc = generatedDocumentRepository.findByIdOptional(id).orElseThrow(NotFoundException::new);
        if (!doc.chama.id.equals(chamaId)) {
            throw new NotFoundException();
        }
        requireTreasuryRoleOrOwnDocument(chamaId, doc);
        return GeneratedDocumentDto.from(doc, includePdf);
    }

    private void requireTreasuryRoleOrOwnDocument(Long chamaId, GeneratedDocument doc) {
        var self = tenantAccessService.currentMember(currentUser, chamaId);
        boolean ownDocument = self.isPresent() && self.get().id.equals(doc.member.id);
        if (!ownDocument) {
            tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.TREASURER, MemberRoleType.CHAIRPERSON);
        }
    }
}
