package org.chama.domain.model;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * When and how often a chama nudges its members about contributions.
 *
 * <p>Created lazily on first access, the way {@link WelfareFund} is, so a chama that never opens
 * the panel never gets a row. Disabled until a chairperson turns it on: switching this on for
 * every chama at once would send mail nobody asked for.
 */
@Entity
@Table(name = "chama_reminder_settings")
public class ChamaReminderSettings extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chama_id", nullable = false, unique = true)
    public Chama chama;

    @Column(nullable = false)
    public boolean enabled = false;

    @Column(name = "days_before_due", nullable = false)
    public int daysBeforeDue = 3;

    @Column(name = "overdue_every_days", nullable = false)
    public int overdueEveryDays = 7;

    /** Hour of the Nairobi day to send at, 0 to 23. */
    @Column(name = "send_hour", nullable = false)
    public int sendHour = 8;

    @Version
    @Column(nullable = false)
    public long version;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    public Instant createdAt;
}
