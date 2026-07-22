package org.chama.service;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
    void generatedTempPasswordSatisfiesComplexityRequirements() {
        String password = keycloakAdminService.generateTempPassword();
        assertEquals(10, password.length());
        assertTrue(password.chars().anyMatch(Character::isUpperCase));
        assertTrue(password.chars().anyMatch(Character::isLowerCase));
        assertTrue(password.chars().anyMatch(Character::isDigit));
        assertTrue(password.chars().anyMatch(c -> "!@#$%".indexOf(c) >= 0));
    }
}
