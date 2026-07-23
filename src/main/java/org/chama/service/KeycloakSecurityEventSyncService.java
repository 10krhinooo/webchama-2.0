package org.chama.service;

import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.chama.domain.enums.KeycloakEventSource;
import org.chama.domain.model.KeycloakSecurityEvent;
import org.chama.repository.KeycloakSecurityEventRepository;
import org.jboss.logging.Logger;
import io.quarkus.scheduler.Scheduled;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

/**
 * Ingests Keycloak's own login and admin event log into keycloak_security_event, the "someone
 * tried to force enter" visibility this exists for is the error field on a LOGIN_ERROR row,
 * Keycloak sets error="user_temporarily_disabled" once bruteForceProtected locks an account after
 * repeated failed attempts. Polls rather than a push-based Keycloak Event Listener SPI, no custom
 * Keycloak provider to build/maintain, same operational shape as the B2C reconciliation sweep.
 */
@ApplicationScoped
public class KeycloakSecurityEventSyncService {

    private static final Logger LOG = Logger.getLogger(KeycloakSecurityEventSyncService.class);

    /** How far back to look on the very first sync, before any row exists to derive a watermark from. */
    private static final Duration INITIAL_BACKFILL = Duration.ofDays(1);

    /** Re-queries slightly before the watermark on every poll, dedupeKey absorbs the overlap. */
    private static final Duration OVERLAP_BUFFER = Duration.ofMinutes(2);

    @Inject
    KeycloakAdminService keycloakAdminService;

    @Inject
    KeycloakSecurityEventRepository repository;

    void onStart(@Observes StartupEvent event) {
        try {
            keycloakAdminService.ensureEventsEnabled();
        } catch (Exception e) {
            LOG.error("Failed to enable Keycloak realm events on startup, "
                + "security event ingestion will find nothing to sync until this is fixed", e);
        }
    }

    @Transactional
    @Scheduled(every = "1m", identity = "keycloak-security-event-sync")
    void sync() {
        Instant watermark = repository.findMaxEventTime().orElse(Instant.now().minus(INITIAL_BACKFILL));
        Instant sinceMillis = watermark.minus(OVERLAP_BUFFER);
        LocalDate dateFrom = LocalDate.ofInstant(sinceMillis, ZoneOffset.UTC);

        syncLoginEvents(dateFrom, sinceMillis);
        syncAdminEvents(dateFrom, sinceMillis);
    }

    private void syncLoginEvents(LocalDate dateFrom, Instant since) {
        List<KeycloakAdminService.KeycloakLoginEvent> events;
        try {
            events = keycloakAdminService.fetchLoginEvents(dateFrom);
        } catch (Exception e) {
            LOG.error("Failed to fetch Keycloak login events", e);
            return;
        }

        for (var e : events) {
            Instant eventTime = Instant.ofEpochMilli(e.time());
            if (eventTime.isBefore(since)) continue;

            String dedupeKey = String.join("|", "LOGIN", String.valueOf(e.time()), nz(e.type()),
                nz(e.userId()), nz(e.sessionId()), nz(e.ipAddress()), nz(e.error()));
            if (repository.existsByDedupeKey(dedupeKey)) continue;

            KeycloakSecurityEvent row = new KeycloakSecurityEvent();
            row.source = KeycloakEventSource.LOGIN;
            row.eventTime = eventTime;
            row.type = e.type();
            row.realmId = e.realmId();
            row.keycloakUserId = e.userId();
            row.ipAddress = e.ipAddress();
            row.clientId = e.clientId();
            row.sessionId = e.sessionId();
            row.error = e.error();
            row.details = e.details().isEmpty() ? null : e.details().toString();
            row.dedupeKey = dedupeKey;
            repository.persist(row);
        }
    }

    private void syncAdminEvents(LocalDate dateFrom, Instant since) {
        List<KeycloakAdminService.KeycloakAdminEvent> events;
        try {
            events = keycloakAdminService.fetchAdminEvents(dateFrom);
        } catch (Exception e) {
            LOG.error("Failed to fetch Keycloak admin events", e);
            return;
        }

        for (var e : events) {
            Instant eventTime = Instant.ofEpochMilli(e.time());
            if (eventTime.isBefore(since)) continue;

            String dedupeKey = String.join("|", "ADMIN", String.valueOf(e.time()), nz(e.operationType()),
                nz(e.resourceType()), nz(e.resourcePath()), nz(e.userId()));
            if (repository.existsByDedupeKey(dedupeKey)) continue;

            KeycloakSecurityEvent row = new KeycloakSecurityEvent();
            row.source = KeycloakEventSource.ADMIN;
            row.eventTime = eventTime;
            row.type = e.operationType();
            row.realmId = e.realmId();
            row.keycloakUserId = e.userId();
            row.ipAddress = e.ipAddress();
            row.clientId = e.clientId();
            row.error = e.error();
            row.resourceType = e.resourceType();
            row.resourcePath = e.resourcePath();
            row.dedupeKey = dedupeKey;
            repository.persist(row);
        }
    }

    private static String nz(String value) {
        return value != null ? value : "";
    }
}
