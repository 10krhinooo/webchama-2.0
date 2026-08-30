package org.chama.rest;

import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import org.chama.domain.enums.MemberRoleType;
import org.chama.dto.MemberImportResultDto;
import org.chama.security.CurrentUser;
import org.chama.security.TenantAccessService;
import org.chama.service.MemberImportService;

/**
 * Bulk member import.
 *
 * <p>Takes the file as a raw text/csv body rather than multipart. Multipart needs extra
 * configuration and a FileUpload binding for no benefit here: the payload is one text document,
 * and the frontend reads it with FileReader before sending either way.
 *
 * <p>Gated on CHAIRPERSON alone, matching MemberResource.create. Provisioning Keycloak accounts is
 * a chairperson power everywhere else in the application, and doing it three hundred at a time is
 * not a smaller version of it.
 *
 * <p>Separate from MemberResource because the body is CSV rather than JSON, and mixing a
 * text/csv-consuming method into a class annotated @Consumes(APPLICATION_JSON) reads as an
 * oversight even when it works.
 */
@Path("/api/chamas/{chamaId}/members/import")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
public class MemberImportResource {

    @Inject
    MemberImportService memberImportService;

    @Inject
    TenantAccessService tenantAccessService;

    @Inject
    CurrentUser currentUser;

    /**
     * Always answers 200, even when every row was rejected. The per-row detail is the answer to
     * the request, not an error, and a 400 would throw away what the caller needs to fix the file.
     *
     * @param dryRun when true, nothing is created and every row that would have succeeded comes
     *               back READY. This is what the preview in the UI calls.
     */
    @POST
    @Consumes("text/csv")
    public MemberImportResultDto importMembers(@PathParam("chamaId") Long chamaId,
                                               @QueryParam("dryRun") @DefaultValue("false") boolean dryRun,
                                               String csv) {
        tenantAccessService.requireRole(currentUser, chamaId, MemberRoleType.CHAIRPERSON);
        return memberImportService.importMembers(chamaId, csv, dryRun);
    }
}
