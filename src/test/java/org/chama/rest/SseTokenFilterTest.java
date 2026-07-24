package org.chama.rest;

import io.quarkus.vertx.http.runtime.filters.Filters;
import io.vertx.core.Handler;
import io.vertx.core.MultiMap;
import io.vertx.core.http.HttpServerRequest;
import io.vertx.ext.web.RoutingContext;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SseTokenFilterTest {

    @SuppressWarnings("unchecked")
    private Handler<RoutingContext> capturedHandler() {
        Filters filters = mock(Filters.class);
        ArgumentCaptor<Handler<RoutingContext>> captor = ArgumentCaptor.forClass(Handler.class);
        when(filters.register(captor.capture(), anyInt())).thenReturn(filters);

        new SseTokenFilter().register(filters);

        verify(filters).register(any(), anyInt());
        return captor.getValue();
    }

    private RoutingContext contextFor(String path, String token) {
        RoutingContext rc = mock(RoutingContext.class);
        HttpServerRequest request = mock(HttpServerRequest.class);
        MultiMap headers = MultiMap.caseInsensitiveMultiMap();
        when(rc.request()).thenReturn(request);
        when(request.path()).thenReturn(path);
        when(request.getParam("token")).thenReturn(token);
        when(request.headers()).thenReturn(headers);
        return rc;
    }

    @Test
    void promotesTheTokenQueryParamToABearerHeaderOnTheStreamPath() {
        Handler<RoutingContext> handler = capturedHandler();
        RoutingContext rc = contextFor("/api/chamas/5/activity-log/stream", "abc123");

        handler.handle(rc);

        assertEquals("Bearer abc123", rc.request().headers().get("Authorization"));
        verify(rc).next();
    }

    @Test
    void leavesOtherPathsUntouched() {
        Handler<RoutingContext> handler = capturedHandler();
        RoutingContext rc = contextFor("/api/chamas/5/activity-log", "abc123");

        handler.handle(rc);

        assertNull(rc.request().headers().get("Authorization"));
        verify(rc).next();
    }

    @Test
    void ignoresAMissingToken() {
        Handler<RoutingContext> handler = capturedHandler();
        RoutingContext rc = contextFor("/api/chamas/5/activity-log/stream", null);

        handler.handle(rc);

        assertNull(rc.request().headers().get("Authorization"));
        verify(rc).next();
    }

    @Test
    void ignoresABlankToken() {
        Handler<RoutingContext> handler = capturedHandler();
        RoutingContext rc = contextFor("/api/chamas/5/activity-log/stream", "  ");

        handler.handle(rc);

        assertNull(rc.request().headers().get("Authorization"));
        verify(rc).next();
    }
}
