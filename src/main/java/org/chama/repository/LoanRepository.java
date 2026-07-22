package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.model.Loan;

import java.util.List;

@ApplicationScoped
public class LoanRepository implements PanacheRepository<Loan> {

    public List<Loan> findByChama(Long chamaId) {
        return list("chama.id", chamaId);
    }

    public List<Loan> findByChamaAndMember(Long chamaId, Long memberId) {
        return list("chama.id = ?1 and member.id = ?2", chamaId, memberId);
    }
}
