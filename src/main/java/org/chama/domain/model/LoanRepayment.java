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
import org.chama.domain.enums.LoanRepaymentStatus;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "loan_repayment")
public class LoanRepayment extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "loan_id", nullable = false)
    public Loan loan;

    @Column(name = "installment_number", nullable = false)
    public Integer installmentNumber;

    @Column(name = "scheduled_date", nullable = false)
    public LocalDate scheduledDate;

    @Column(name = "amount_due", nullable = false)
    public BigDecimal amountDue;

    @Column(name = "amount_paid", nullable = false)
    public BigDecimal amountPaid = BigDecimal.ZERO;

    /**
     * When the installment was fully settled, as opposed to when it fell due. Null while the
     * installment is still outstanding, and also on rows that predate the column, so a reader
     * cannot tell those two apart and must treat a null as "not known" rather than "not paid".
     */
    @Column(name = "paid_at")
    public Instant paidAt;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "loan_repayment_status")
    public LoanRepaymentStatus status = LoanRepaymentStatus.PENDING;
}
