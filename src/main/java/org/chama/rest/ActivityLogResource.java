package org.chama.rest;

import io.quarkus.security.Authenticated;
import io.smallrye.common.annotation.Blocking;
import io.smallrye.mutiny.Multi;
import jakarta.inject.Inject;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import org.chama.domain.enums.MemberRoleType;
import org.chama.dto.ActivityLogDto;
import org.chama.repository.ActivityLogRepository;
import org.chama.security.CurrentUser;
import org.chama.security.TenantAccessService;
import org.chama.service.ActivityFeedBroadcaster;
import org.jboss.resteasy.reactive.RestStreamElementType;

import java.util.List;

@Path("/api/chamas/{chamaId}/activity-log")
@Authenticated
public class ActivityLogResource {

    private static final MemberRoleType[] MANAGER_ROLES =
        { MemberRoleType.CHAIRPERSON, MemberRoleType.TREASURER, MemberRoleType.SECRETARY };

    @Inject
    ActivityLogRepository activityLogRepository;

    @Inject
    ActivityFeedBroadcaster activityFeedBroadcaster;

    @Inject
    TenantAccessService tenantAccessService;

    @Inject
    CurrentUser currentUser;

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public List<ActivityLogDto> list(@PathParam("chamaId") Long chamaId,
                                      @QueryParam("page") @DefaultValue("0") int page,
                                      @QueryParam("size") @DefaultValue("20") int size) {
        tenantAccessService.requireRole(currentUser, chamaId, MANAGER_ROLES);
        return activityLogRepository.findRecentForChama(chamaId, page, size).stream()
            .map(ActivityLogDto::from).toList();
    }

    @GET
    @Path("/stream")
    @Produces(MediaType.SERVER_SENT_EVENTS)
    @RestStreamElementType(MediaType.APPLICATION_JSON)
    @Blocking
    public Multi<ActivityLogDto> stream(@PathParam("chamaId") Long chamaId) {
        tenantAccessService.requireRole(currentUser, chamaId, MANAGER_ROLES);
        return activityFeedBroadcaster.streamForChama(chamaId);
    }
}
