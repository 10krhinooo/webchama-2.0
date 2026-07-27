package org.chama.service.notification;

import io.quarkus.mailer.MockMailbox;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.chama.domain.enums.KeycloakEventSource;
import org.chama.domain.model.KeycloakSecurityEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * app.security.alert-emails is unset in the default test profile (see application.properties),
 * so this covers the disabled-by-default path plus buildHtml's own content. The
 * recipients-configured/actually-sends path is covered by
 * SecurityAlertEmailServiceWithRecipientsTest, a separate @TestProfile class, config overrides
 * only apply per test class in Quarkus.
 */
@QuarkusTest
class SecurityAlertEmailServiceTest {

    @Inject
    SecurityAlertEmailService service;

    @Inject
    MockMailbox mailbox;

    @BeforeEach
    void clear() {
        mailbox.clear();
    }

    private static KeycloakSecurityEvent lockoutEvent() {
        KeycloakSecurityEvent event = new KeycloakSecurityEvent();
        event.source = KeycloakEventSource.LOGIN;
        event.eventTime = Instant.now();
        event.type = "LOGIN_ERROR";
        event.error = "user_temporarily_disabled";
        event.keycloakUserId = "user-1";
        event.ipAddress = "10.0.0.5";
        event.dedupeKey = "test-lockout-row";
        return event;
    }

    @Test
    void sendsNothingWhenNoAlertRecipientsAreConfigured() throws Exception {
        service.alertSuspiciousEvent(lockoutEvent());

        // Give the async send path a moment to run, then confirm it never reached the mailbox.
        Thread.sleep(200);
        assertEquals(0, mailbox.getTotalMessagesSent());
    }

    @Test
    void buildHtmlIncludesTheEventDetails() {
        String html = service.buildHtml(lockoutEvent());

        assertTrue(html.contains("user_temporarily_disabled"));
        assertTrue(html.contains("user-1"));
        assertTrue(html.contains("10.0.0.5"));
        assertTrue(html.contains("LOGIN_ERROR"));
    }
}
