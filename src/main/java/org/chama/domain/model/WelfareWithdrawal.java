package org.chama.domain.model;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * An emergency payout disbursed from the welfare fund, decided by the chairperson/treasurer.
 * Deliberately simple (amount + reason + who approved it), no scheduling or multi-step approval
 * workflow, matching the scope of issue #65.
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

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "disbursed_by_member_id", nullable = false)
    public Member disbursedBy;

    @CreationTimestamp
    @Column(name = "disbursed_at", nullable = false, updatable = false)
    public Instant disbursedAt;
}
