package org.chama.rest;

import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import org.chama.dto.SecurityEventDto;
import org.chama.repository.KeycloakSecurityEventRepository;
import org.chama.security.CurrentUser;

import java.util.List;

/**
 * SUPER_ADMIN-only read view over ingested Keycloak login/admin events (see
 * KeycloakSecurityEventSyncService), the cross-chama platform oversight view MIGRATION_PLAN.md
 * section 5 describes for SUPER_ADMIN. Platform-level, not chama-scoped, so this goes through
 * CurrentUser.isSuperAdmin() directly rather than TenantAccessService, which only resolves
 * per-chama roles.
 */
@Path("/api/admin/security-events")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
public class SecurityEventResource {

    private static final int MAX_LIMIT = 500;

    @Inject
    KeycloakSecurityEventRepository repository;

    @Inject
    CurrentUser currentUser;

    @GET
    public List<SecurityEventDto> list(@QueryParam("type") String type,
                                        @QueryParam("error") String error,
                                        @QueryParam("keycloakUserId") String keycloakUserId,
                                        @QueryParam("limit") @DefaultValue("100") int limit) {
        if (!currentUser.isSuperAdmin()) {
            throw new ForbiddenException();
        }
        int cappedLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);
        return repository.search(type, error, keycloakUserId, cappedLimit).stream()
            .map(SecurityEventDto::from).toList();
    }
}
