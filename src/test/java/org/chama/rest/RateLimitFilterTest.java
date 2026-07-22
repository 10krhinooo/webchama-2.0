package org.chama.rest;

import io.vertx.core.http.HttpServerRequest;
import io.vertx.core.net.SocketAddress;
import io.vertx.ext.web.RoutingContext;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * clientIp() must not let a caller spoof its own rate-limit bucket via X-Forwarded-For
 * (CWE-290) unless the request actually came through a trusted (loopback/private) proxy.
 * matchRule() must pick the more specific "/pay/card/verify" rule over the "/pay/card" rule.
 */
class RateLimitFilterTest {

    private RateLimitFilter filterWith(String peerHost, String forwardedFor) {
        HttpServerRequest request = mock(HttpServerRequest.class);
        SocketAddress remote = mock(SocketAddress.class);
        when(remote.host()).thenReturn(peerHost);
        when(request.remoteAddress()).thenReturn(remote);
        when(request.getHeader("X-Forwarded-For")).thenReturn(forwardedFor);

        RoutingContext routingContext = mock(RoutingContext.class);
        when(routingContext.request()).thenReturn(request);

        RateLimitFilter filter = new RateLimitFilter();
        filter.routingContext = routingContext;
        return filter;
    }

    @Test
    void ignoresSpoofedHeaderFromUntrustedPublicPeer() {
        RateLimitFilter filter = filterWith("203.0.113.5", "9.9.9.9");
        assertEquals("203.0.113.5", filter.clientIp());
    }

    @Test
    void honorsHeaderFromLoopbackProxyAndTakesRightmostHop() {
        RateLimitFilter filter = filterWith("127.0.0.1", "9.9.9.9, 10.0.0.5");
        assertEquals("10.0.0.5", filter.clientIp());
    }

    @Test
    void honorsHeaderFromPrivateNetworkProxy() {
        RateLimitFilter filter = filterWith("10.0.0.1", "203.0.113.9");
        assertEquals("203.0.113.9", filter.clientIp());
    }

    @Test
    void fallsBackToPeerWhenNoHeaderPresentEvenFromTrustedProxy() {
        RateLimitFilter filter = filterWith("127.0.0.1", null);
        assertEquals("127.0.0.1", filter.clientIp());
    }

    @Test
    void returnsUnknownWhenNoRoutingContext() {
        RateLimitFilter filter = new RateLimitFilter();
        assertEquals("unknown", filter.clientIp());
    }

    private ContainerRequestContext ctxFor(String path) {
        UriInfo uriInfo = mock(UriInfo.class);
        when(uriInfo.getPath()).thenReturn(path);
        ContainerRequestContext ctx = mock(ContainerRequestContext.class);
        when(ctx.getUriInfo()).thenReturn(uriInfo);
        return ctx;
    }

    @Test
    void matchesCardVerifySuffixBeforeTheBroaderCardSuffix() {
        RateLimitFilter filter = filterWith("203.0.113.5", null);
        ContainerRequestContext ctx = ctxFor("/api/chamas/1/contributions/2/pay/card/verify");

        // The card-verify rule allows 30/min, well above the card-init rule's 15/min, so 16
        // requests must all pass if the more specific rule was actually selected.
        for (int i = 0; i < 16; i++) {
            filter.filter(ctx);
        }
        verify(ctx, never()).abortWith(any());
    }

    @Test
    void abortsWithTooManyRequestsOnceTheWindowLimitIsExceeded() {
        RateLimitFilter filter = filterWith("203.0.113.6", null);
        ContainerRequestContext ctx = ctxFor("/api/chamas/1/contributions/2/pay/mpesa");

        for (int i = 0; i < 10; i++) {
            filter.filter(ctx);
        }
        verify(ctx, never()).abortWith(any());

        filter.filter(ctx);
        verify(ctx, times(1)).abortWith(any(Response.class));
    }

    @Test
    void doesNotRateLimitUnrelatedPaths() {
        RateLimitFilter filter = filterWith("203.0.113.7", null);
        ContainerRequestContext ctx = ctxFor("/api/chamas/1/members");

        for (int i = 0; i < 100; i++) {
            filter.filter(ctx);
        }
        verify(ctx, never()).abortWith(any());
    }
}
