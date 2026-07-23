package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.model.Penalty;

import java.util.List;

@ApplicationScoped
public class PenaltyRepository implements PanacheRepository<Penalty> {

    public List<Penalty> findByChama(Long chamaId) {
        return list("chama.id = ?1 order by imposedAt desc", chamaId);
    }

    public List<Penalty> findByChamaAndMember(Long chamaId, Long memberId) {
        return list("chama.id = ?1 and member.id = ?2 order by imposedAt desc", chamaId, memberId);
    }
}
