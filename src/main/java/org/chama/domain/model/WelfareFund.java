package org.chama.domain.model;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * The chama's separate emergency pot (issue #65), one row per chama, lazily created on first
 * access rather than at chama-creation time. Deliberately its own entity rather than a column on
 * Chama or a derived sum over welfare_contribution, so the balance can be updated atomically
 * (with optimistic locking, see version) as contributions land and withdrawals go out, without
 * re-summing the whole ledger on every read.
 */
@Entity
@Table(name = "welfare_fund")
public class WelfareFund extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @OneToOne
    @JoinColumn(name = "chama_id", nullable = false, unique = true)
    public Chama chama;

    @Column(nullable = false)
    public BigDecimal balance = BigDecimal.ZERO.setScale(2);

    @Version
    @Column(nullable = false)
    public long version;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    public Instant createdAt;
}
