package org.chama.rest;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import jakarta.inject.Inject;
import org.chama.domain.enums.KeycloakEventSource;
import org.chama.domain.model.KeycloakSecurityEvent;
import org.chama.repository.KeycloakSecurityEventRepository;
import org.chama.service.KeycloakAdminService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.Instant;
import java.util.List;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;

@QuarkusTest
class SecurityEventResourceTest {

    @Inject
    KeycloakSecurityEventRepository repository;

    // The real KeycloakSecurityEventSyncService's @Scheduled job runs in every @QuarkusTest
    // unless this is mocked, and would otherwise poll the live Keycloak instance and ingest real
    // events (including its own ensureEventsEnabled() admin action) into this test's table,
    // racing against the seeded fixture rows below.
    @InjectMock
    KeycloakAdminService keycloakAdminService;

    @BeforeEach
    void seed() throws Exception {
        Mockito.when(keycloakAdminService.fetchLoginEvents(any())).thenReturn(List.of());
        Mockito.when(keycloakAdminService.fetchAdminEvents(any())).thenReturn(List.of());

        QuarkusTransaction.requiringNew().run(() -> {
            repository.deleteAll();

            KeycloakSecurityEvent loginError = new KeycloakSecurityEvent();
            loginError.source = KeycloakEventSource.LOGIN;
            loginError.eventTime = Instant.now();
            loginError.type = "LOGIN_ERROR";
            loginError.keycloakUserId = "user-1";
            loginError.error = "user_temporarily_disabled";
            loginError.dedupeKey = "sec-evt-test-1";
            repository.persist(loginError);

            KeycloakSecurityEvent login = new KeycloakSecurityEvent();
            login.source = KeycloakEventSource.LOGIN;
            login.eventTime = Instant.now();
            login.type = "LOGIN";
            login.keycloakUserId = "user-2";
            login.dedupeKey = "sec-evt-test-2";
            repository.persist(login);
        });
    }

    @Test
    @TestSecurity(user = "super-admin-1", roles = "SUPER_ADMIN")
    void superAdminCanListAllSecurityEvents() {
        given()
            .when().get("/api/admin/security-events")
            .then().statusCode(200)
            .body("$", hasSize(2));
    }

    @Test
    @TestSecurity(user = "super-admin-1", roles = "SUPER_ADMIN")
    void superAdminCanFilterByError() {
        given()
            .queryParam("error", "user_temporarily_disabled")
            .when().get("/api/admin/security-events")
            .then().statusCode(200)
            .body("$", hasSize(1))
            .body("[0].keycloakUserId", org.hamcrest.Matchers.equalTo("user-1"));
    }

    @Test
    @TestSecurity(user = "plain-member-1", roles = "MEMBER")
    void nonSuperAdminIsForbidden() {
        given()
            .when().get("/api/admin/security-events")
            .then().statusCode(403);
    }
}
