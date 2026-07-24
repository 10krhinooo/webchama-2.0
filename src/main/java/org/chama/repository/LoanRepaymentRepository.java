package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.model.LoanRepayment;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@ApplicationScoped
public class LoanRepaymentRepository implements PanacheRepository<LoanRepayment> {

    public List<LoanRepayment> findByLoan(Long loanId) {
        return list("loan.id = ?1 order by installmentNumber", loanId);
    }

    /**
     * Repayments with money actually collected (amountPaid > 0) whose installment was scheduled
     * strictly before a statement period (issue #66's opening balance). The schema has no separate
     * paid-at column, scheduledDate is the closest available proxy for when the money moved.
     */
    public List<LoanRepayment> findByChamaAndScheduledBefore(Long chamaId, LocalDate before) {
        return list("loan.chama.id = ?1 and scheduledDate < ?2 and amountPaid > ?3", chamaId, before, BigDecimal.ZERO);
    }

    /** Repayments with money collected whose installment was scheduled within a statement period. */
    public List<LoanRepayment> findByChamaAndScheduledBetween(Long chamaId, LocalDate start, LocalDate end) {
        return list("loan.chama.id = ?1 and scheduledDate between ?2 and ?3 and amountPaid > ?4",
            chamaId, start, end, BigDecimal.ZERO);
    }

    public List<LoanRepayment> findByChamaAndMember(Long chamaId, Long memberId) {
        return list("loan.chama.id = ?1 and loan.member.id = ?2", chamaId, memberId);
    }
}
