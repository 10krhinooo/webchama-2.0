package org.chama.observability;

import io.sentry.SentryEvent;
import io.sentry.SentryOptions;
import io.sentry.protocol.Request;
import io.sentry.protocol.User;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The scrubbing, which is the part of error reporting whose failure is silent.
 *
 * <p>A leak here does not break a build or show up in a log. It looks exactly like working error
 * monitoring, and the only symptom is member phone numbers sitting in a third-party system. So
 * these assert the absence of things rather than the presence of them, which is the awkward
 * direction to test in and the only one that matters here.
 *
 * <p>Plain unit tests, not {@code @QuarkusTest}: the options are asserted without starting a client
 * or sending anything anywhere.
 */
class SentryConfigurationTest {

    @Test
    void doesNotSendPersonallyIdentifyingDataByDefault() {
        SentryOptions options = new SentryOptions();
        SentryConfiguration.apply(options, "https://key@example.invalid/1", "production", "1.2.3");

        assertFalse(options.isSendDefaultPii(), "PII must stay off, this schema encrypts phones and national ids");
        assertEquals(SentryOptions.RequestSize.NONE, options.getMaxRequestBodySize(),
            "request bodies carry M-Pesa phone numbers, they must never be held");
    }

    @Test
    void carriesEnvironmentAndRelease() {
        SentryOptions options = new SentryOptions();
        SentryConfiguration.apply(options, "https://key@example.invalid/1", "production", "1.2.3");

        assertEquals("production", options.getEnvironment());
        assertEquals("1.2.3", options.getRelease());
        assertNotNull(options.getBeforeSend(), "the backstop must be installed");
    }

    @Test
    void leavesReleaseUnsetWhenThereIsNotOne() {
        SentryOptions options = new SentryOptions();
        SentryConfiguration.apply(options, "https://key@example.invalid/1", "staging", "");

        assertNull(options.getRelease());
    }

    // Errors, not APM. Sampling for performance is a separate decision with its own cost.
    @Test
    void doesNotSampleTraces() {
        SentryOptions options = new SentryOptions();
        SentryConfiguration.apply(options, "https://key@example.invalid/1", "production", "");

        assertNull(options.getTracesSampleRate());
    }

    @Test
    void stripsTheWholeRequestFromAnEvent() {
        SentryEvent event = new SentryEvent();
        Request request = new Request();
        request.setData("{\"phone\":\"254712000001\"}");
        request.setQueryString("msisdn=254712000001");
        Map<String, String> headers = new HashMap<>();
        headers.put("Authorization", "Bearer secret");
        request.setHeaders(headers);
        request.setCookies("session=abc");
        event.setRequest(request);

        SentryConfiguration.scrub(event);

        assertNull(event.getRequest().getData());
        assertNull(event.getRequest().getQueryString());
        assertNull(event.getRequest().getHeaders());
        assertNull(event.getRequest().getCookies());
    }

    @Test
    void keepsTheSubjectIdAndDiscardsEverythingElseAboutTheUser() {
        SentryEvent event = new SentryEvent();
        User user = new User();
        user.setId("3f2a-uuid");
        user.setUsername("grace.wanjiru");
        user.setEmail("grace@example.com");
        user.setIpAddress("41.90.0.1");
        event.setUser(user);

        SentryConfiguration.scrub(event);

        // Enough to tell two members' errors apart, not enough to tell anyone who they are.
        assertEquals("3f2a-uuid", event.getUser().getId());
        assertNull(event.getUser().getUsername());
        assertNull(event.getUser().getEmail());
        assertNull(event.getUser().getIpAddress());
    }

    @Test
    void dropsTagsAndExtrasWhoseNamesSuggestMemberData() {
        SentryEvent event = new SentryEvent();
        event.setTag("chamaId", "7");
        event.setTag("memberPhone", "254712000001");
        event.setExtra("nationalId", "12345678");
        event.setExtra("roundNumber", 3);

        SentryConfiguration.scrub(event);

        // The safe ones survive, or the reports would be useless.
        assertEquals("7", event.getTags().get("chamaId"));
        assertEquals(3, event.getExtras().get("roundNumber"));
        assertNull(event.getTags().get("memberPhone"));
        assertNull(event.getExtras().get("nationalId"));
    }

    @Test
    void toleratesAnEventCarryingNothing() {
        SentryEvent event = new SentryEvent();
        SentryConfiguration.scrub(event);
        assertNull(event.getRequest());
        assertNull(event.getUser());
    }

    @Test
    void matchesForbiddenKeysWhateverTheirCasing() {
        assertTrue(SentryConfiguration.isForbidden("MemberPhone"));
        assertTrue(SentryConfiguration.isForbidden("AUTHORIZATION"));
        assertTrue(SentryConfiguration.isForbidden("mpesa_passkey"));
        assertTrue(SentryConfiguration.isForbidden("national_id"));
        assertFalse(SentryConfiguration.isForbidden("chamaId"));
        assertFalse(SentryConfiguration.isForbidden("roundNumber"));
        assertFalse(SentryConfiguration.isForbidden(null));
    }
}
