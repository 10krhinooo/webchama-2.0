package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.model.WelfareContribution;

import java.util.List;

@ApplicationScoped
public class WelfareContributionRepository implements PanacheRepository<WelfareContribution> {

    public List<WelfareContribution> findByChama(Long chamaId) {
        return list("chama.id", chamaId);
    }

    public List<WelfareContribution> findByChamaAndMember(Long chamaId, Long memberId) {
        return list("chama.id = ?1 and member.id = ?2", chamaId, memberId);
    }
}
