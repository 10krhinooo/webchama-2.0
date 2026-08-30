package org.chama.rest;

import io.quarkus.vertx.http.runtime.filters.Filters;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;

/**
 * Browser EventSource cannot set a custom Authorization header, so the activity-log stream is
 * opened with the access token as a query param instead. This promotes it to a real Bearer
 * header at the Vert.x route level, before Quarkus OIDC authentication runs, so the stream
 * endpoint stays behind the same @Authenticated + tenant-role gate as every other resource.
 * A JAX-RS ContainerRequestFilter would be too late: OIDC authenticates off the raw Vert.x
 * request before RESTEasy Reactive's own filter chain ever runs.
 */
@ApplicationScoped
public class SseTokenFilter {

    void register(@Observes Filters filters) {
        filters.register(routingContext -> {
            String path = routingContext.request().path();
            // EventSource cannot set headers, so both streams pass the token as a query
            // parameter and it is promoted here. Any new stream endpoint has to be added, or it
            // will simply answer 401 with nothing explaining why.
            if (path.endsWith("/activity-log/stream") || path.endsWith("/notifications/stream")) {
                String token = routingContext.request().getParam("token");
                if (token != null && !token.isBlank()) {
                    routingContext.request().headers().set("Authorization", "Bearer " + token);
                }
            }
            routingContext.next();
        }, 300);
    }
}
