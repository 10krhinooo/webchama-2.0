package org.chama.service;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Exercises the real Keycloak Admin API against the docker-compose Keycloak
 * instance (also started in CI, see .github/workflows/ci.yml), rather than
 * mocking this class the way its callers do, so the provisioning flow it
 * backs is actually proven to work end to end.
 */
@QuarkusTest
class KeycloakAdminServiceTest {

    @Inject
    KeycloakAdminService keycloakAdminService;

    @Test
    void createUserThenFindingItByEmailReturnsTheSameId() throws Exception {
        String email = "kc-admin-test-" + UUID.randomUUID() + "@example.com";

        String createdId = keycloakAdminService.createUser(email, "Test User", keycloakAdminService.generateTempPassword());
        assertNotNull(createdId);

        String foundId = keycloakAdminService.findUserByEmail(email);
        assertEquals(createdId, foundId);
    }

    @Test
    void findUserByEmailReturnsNullForAnUnknownEmail() throws Exception {
        String email = "does-not-exist-" + UUID.randomUUID() + "@example.com";
        assertNull(keycloakAdminService.findUserByEmail(email));
    }

    @Test
    void getUserEmailReturnsTheEmailOfARealAccount() throws Exception {
        String email = "kc-get-email-test-" + UUID.randomUUID() + "@example.com";
        String userId = keycloakAdminService.createUser(email, "Get Email Test", keycloakAdminService.generateTempPassword());

        assertEquals(email, keycloakAdminService.getUserEmail(userId));
    }

    @Test
    void ensureEventsEnabledSucceedsAgainstTheRealKeycloakInstance() throws Exception {
        keycloakAdminService.ensureEventsEnabled();
    }

    /**
     * Triggers a real bad-password direct-grant attempt against admin-cli (Keycloak's own
     * built-in per-realm client, always public with direct access grants enabled, the same
     * client kcadm.sh uses) for the seeded member1 account, then confirms the resulting
     * LOGIN_ERROR shows up through fetchLoginEvents. This is exactly the "someone tries to force
     * enter" signal KeycloakSecurityEventSyncService exists to capture, error is Keycloak's own
     * failure reason string (e.g. invalid_user_credentials, or user_temporarily_disabled once
     * bruteForceProtected locks the account). Deliberately not webchama-frontend, direct access
     * grants are disabled on that client, real logins only ever go through the standard/PKCE
     * flow, so simulating a bad password there would no longer reach Keycloak's login path at all.
     */
    @Test
    void fetchLoginEventsIncludesARealFailedLoginAttempt() throws Exception {
        keycloakAdminService.ensureEventsEnabled();
        triggerBadPasswordLoginAttempt();

        List<KeycloakAdminService.KeycloakLoginEvent> events =
            keycloakAdminService.fetchLoginEvents(LocalDate.now(ZoneOffset.UTC).minusDays(1));

        assertTrue(events.stream().anyMatch(e -> "LOGIN_ERROR".equals(e.type()) && e.error() != null),
            "expected at least one LOGIN_ERROR event with a non-null error after a bad-password attempt");
    }

    @Test
    void fetchAdminEventsIncludesARealUserCreationEvent() throws Exception {
        keycloakAdminService.ensureEventsEnabled();
        String email = "kc-admin-event-test-" + UUID.randomUUID() + "@example.com";
        keycloakAdminService.createUser(email, "Admin Event Test", keycloakAdminService.generateTempPassword());

        List<KeycloakAdminService.KeycloakAdminEvent> events =
            keycloakAdminService.fetchAdminEvents(LocalDate.now(ZoneOffset.UTC).minusDays(1));

        assertFalse(events.isEmpty(), "expected at least one admin event after provisioning a user");
        assertTrue(events.stream().anyMatch(e -> "CREATE".equals(e.operationType())),
            "expected at least one CREATE admin event after provisioning a user");
    }

    private void triggerBadPasswordLoginAttempt() throws Exception {
        HttpClient http = HttpClient.newHttpClient();
        String body = "grant_type=password"
            + "&client_id=" + URLEncoder.encode("admin-cli", StandardCharsets.UTF_8)
            + "&username=" + URLEncoder.encode("member1", StandardCharsets.UTF_8)
            + "&password=" + URLEncoder.encode("definitely-the-wrong-password", StandardCharsets.UTF_8);

        HttpRequest req = HttpRequest.newBuilder(
                URI.create("http://localhost:8180/realms/chama/protocol/openid-connect/token"))
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .build();

        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        // Expected to fail (401), that is the whole point, the failure itself is what we're testing for.
        assertEquals(401, resp.statusCode());
    }

    @Test
    void generatedTempPasswordSatisfiesComplexityRequirements() {
        String password = keycloakAdminService.generateTempPassword();
        assertEquals(10, password.length());
        assertTrue(password.chars().anyMatch(Character::isUpperCase));
        assertTrue(password.chars().anyMatch(Character::isLowerCase));
        assertTrue(password.chars().anyMatch(Character::isDigit));
        assertTrue(password.chars().anyMatch(c -> "!@#$%".indexOf(c) >= 0));
    }
}
