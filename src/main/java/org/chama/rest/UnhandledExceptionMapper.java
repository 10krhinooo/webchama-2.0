package org.chama.rest;

import io.quarkus.arc.Arc;
import jakarta.inject.Inject;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import org.chama.observability.ErrorReporter;
import org.chama.security.CurrentUser;
import org.jboss.logging.Logger;

/**
 * Catches the faults nobody wrote a mapper for, so they are reported rather than only logged.
 *
 * <p>{@link WebApplicationExceptionMapper} handles the deliberate refusals, which are answers
 * rather than faults. This handles everything else: a NullPointerException, a database constraint
 * nobody anticipated, a provider client throwing on a response shape that changed. Those never
 * reached that mapper at all, so before this class they were a stack trace in a container log and
 * a "something went wrong" for the member, with nothing in between.
 *
 * <p>JAX-RS picks the most specific mapper for a thrown type, so registering one for Throwable does
 * not shadow the more specific ones: a WebApplicationException still goes to its own mapper, and
 * bean validation still produces Quarkus's structured per-field body. Both are covered by tests,
 * because "the general mapper quietly swallowed the specific one" is the failure this design
 * invites and it would show up as worse error messages rather than as a broken build.
 *
 * <p>The response body deliberately matches the 5xx shape the other mapper produces. A member
 * should not be able to tell which internal path failed, and a fault's message is a
 * stack-trace-adjacent internal detail.
 */
@Provider
public class UnhandledExceptionMapper implements ExceptionMapper<Throwable> {

    private static final Logger LOG = Logger.getLogger(UnhandledExceptionMapper.class);
    private static final String SERVER_FAULT = "Something went wrong on our side. Please try again.";

    @Inject
    ErrorReporter errorReporter;

    @Override
    public Response toResponse(Throwable throwable) {
        LOG.error("Unhandled fault answering a request", throwable);
        errorReporter.report(throwable, currentKeycloakUserId());

        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
            .entity(new ApiErrorResponse(500, "Internal Server Error", SERVER_FAULT))
            .type(MediaType.APPLICATION_JSON)
            .build();
    }

    /**
     * The caller's subject id, or null when there is not one to be had.
     *
     * <p>Resolved through Arc rather than an injected {@code CurrentUser}, because this mapper is a
     * singleton and the fault it is handling may have been thrown outside an active request scope,
     * where touching a request-scoped proxy throws a second exception on top of the first. Losing
     * the user attribution on an error report is a small cost; turning one fault into two while
     * handling it is not.
     */
    private String currentKeycloakUserId() {
        try {
            CurrentUser user = Arc.container().instance(CurrentUser.class).get();
            return user == null ? null : user.getKeycloakUserId();
        } catch (RuntimeException ignored) {
            return null;
        }
    }
}
