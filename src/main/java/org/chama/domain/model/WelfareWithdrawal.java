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
import org.chama.domain.enums.WelfareWithdrawalStatus;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * An emergency payout from the welfare fund.
 *
 * <p>Two members are recorded, not one. The requester opens the withdrawal and, above the chama's
 * approval threshold, a different member releases it after dual sign-off has cleared; below the
 * threshold both are the same person and the two steps collapse into one. Keeping them apart is
 * what lets the maker-checker rule mean anything here.
 */
@Entity
@Table(name = "welfare_withdrawal")
public class WelfareWithdrawal extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chama_id", nullable = false)
    public Chama chama;

    @Column(nullable = false)
    public BigDecimal amount;

    @Column(nullable = false)
    public String reason;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "welfare_withdrawal_status")
    public WelfareWithdrawalStatus status = WelfareWithdrawalStatus.PENDING_APPROVAL;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "requested_by_member_id", nullable = false)
    public Member requestedBy;

    @CreationTimestamp
    @Column(name = "requested_at", nullable = false, updatable = false)
    public Instant requestedAt;

    /** Null until the money actually leaves the fund, which for a large withdrawal is a later step. */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "disbursed_by_member_id")
    public Member disbursedBy;

    @Column(name = "disbursed_at")
    public Instant disbursedAt;
}
