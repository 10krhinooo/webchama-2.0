package org.chama.observability;

import io.sentry.Sentry;
import io.sentry.protocol.User;
import jakarta.enterprise.context.ApplicationScoped;

/**
 * The one place that hands an exception to Sentry.
 *
 * <p>Wrapping the static SDK call buys two things. Call sites get to stay ignorant of whether
 * reporting is configured at all, since {@code Sentry.captureException} on an uninitialised SDK is
 * a no-op and this keeps that fact in one file. And the user context is attached here, in the only
 * place that decides what a user is allowed to be: a Keycloak subject id and nothing else.
 *
 * <p>An opaque UUID is deliberately the whole of it. It is enough to see that one member hit the
 * same fault eleven times, which is the question worth asking of an error report, and not enough
 * to tell anyone who that member is. Names, phone numbers and emails would answer a question
 * nobody needs answered in a third-party system, so they never make the trip.
 */
@ApplicationScoped
public class ErrorReporter {

    /**
     * Reports a fault, attributing it to a member without identifying them.
     *
     * @param throwable    the fault
     * @param keycloakUserId the subject claim, or null for an unauthenticated request
     */
    public void report(Throwable throwable, String keycloakUserId) {
        if (throwable == null) {
            return;
        }
        Sentry.withScope(scope -> {
            if (keycloakUserId != null && !keycloakUserId.isBlank()) {
                User user = new User();
                user.setId(keycloakUserId);
                scope.setUser(user);
            }
            Sentry.captureException(throwable);
        });
    }

    /** Reports a fault with no user attached, for the paths that run outside a request. */
    public void report(Throwable throwable) {
        report(throwable, null);
    }
}
