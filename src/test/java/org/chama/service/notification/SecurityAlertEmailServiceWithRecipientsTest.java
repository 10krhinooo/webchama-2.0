package org.chama.service.notification;

import io.quarkus.mailer.Mail;
import io.quarkus.mailer.MockMailbox;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;
import org.chama.domain.enums.KeycloakEventSource;
import org.chama.domain.model.KeycloakSecurityEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Separate @TestProfile class so app.security.alert-emails can be set without affecting every other test in the suite. */
@QuarkusTest
@TestProfile(SecurityAlertEmailServiceWithRecipientsTest.WithRecipients.class)
class SecurityAlertEmailServiceWithRecipientsTest {

    public static class WithRecipients implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of("app.security.alert-emails", "owner1@example.com, owner2@example.com");
        }
    }

    @Inject
    SecurityAlertEmailService service;

    @Inject
    MockMailbox mailbox;

    @BeforeEach
    void clear() {
        mailbox.clear();
    }

    @Test
    void sendsAnAlertToEveryConfiguredRecipient() {
        KeycloakSecurityEvent event = new KeycloakSecurityEvent();
        event.source = KeycloakEventSource.LOGIN;
        event.eventTime = Instant.now();
        event.type = "LOGIN_ERROR";
        event.error = "user_temporarily_disabled";
        event.keycloakUserId = "user-1";
        event.ipAddress = "10.0.0.5";
        event.dedupeKey = "test-lockout-row-2";

        service.alertSuspiciousEvent(event);

        await().atMost(Duration.ofSeconds(5)).untilAsserted(() -> {
            List<Mail> toOwner1 = mailbox.getMailsSentTo("owner1@example.com");
            List<Mail> toOwner2 = mailbox.getMailsSentTo("owner2@example.com");
            assertEquals(1, toOwner1.size());
            assertEquals(1, toOwner2.size());
            assertTrue(toOwner1.get(0).getSubject().contains("LOGIN_ERROR"));
        });
    }
}
