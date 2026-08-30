package org.chama.domain.model;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.chama.domain.enums.NotificationEventFamily;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

/**
 * One entry in a user's notification inbox.
 *
 * Addressed to a Keycloak user rather than to a member row, because a notification belongs to a
 * person rather than to one of their memberships. The chama is context for the message and the
 * target of its link, and is absent for notifications that predate membership.
 */
@Entity
@Table(name = "notification")
public class Notification extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "keycloak_user_id", nullable = false)
    public String keycloakUserId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chama_id")
    public Chama chama;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "event_family", nullable = false, columnDefinition = "notification_event_family")
    public NotificationEventFamily eventFamily;

    @Column(nullable = false)
    public String title;

    @Column(nullable = false)
    public String body;

    /** Client-side route to open, for example {@code /chamas/4/loans}. Null when there is nowhere to go. */
    @Column
    public String link;

    /** Null while unread. Set once, never cleared: marking something unread again is not a feature. */
    @Column(name = "read_at")
    public Instant readAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    public Instant createdAt;
}
