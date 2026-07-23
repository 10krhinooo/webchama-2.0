package org.chama.service;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.chama.domain.enums.KeycloakEventSource;
import org.chama.domain.model.KeycloakSecurityEvent;
import org.chama.repository.KeycloakSecurityEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;

@QuarkusTest
class KeycloakSecurityEventSyncServiceTest {

    @Inject
    KeycloakSecurityEventSyncService syncService;

    @Inject
    KeycloakSecurityEventRepository repository;

    @InjectMock
    KeycloakAdminService keycloakAdminService;

    @BeforeEach
    void clean() {
        QuarkusTransaction.requiringNew().run(repository::deleteAll);
    }

    @Test
    void syncPersistsLoginAndAdminEventsFromKeycloak() throws Exception {
        Mockito.when(keycloakAdminService.fetchLoginEvents(any(LocalDate.class))).thenReturn(List.of(
            new KeycloakAdminService.KeycloakLoginEvent(System.currentTimeMillis(), "LOGIN_ERROR", "chama",
                "webchama-frontend", "user-1", "session-1", "10.0.0.5", "invalid_user_credentials", Map.of())));
        Mockito.when(keycloakAdminService.fetchAdminEvents(any(LocalDate.class))).thenReturn(List.of(
            new KeycloakAdminService.KeycloakAdminEvent(System.currentTimeMillis(), "chama", "CREATE", "USER",
                "users/abc", null, "admin-user-1", "10.0.0.6", "admin-cli")));

        syncService.sync();

        List<KeycloakSecurityEvent> rows = QuarkusTransaction.requiringNew().call(() -> repository.listAll());
        assertEquals(2, rows.size());
        assertTrue(rows.stream().anyMatch(r -> r.source == KeycloakEventSource.LOGIN
            && "invalid_user_credentials".equals(r.error)));
        assertTrue(rows.stream().anyMatch(r -> r.source == KeycloakEventSource.ADMIN
            && "USER".equals(r.resourceType) && "CREATE".equals(r.type)));
    }

    @Test
    void syncIsIdempotentWhenTheSameEventIsPolledTwice() throws Exception {
        long time = System.currentTimeMillis();
        Mockito.when(keycloakAdminService.fetchLoginEvents(any(LocalDate.class))).thenReturn(List.of(
            new KeycloakAdminService.KeycloakLoginEvent(time, "LOGIN_ERROR", "chama",
                "webchama-frontend", "user-1", "session-1", "10.0.0.5", "invalid_user_credentials", Map.of())));
        Mockito.when(keycloakAdminService.fetchAdminEvents(any(LocalDate.class))).thenReturn(List.of());

        syncService.sync();
        syncService.sync();

        List<KeycloakSecurityEvent> rows = QuarkusTransaction.requiringNew().call(() -> repository.listAll());
        assertEquals(1, rows.size());
    }

    @Test
    void syncSkipsEventsOlderThanTheWatermark() throws Exception {
        QuarkusTransaction.requiringNew().run(() -> {
            KeycloakSecurityEvent existing = new KeycloakSecurityEvent();
            existing.source = KeycloakEventSource.LOGIN;
            existing.eventTime = java.time.Instant.now();
            existing.type = "LOGIN";
            existing.dedupeKey = "seed-row";
            repository.persist(existing);
        });

        long staleTime = java.time.Instant.now().minus(java.time.Duration.ofDays(2)).toEpochMilli();
        Mockito.when(keycloakAdminService.fetchLoginEvents(any(LocalDate.class))).thenReturn(List.of(
            new KeycloakAdminService.KeycloakLoginEvent(staleTime, "LOGIN", "chama",
                "webchama-frontend", "user-2", "session-2", "10.0.0.7", null, Map.of())));
        Mockito.when(keycloakAdminService.fetchAdminEvents(any(LocalDate.class))).thenReturn(List.of());

        syncService.sync();

        List<KeycloakSecurityEvent> rows = QuarkusTransaction.requiringNew().call(() -> repository.listAll());
        assertEquals(1, rows.size());
        assertEquals("seed-row", rows.get(0).dedupeKey);
    }
}
