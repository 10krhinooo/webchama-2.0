package org.chama.rest;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.InternalServerErrorException;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.chama.observability.ErrorReporter;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WebApplicationExceptionMapperTest {

    /** Records what was reported instead of sending it, so the 4xx/5xx split can be asserted. */
    private static final class RecordingReporter extends ErrorReporter {
        private final List<Throwable> reported = new ArrayList<>();

        @Override
        public void report(Throwable throwable, String keycloakUserId) {
            reported.add(throwable);
        }
    }

    private final RecordingReporter reporter = new RecordingReporter();
    private final WebApplicationExceptionMapper mapper = new WebApplicationExceptionMapper();

    {
        // Field injection, so a directly constructed mapper has to be wired by hand.
        mapper.errorReporter = reporter;
    }

    private ApiErrorResponse map(WebApplicationException exception) {
        Response response = mapper.toResponse(exception);
        assertEquals(MediaType.APPLICATION_JSON_TYPE, response.getMediaType());
        return (ApiErrorResponse) response.getEntity();
    }

    @Test
    void aRefusalCarriesTheMessageTheServiceWrote() {
        ApiErrorResponse body = map(new BadRequestException(
            "This member has history and can't be deleted. Set their status to EXITED instead."));

        assertEquals(400, body.status());
        assertEquals("Bad Request", body.error());
        assertTrue(body.message().contains("EXITED"), body.message());
    }

    @Test
    void theStatusIsPreserved() {
        assertEquals(403, mapper.toResponse(new ForbiddenException()).getStatus());
    }

    @Test
    void aSynthesisedMessageIsReplacedByTheReasonPhrase() {
        // new NotFoundException() carries "HTTP 404 Not Found", which only restates the status.
        assertEquals("Not Found", map(new NotFoundException()).message());
    }

    @Test
    void aBlankMessageFallsBackToTheReasonPhrase() {
        assertEquals("Bad Request", map(new BadRequestException("   ")).message());
    }

    @Test
    void aServerFaultNeverLeaksItsOwnMessage() {
        ApiErrorResponse body = map(new InternalServerErrorException(
            "could not extract ResultSet; SQL [n/a]; constraint [member_phone_key]"));

        assertEquals(500, body.status());
        assertEquals("Something went wrong on our side. Please try again.", body.message());
    }

    @Test
    void aServerFaultIsReported() {
        map(new InternalServerErrorException("constraint [member_phone_key]"));
        assertEquals(1, reporter.reported.size());
    }

    // A refusal is an answer the product meant to give. Reporting those would bury the real faults
    // under a stream of "that member has history and cannot be deleted".
    @Test
    void aDeliberateRefusalIsNotReported() {
        map(new BadRequestException("This member has history and can't be deleted."));
        map(new NotFoundException());
        map(new ForbiddenException());

        assertTrue(reporter.reported.isEmpty(), "4xx must not reach the error reporter");
    }

    @Test
    void aCallerThatBuiltItsOwnBodyKeepsIt() {
        Response deliberate = Response.status(409).entity("mine").build();

        assertSame(deliberate, mapper.toResponse(new WebApplicationException(deliberate)));
    }
}
