package org.chama.domain.model;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
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
import org.chama.domain.crypto.DeterministicEncryptedStringConverter;
import org.chama.domain.enums.PaymentMethod;
import org.chama.domain.enums.PaymentPurpose;
import org.chama.domain.enums.PaymentStatus;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Polymorphic ledger row backing contribution/loan_repayment/penalty/welfare payments. Idempotent
 * on providerReference (M-Pesa CheckoutRequestID or Flutterwave tx_ref) for the online channels,
 * so a webhook retry looks up the existing row instead of creating a duplicate credit; the
 * loan_repayment/penalty channels are currently only reached through a treasurer's manual
 * settlement (LoanService/PenaltyService), which guards against double-recording via the target
 * row's own status transition instead.
 */
@Entity
@Table(name = "payment")
public class Payment extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chama_id", nullable = false)
    public Chama chama;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    public Member member;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contribution_id")
    public Contribution contribution;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "welfare_contribution_id")
    public WelfareContribution welfareContribution;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "loan_repayment_id")
    public LoanRepayment loanRepayment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "penalty_id")
    public Penalty penalty;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "payment_purpose")
    public PaymentPurpose purpose = PaymentPurpose.CONTRIBUTION;

    @Column(nullable = false)
    public BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "payment_method")
    public PaymentMethod method;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "payment_status")
    public PaymentStatus status = PaymentStatus.PENDING;

    @Column(name = "provider_reference", length = 200)
    public String providerReference;

    // Encrypted at rest (AUDIT_PLAN.md P2-14). No uniqueness/exact-match lookup needed on this
    // column, but the same deterministic converter is reused for consistency.
    @Convert(converter = DeterministicEncryptedStringConverter.class)
    @Column(name = "mpesa_receipt_number", length = 100)
    public String mpesaReceiptNumber;

    @Column(name = "paid_at")
    public Instant paidAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    public Instant createdAt;

    // Two near-simultaneous webhook deliveries for the same payment can both read status =
    // PENDING before either commits; without this, both would credit the balance (issue P0-5).
    @Version
    @Column(nullable = false)
    public long version;
}
