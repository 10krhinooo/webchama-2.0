package org.chama.domain.model;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.chama.domain.enums.KeycloakEventSource;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

/**
 * A row ingested from Keycloak's own login or admin event log (KeycloakSecurityEventSyncService),
 * platform-level like system_error/activity_log, not chama-scoped. Polymorphic across the two
 * Keycloak event kinds, same approach as the payment table backing multiple purposes: source
 * distinguishes which columns are populated (sessionId/details for LOGIN, resourceType/
 * resourcePath for ADMIN). Append-only, a row is never updated after ingestion, dedupeKey is what
 * makes re-polling the same window idempotent.
 */
@Entity
@Table(name = "keycloak_security_event")
public class KeycloakSecurityEvent extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "keycloak_event_source")
    public KeycloakEventSource source;

    @Column(name = "event_time", nullable = false)
    public Instant eventTime;

    // Keycloak's own event type string for LOGIN events (LOGIN, LOGIN_ERROR, LOGOUT, ...) or
    // operationType for ADMIN events (CREATE, UPDATE, DELETE, ACTION). Deliberately a plain
    // string, not a native Postgres enum, Keycloak's own vocabulary isn't ours to control.
    @Column(nullable = false)
    public String type;

    @Column(name = "realm_id")
    public String realmId;

    @Column(name = "keycloak_user_id")
    public String keycloakUserId;

    @Column(name = "ip_address")
    public String ipAddress;

    @Column(name = "client_id")
    public String clientId;

    @Column(name = "session_id")
    public String sessionId;

    // The brute-force / bad-credential signal, e.g. "user_temporarily_disabled" is Keycloak's own
    // error code when bruteForceProtected locks an account after repeated failed attempts.
    @Column
    public String error;

    @Column(name = "resource_type")
    public String resourceType;

    @Column(name = "resource_path")
    public String resourcePath;

    // JSON-serialized details map (LOGIN events only), never the admin event's "representation"
    // payload, that can carry arbitrary PII and is deliberately not captured (adminEventsDetailsEnabled
    // stays false, see KeycloakAdminService.ensureEventsEnabled).
    @Column
    public String details;

    @Column(name = "dedupe_key", nullable = false, unique = true)
    public String dedupeKey;

    @CreationTimestamp
    @Column(name = "ingested_at", nullable = false, updatable = false)
    public Instant ingestedAt;
}
