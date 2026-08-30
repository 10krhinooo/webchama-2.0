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
import org.chama.domain.enums.ReminderKind;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.time.LocalDate;

/**
 * A reminder that was sent, and the lock that stops it being sent twice.
 *
 * <p>Rows are claimed through {@code ReminderDispatchRepository.claim}, never persisted through
 * this entity: the claim has to be an atomic insert-or-skip against the unique constraint, which
 * a persist cannot express.
 */
@Entity
@Table(name = "reminder_dispatch")
public class ReminderDispatch extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contribution_id", nullable = false)
    public Contribution contribution;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "reminder_kind", nullable = false, columnDefinition = "reminder_kind")
    public ReminderKind reminderKind;

    /** The Nairobi date this reminder was for, which is what makes repeat nudges distinct. */
    @Column(name = "scheduled_for", nullable = false)
    public LocalDate scheduledFor;

    @Column(name = "sent_at", nullable = false)
    public Instant sentAt;
}
