package org.chama.rest;

import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.chama.observability.ErrorReporter;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;

class UnhandledExceptionMapperTest {

    private static final class RecordingReporter extends ErrorReporter {
        private final List<Throwable> reported = new ArrayList<>();

        @Override
        public void report(Throwable throwable, String keycloakUserId) {
            reported.add(throwable);
        }
    }

    private final RecordingReporter reporter = new RecordingReporter();
    private final UnhandledExceptionMapper mapper = new UnhandledExceptionMapper();

    {
        mapper.errorReporter = reporter;
    }

    @Test
    void reportsTheFault() {
        RuntimeException fault = new NullPointerException("rotation had no next member");
        mapper.toResponse(fault);

        assertEquals(1, reporter.reported.size());
        assertSame(fault, reporter.reported.get(0));
    }

    @Test
    void answersWithTheSameOpaqueBodyTheOtherMapperUses() {
        Response response = mapper.toResponse(new IllegalStateException("boom"));

        assertEquals(500, response.getStatus());
        assertEquals(MediaType.APPLICATION_JSON_TYPE, response.getMediaType());
        ApiErrorResponse body = (ApiErrorResponse) response.getEntity();
        assertEquals(500, body.status());
        assertEquals("Something went wrong on our side. Please try again.", body.message());
    }

    // A fault's message is a stack-trace-adjacent internal detail. A member should not be able to
    // tell which internal path failed, let alone read a SQL constraint name.
    @Test
    void neverLeaksTheFaultsOwnMessage() {
        Response response = mapper.toResponse(
            new IllegalStateException("could not extract ResultSet; constraint [member_phone_key]"));

        ApiErrorResponse body = (ApiErrorResponse) response.getEntity();
        assertFalse(body.message().contains("member_phone_key"), body.message());
        assertFalse(body.message().contains("ResultSet"), body.message());
    }

    // Outside a request there is no CurrentUser to resolve, and turning one fault into two while
    // handling it would be worse than losing the attribution.
    @Test
    void stillAnswersWhenThereIsNoRequestScope() {
        Response response = mapper.toResponse(new RuntimeException("scheduled sweep failed"));
        assertEquals(500, response.getStatus());
        assertEquals(1, reporter.reported.size());
    }
}
