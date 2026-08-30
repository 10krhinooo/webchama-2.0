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
import org.chama.domain.enums.NotificationEventFamily;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * How one user wants to hear about one family of events.
 *
 * A missing row means both channels are on. Storing only the opinions a user has actually
 * expressed keeps a new event family working without a backfill, and means an absent row is never
 * mistaken for opting out.
 */
@Entity
@Table(name = "notification_preference")
public class NotificationPreference extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "keycloak_user_id", nullable = false)
    public String keycloakUserId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "event_family", nullable = false, columnDefinition = "notification_event_family")
    public NotificationEventFamily eventFamily;

    @Column(name = "in_app_enabled", nullable = false)
    public boolean inAppEnabled = true;

    @Column(name = "email_enabled", nullable = false)
    public boolean emailEnabled = true;
}
