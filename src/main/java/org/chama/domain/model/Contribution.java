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
import org.chama.domain.enums.ContributionStatus;
import org.chama.domain.enums.PaymentMethod;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "contribution")
public class Contribution extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    // Denormalized alongside member.chama_id so tenant-scoping queries can
    // filter on chama_id directly without an extra join.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chama_id", nullable = false)
    public Chama chama;

    // Eager, unlike chama above: ContributionDto always renders memberName
    // alongside the contribution, and that read routinely happens after the
    // owning transaction has already closed (a service method returns the
    // entity, then the REST layer builds the DTO), so a lazy association
    // here would throw LazyInitializationException on that second read.
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "member_id", nullable = false)
    public Member member;

    @Column(nullable = false)
    public LocalDate period;

    @Column(name = "amount_due", nullable = false)
    public BigDecimal amountDue;

    @Column(name = "amount_paid", nullable = false)
    public BigDecimal amountPaid = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "payment_method", columnDefinition = "payment_method")
    public PaymentMethod paymentMethod;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "contribution_status")
    public ContributionStatus status = ContributionStatus.PENDING;

    @Column(name = "paid_at")
    public Instant paidAt;
}
