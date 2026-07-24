package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.model.Contribution;

import java.time.LocalDate;
import java.util.List;

@ApplicationScoped
public class ContributionRepository implements PanacheRepository<Contribution> {

    public List<Contribution> findByChama(Long chamaId) {
        return list("chama.id", chamaId);
    }

    public List<Contribution> findByMember(Long memberId) {
        return list("member.id", memberId);
    }

    public List<Contribution> findByChamaAndMember(Long chamaId, Long memberId) {
        return list("chama.id = ?1 and member.id = ?2", chamaId, memberId);
    }

    /** Contributions whose billing period falls strictly before a statement period (issue #66's opening balance). */
    public List<Contribution> findByChamaAndPeriodBefore(Long chamaId, LocalDate before) {
        return list("chama.id = ?1 and period < ?2", chamaId, before);
    }

    /** Contributions whose billing period falls within a statement period, inclusive of both ends. */
    public List<Contribution> findByChamaAndPeriodBetween(Long chamaId, LocalDate start, LocalDate end) {
        return list("chama.id = ?1 and period between ?2 and ?3", chamaId, start, end);
    }
}
