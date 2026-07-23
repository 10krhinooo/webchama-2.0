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
import org.chama.domain.enums.PayoutScheduleEntryStatus;
import org.chama.domain.enums.RotationOrderType;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "payout_schedule")
public class PayoutSchedule extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    // Denormalized alongside member.chama_id, same tenant-scoping convention as Loan/Contribution.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chama_id", nullable = false)
    public Chama chama;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "member_id", nullable = false)
    public Member member;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "rotation_order_type", nullable = false, columnDefinition = "rotation_order_type")
    public RotationOrderType rotationOrderType;

    @Column(name = "sequence_position", nullable = false)
    public Integer sequencePosition;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "payout_schedule_entry_status")
    public PayoutScheduleEntryStatus status = PayoutScheduleEntryStatus.ACTIVE;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    public Instant createdAt;
}
