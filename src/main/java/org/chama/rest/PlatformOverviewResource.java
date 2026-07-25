package org.chama.rest;

import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import org.chama.dto.PlatformOverviewDto;
import org.chama.security.CurrentUser;
import org.chama.service.PlatformStatsService;

/**
 * SUPER_ADMIN-only platform-wide KPI view (MIGRATION_PLAN.md section 3). Platform-level, not
 * chama-scoped, so this goes through CurrentUser.isSuperAdmin() directly rather than
 * TenantAccessService, which only resolves per-chama roles, same pattern as SecurityEventResource.
 */
@Path("/api/admin/overview")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
public class PlatformOverviewResource {

    @Inject
    CurrentUser currentUser;

    @Inject
    PlatformStatsService platformStatsService;

    @GET
    public PlatformOverviewDto get() {
        if (!currentUser.isSuperAdmin()) {
            throw new ForbiddenException();
        }
        return platformStatsService.getOverview();
    }
}
