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
import org.chama.domain.enums.ApprovalStatus;
import org.chama.domain.enums.ApprovalTargetType;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * A dual sign-off request gating a loan disbursement or payout above a chama's configurable
 * approval threshold (MIGRATION_PLAN.md section 9). The "maker" step creates a PENDING row via
 * {@code ApprovalService.request}, then two distinct TREASURER/CHAIRPERSON members must each call
 * the "checker" step ({@code ApprovalService.approve}) before {@code status} flips to APPROVED,
 * the only state {@code ApprovalService.requireApproved} will accept.
 */
@Entity
@Table(name = "approval")
public class Approval extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chama_id", nullable = false)
    public Chama chama;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "target_type", nullable = false, columnDefinition = "approval_target_type")
    public ApprovalTargetType targetType;

    @Column(name = "target_id", nullable = false)
    public Long targetId;

    // The beneficiary of the disbursement/payout being gated, not the person requesting approval.
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "member_id", nullable = false)
    public Member member;

    @Column(nullable = false)
    public BigDecimal amount;

    public String reason;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "approval_status")
    public ApprovalStatus status = ApprovalStatus.PENDING;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "requested_by_id", nullable = false)
    public Member requestedBy;

    @CreationTimestamp
    @Column(name = "requested_at", nullable = false, updatable = false)
    public Instant requestedAt;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "first_approver_id")
    public Member firstApprover;

    @Column(name = "first_approved_at")
    public Instant firstApprovedAt;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "second_approver_id")
    public Member secondApprover;

    @Column(name = "second_approved_at")
    public Instant secondApprovedAt;

    // Signing off is a claim-once transition, same rationale as Loan/LoanDisbursement/Payout's
    // @Version: a plain status check can't close the race between two signatories submitting at
    // once.
    @Version
    @Column(nullable = false)
    public long version;
}
