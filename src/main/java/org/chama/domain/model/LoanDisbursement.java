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
import org.chama.domain.enums.LoanDisbursementStatus;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Backs the M-Pesa B2C loan payout flow (MIGRATION_PLAN.md section 6). A row is created PENDING
 * as soon as Daraja's B2C paymentrequest call is acknowledged, since that 200 response only means
 * the request was accepted, not that money has moved. It is only ever moved to COMPLETED/FAILED
 * by the ResultURL/QueueTimeOutURL callback (B2cCallbackResource) or the reconciliation sweep
 * (LoanDisbursementService.reconcileStalePending), never by the initiating call itself.
 */
@Entity
@Table(name = "loan_disbursement")
public class LoanDisbursement extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "loan_id", nullable = false)
    public Loan loan;

    // Safaricom-assigned identifiers from the synchronous paymentrequest acknowledgement, used to
    // match an inbound callback (or a reconciliation query result) back to this row.
    @Column(name = "conversation_id", nullable = false, unique = true)
    public String conversationId;

    @Column(name = "originator_conversation_id", nullable = false)
    public String originatorConversationId;

    @Column(name = "target_phone", nullable = false)
    public String targetPhone;

    @Column(nullable = false)
    public BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "loan_disbursement_status")
    public LoanDisbursementStatus status = LoanDisbursementStatus.PENDING;

    @Column(name = "result_code")
    public String resultCode;

    @Column(name = "result_description")
    public String resultDescription;

    @Column(name = "transaction_id")
    public String transactionId;

    @Column(name = "disbursed_at")
    public Instant disbursedAt;

    @CreationTimestamp
    @Column(name = "requested_at", nullable = false, updatable = false)
    public Instant requestedAt;

    // A replayed or duplicate callback must not double-apply a completed/failed transition
    // (issue #34); combined with the status-not-PENDING guard in the service, not just this alone.
    @Version
    @Column(nullable = false)
    public long version;
}
