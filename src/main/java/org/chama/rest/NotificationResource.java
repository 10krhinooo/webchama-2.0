package org.chama.rest;

import io.quarkus.security.Authenticated;
import io.smallrye.common.annotation.Blocking;
import io.smallrye.mutiny.Multi;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import org.chama.dto.NotificationDto;
import org.chama.dto.NotificationPreferenceDto;
import org.chama.dto.UnreadCountDto;
import org.chama.security.CurrentUser;
import org.chama.service.NotificationBroadcaster;
import org.chama.service.NotificationService;
import org.jboss.resteasy.reactive.RestStreamElementType;

import java.util.List;

/**
 * A user's own notification inbox.
 *
 * Unlike every other resource here this is not chama-scoped, so {@link org.chama.security.TenantAccessService}
 * has nothing to check: there is no chama in the path. The authorisation rule is instead that every
 * query is scoped to the caller's own Keycloak id, and no endpoint accepts a user identifier at all.
 * That is deliberate, since an endpoint taking a user id would need a rule about whose ids are
 * acceptable, and the simplest way to get that rule right is not to have it.
 */
@Path("/api/notifications")
@Authenticated
public class NotificationResource {

    /** Caps a page so a client cannot ask for an unbounded inbox in one request. */
    private static final int MAX_PAGE_SIZE = 100;

    @Inject
    NotificationService notificationService;

    @Inject
    NotificationBroadcaster notificationBroadcaster;

    @Inject
    CurrentUser currentUser;

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public List<NotificationDto> list(@QueryParam("page") @DefaultValue("0") int page,
                                      @QueryParam("size") @DefaultValue("20") int size,
                                      @QueryParam("unreadOnly") @DefaultValue("false") boolean unreadOnly) {
        int cappedSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        return notificationService
            .list(currentUser.getKeycloakUserId(), unreadOnly, Math.max(page, 0), cappedSize)
            .stream()
            .map(NotificationDto::from)
            .toList();
    }

    @GET
    @Path("/unread-count")
    @Produces(MediaType.APPLICATION_JSON)
    public UnreadCountDto unreadCount() {
        return new UnreadCountDto(notificationService.unreadCount(currentUser.getKeycloakUserId()));
    }

    /**
     * Live stream of this user's notifications.
     *
     * The filter inside the broadcaster is the whole authorisation boundary for this endpoint,
     * which is why the caller's id is read from the token here and never taken from the request.
     */
    @GET
    @Path("/stream")
    @Produces(MediaType.SERVER_SENT_EVENTS)
    @RestStreamElementType(MediaType.APPLICATION_JSON)
    @Blocking
    public Multi<NotificationDto> stream() {
        return notificationBroadcaster.streamForUser(currentUser.getKeycloakUserId());
    }

    /**
     * Marks one notification read.
     *
     * Answers 404 rather than 403 for a notification belonging to someone else. A 403 would
     * confirm the id exists, which is more than a caller is entitled to know about another user's
     * inbox. An already-read notification is also 404, since the update matches nothing.
     */
    @PUT
    @Path("/{id}/read")
    @Produces(MediaType.APPLICATION_JSON)
    public void markRead(@PathParam("id") Long id) {
        if (!notificationService.markRead(currentUser.getKeycloakUserId(), id)) {
            throw new NotFoundException();
        }
    }

    @PUT
    @Path("/read-all")
    @Produces(MediaType.APPLICATION_JSON)
    public UnreadCountDto markAllRead() {
        notificationService.markAllRead(currentUser.getKeycloakUserId());
        return new UnreadCountDto(0);
    }

    @GET
    @Path("/preferences")
    @Produces(MediaType.APPLICATION_JSON)
    public List<NotificationPreferenceDto> preferences() {
        return notificationService.preferencesFor(currentUser.getKeycloakUserId()).stream()
            .map(NotificationPreferenceDto::from)
            .toList();
    }

    /**
     * Replaces the caller's preferences for the families named in the body.
     *
     * Families the body does not mention are left alone rather than reset, so a client that knows
     * about fewer families than the server does cannot silently switch the rest back on.
     */
    @PUT
    @Path("/preferences")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public List<NotificationPreferenceDto> updatePreferences(@Valid List<NotificationPreferenceDto> body) {
        String userId = currentUser.getKeycloakUserId();
        for (NotificationPreferenceDto preference : body) {
            notificationService.updatePreference(
                userId, preference.eventFamily(), preference.inAppEnabled(), preference.emailEnabled());
        }
        return notificationService.preferencesFor(userId).stream()
            .map(NotificationPreferenceDto::from)
            .toList();
    }
}
