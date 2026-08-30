package org.chama.rest;

import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import org.jboss.logging.Logger;

/**
 * Serializes the message a service attached to a thrown WebApplicationException.
 *
 * <p>Without this, the several dozen deliberately worded refusals in this codebase never reach
 * anyone. RESTEasy answers a bare {@code throw new BadRequestException("...")} with the right
 * status and an empty body, the message stays on the server, and the browser shows axios's
 * fallback text instead. The refusals are part of the product, not internal diagnostics: "this
 * member has history and can't be deleted, exit them instead" tells someone what to do next, and
 * "the member who requested this approval cannot also sign off on it" explains a rule that looks
 * like a bug when it appears as a bare 400.
 *
 * <p>Only 4xx messages are passed through. A 5xx is a fault rather than an answer, and its message
 * is a stack-trace-adjacent internal detail, so those are logged and replaced with a fixed line.
 *
 * <p>Bean validation is deliberately not touched here. Quarkus maps ConstraintViolationException
 * itself, and that is not a WebApplicationException, so its structured per-field body still stands.
 */
@Provider
public class WebApplicationExceptionMapper implements ExceptionMapper<WebApplicationException> {

    private static final Logger LOG = Logger.getLogger(WebApplicationExceptionMapper.class);
    private static final String SERVER_FAULT = "Something went wrong on our side. Please try again.";

    @Override
    public Response toResponse(WebApplicationException exception) {
        Response original = exception.getResponse();

        // A caller that built its own body meant it. Replacing it would silently discard a
        // considered answer, so it is passed straight back.
        if (original.hasEntity()) {
            return original;
        }

        int status = original.getStatus();
        Response.StatusType info = original.getStatusInfo();
        String reason = info != null ? info.getReasonPhrase() : "Error";

        String message;
        if (status >= 500) {
            LOG.errorf(exception, "Unhandled %d answering a request", status);
            message = SERVER_FAULT;
        } else {
            message = usableMessage(exception, reason);
        }

        return Response.status(status)
            .entity(new ApiErrorResponse(status, reason, message))
            .type(MediaType.APPLICATION_JSON)
            .build();
    }

    /**
     * The exception's own message, unless it is the one JAX-RS synthesises.
     *
     * <p>{@code new NotFoundException()} carries "HTTP 404 Not Found", which is the status restated
     * and worth nothing to a reader, so the reason phrase stands in for it instead.
     */
    private static String usableMessage(WebApplicationException exception, String reason) {
        String message = exception.getMessage();
        if (message == null || message.isBlank() || message.startsWith("HTTP " + exception.getResponse().getStatus())) {
            return reason;
        }
        return message;
    }
}
