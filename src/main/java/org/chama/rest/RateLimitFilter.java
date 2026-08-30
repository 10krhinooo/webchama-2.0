package org.chama.rest;

import io.quarkus.scheduler.Scheduled;
import io.vertx.ext.web.RoutingContext;
import jakarta.annotation.Priority;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.PreMatching;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Predicate;

/**
 * Simple in-memory, per-IP rate limiter for money-moving endpoints (STK push / card checkout
 * initiation) and payment provider webhooks. Chama payment endpoints are nested under a
 * variable chamaId/contributionId path (/api/chamas/{chamaId}/contributions/{id}/pay/mpesa),
 * so matching is by path-suffix predicate rather than a fixed-prefix map. Single Quarkus
 * instance, no distributed cache/redis, so this is deliberately a fixed-window in-memory
 * counter, not a token-bucket or sliding-log scheme, good enough for abuse containment, not
 * perfect burst smoothing.
 */
@Provider
@PreMatching
@Priority(Priorities.AUTHENTICATION - 100)
@ApplicationScoped
public class RateLimitFilter implements ContainerRequestFilter {

    private record Rule(String name, Predicate<String> matcher, int maxRequests, long windowMillis) {}

    // Longest/most-specific match first: /pay/card/verify must be checked before /pay/card,
    // otherwise the /pay/card rule's endsWith would never let /pay/card/verify fall through to
    // its own, more generous, rule.
    private static final List<Rule> RULES = List.of(
        new Rule("card-verify", p -> p.endsWith("/pay/card/verify"), 30, Duration.ofMinutes(1).toMillis()),
        new Rule("mpesa-push", p -> p.endsWith("/pay/mpesa"), 10, Duration.ofMinutes(1).toMillis()),
        new Rule("card-init", p -> p.endsWith("/pay/card"), 15, Duration.ofMinutes(1).toMillis()),
        // Every disbursement endpoint, not only the loan one: the suffix covers loan payouts and
        // welfare fund withdrawals alike, which is the behaviour wanted since both move real money.
        new Rule("disburse", p -> p.endsWith("/disburse"), 10, Duration.ofMinutes(1).toMillis()),
        new Rule("mpesa-callback", p -> p.equals("/api/payments/mpesa-callback"), 60, Duration.ofMinutes(1).toMillis()),
        new Rule("card-callback", p -> p.equals("/api/payments/card/callback"), 60, Duration.ofMinutes(1).toMillis()),
        new Rule("b2c-callback", p -> p.equals("/api/payments/b2c-callback"), 60, Duration.ofMinutes(1).toMillis()),
        new Rule("b2c-timeout", p -> p.equals("/api/payments/b2c-timeout"), 60, Duration.ofMinutes(1).toMillis())
    );

    private static final long STALE_AFTER_MILLIS = Duration.ofMinutes(30).toMillis();

    private static final class WindowCounter {
        private final AtomicInteger count = new AtomicInteger(0);
        private volatile long windowStartMillis = System.currentTimeMillis();
        private volatile long lastSeenMillis = System.currentTimeMillis();

        synchronized boolean tryConsume(int max, long windowMillis) {
            long now = System.currentTimeMillis();
            lastSeenMillis = now;
            if (now - windowStartMillis > windowMillis) {
                windowStartMillis = now;
                count.set(0);
            }
            return count.incrementAndGet() <= max;
        }

        boolean isStale(long cutoffMillis) {
            return lastSeenMillis < cutoffMillis;
        }
    }

    private final ConcurrentHashMap<String, WindowCounter> counters = new ConcurrentHashMap<>();

    @Context
    RoutingContext routingContext;

    @Override
    public void filter(ContainerRequestContext ctx) {
        String path = ctx.getUriInfo().getPath();
        Rule rule = matchRule(path);
        if (rule == null) return;

        String key = clientIp() + ":" + rule.name();
        WindowCounter counter = counters.computeIfAbsent(key, k -> new WindowCounter());

        if (!counter.tryConsume(rule.maxRequests(), rule.windowMillis())) {
            ctx.abortWith(Response.status(429)
                .entity(Map.of("error", "Too many requests, please try again shortly."))
                .build());
        }
    }

    private static Rule matchRule(String path) {
        for (Rule rule : RULES) {
            if (rule.matcher().test(path)) return rule;
        }
        return null;
    }

    /**
     * X-Forwarded-For is caller-supplied and only meaningful if a real reverse proxy sits between
     * the caller and this instance, otherwise a caller can set it to an arbitrary value per
     * request and get a fresh rate-limit bucket every time, defeating this filter entirely
     * (CWE-290, spoofable-field bypass). Only honored when the direct TCP peer is on a
     * loopback/private network (a local nginx/traefik, docker networking, a real ingress), i.e.
     * an actual proxy, not an arbitrary public client, and even then the rightmost entry is used
     * (the one that proxy actually observed), not the leftmost (whatever the original caller put
     * there).
     */
    String clientIp() {
        if (routingContext == null || routingContext.request() == null) return "unknown";
        var remote = routingContext.request().remoteAddress();
        String peerHost = remote != null ? remote.host() : null;

        if (peerHost != null && isTrustedProxy(peerHost)) {
            String forwarded = routingContext.request().getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) {
                String[] hops = forwarded.split(",");
                return hops[hops.length - 1].trim();
            }
        }
        return peerHost != null ? peerHost : "unknown";
    }

    private static boolean isTrustedProxy(String host) {
        try {
            InetAddress addr = InetAddress.getByName(host);
            return addr.isLoopbackAddress() || addr.isSiteLocalAddress() || addr.isLinkLocalAddress();
        } catch (UnknownHostException e) {
            return false;
        }
    }

    /** Bounds memory growth from unique-IP churn over app uptime. */
    @Scheduled(every = "10m", identity = "rate-limit-cleanup",
        concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void cleanup() {
        long cutoff = System.currentTimeMillis() - STALE_AFTER_MILLIS;
        counters.entrySet().removeIf(e -> e.getValue().isStale(cutoff));
    }
}
