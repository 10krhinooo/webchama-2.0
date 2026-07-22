package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.model.LoanRepayment;

import java.util.List;

@ApplicationScoped
public class LoanRepaymentRepository implements PanacheRepository<LoanRepayment> {

    public List<LoanRepayment> findByLoan(Long loanId) {
        return list("loan.id = ?1 order by installmentNumber", loanId);
    }
}
