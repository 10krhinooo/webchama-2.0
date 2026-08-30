package org.chama.service.notification;

import org.eclipse.microprofile.context.ManagedExecutor;
import org.eclipse.microprofile.context.ThreadContext;

/**
 * The one thread pool every email in this package is sent on.
 *
 * <p>Each service used to build its own unbounded {@link ManagedExecutor}, which was fine while
 * mail was only ever sent one message at a time in response to a user action. Bulk member import
 * changes that: a three hundred row file would previously have opened three hundred concurrent
 * SMTP handshakes and been throttled or dropped by the provider. Bounding it costs nothing in the
 * one-at-a-time case and turns the bulk case into a queue.
 *
 * <p>maxQueued is deliberately large. Mail is best effort and already off the request thread, so a
 * queue that fills would start rejecting sends rather than slowing them, which is the one failure
 * mode worse than sending slowly.
 *
 * <p>Context is cleared rather than propagated, and that is load-bearing rather than tidiness.
 * The CDI-default ManagedExecutor propagates the caller's active JTA transaction onto the
 * background thread, because this project pulls in smallrye-context-propagation-jta, so a plain
 * injected ManagedExecutor collides with the caller's own commit and fails with "Enlisted
 * connection used without active transaction". Nothing sent here needs any propagated context.
 */
final class MailExecutor {

    private static final int MAX_CONCURRENT_SENDS = 4;
    private static final int MAX_QUEUED_SENDS = 2000;

    static final ManagedExecutor INSTANCE = ManagedExecutor.builder()
        .propagated(ThreadContext.NONE)
        .cleared(ThreadContext.ALL_REMAINING)
        .maxAsync(MAX_CONCURRENT_SENDS)
        .maxQueued(MAX_QUEUED_SENDS)
        .build();

    private MailExecutor() {
    }
}
