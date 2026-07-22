package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.model.Contribution;

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
}
