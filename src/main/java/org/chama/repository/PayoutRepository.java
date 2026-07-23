package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.model.Payout;

import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class PayoutRepository implements PanacheRepository<Payout> {

    public List<Payout> findByChama(Long chamaId) {
        return list("chama.id = ?1 order by roundNumber", chamaId);
    }

    public List<Payout> findByChamaAndMember(Long chamaId, Long memberId) {
        return list("chama.id = ?1 and member.id = ?2 order by roundNumber", chamaId, memberId);
    }

    public Optional<Payout> findLatestForChama(Long chamaId) {
        return find("chama.id = ?1 order by roundNumber desc", chamaId).firstResultOptional();
    }
}
