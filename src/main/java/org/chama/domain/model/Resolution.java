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
import jakarta.persistence.Version;
import org.chama.domain.enums.ResolutionStatus;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

/**
 * Digitizes a meeting's show-of-hands decision (loan approval, member
 * expulsion, contribution changes, etc.), always tied to the meeting it was
 * raised at (issue #64). Closing a resolution is a claim-once transition
 * from OPEN to a final tallied state (PASSED/REJECTED), same reasoning as
 * Loan/Payout/Penalty, hence @Version.
 */
@Entity
@Table(name = "resolution")
public class Resolution extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    // Denormalized alongside meeting.chama_id, same tenant-scoping convention as Loan/Payout/Penalty.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chama_id", nullable = false)
    public Chama chama;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "meeting_id", nullable = false)
    public Meeting meeting;

    @Column(nullable = false)
    public String title;

    public String description;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "resolution_status")
    public ResolutionStatus status = ResolutionStatus.OPEN;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "opened_by_member_id", nullable = false)
    public Member openedBy;

    @CreationTimestamp
    @Column(name = "opened_at", nullable = false, updatable = false)
    public Instant openedAt;

    @Column(name = "closed_at")
    public Instant closedAt;

    @Version
    @Column(nullable = false)
    public long version;
}
