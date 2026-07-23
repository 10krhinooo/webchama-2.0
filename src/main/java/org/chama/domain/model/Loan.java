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
import org.chama.domain.enums.InterestMethod;
import org.chama.domain.enums.LoanStatus;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "loan")
public class Loan extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    // Denormalized alongside member.chama_id, same tenant-scoping convention as Contribution/Payment.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chama_id", nullable = false)
    public Chama chama;

    // Eager: LoanDto always renders memberName, and that read routinely happens after the
    // owning transaction has closed, same reasoning as Contribution.member.
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "member_id", nullable = false)
    public Member member;

    @Column(nullable = false)
    public BigDecimal principal;

    @Column(name = "interest_rate", nullable = false)
    public BigDecimal interestRate;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "interest_method", nullable = false, columnDefinition = "interest_method")
    public InterestMethod interestMethod;

    @Column(name = "term_months", nullable = false)
    public Integer termMonths;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "loan_status")
    public LoanStatus status = LoanStatus.REQUESTED;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "approved_by_member_id")
    public Member approvedBy;

    @Column(name = "approved_at")
    public Instant approvedAt;

    @Column(name = "disbursed_at")
    public Instant disbursedAt;

    @CreationTimestamp
    @Column(name = "requested_at", nullable = false, updatable = false)
    public Instant requestedAt;

    // Approving a loan is a claim-once transition (MIGRATION_PLAN.md section 7); @Version
    // closes the race a plain REQUESTED-status check can't close alone (issue #30).
    @Version
    @Column(nullable = false)
    public long version;
}
