package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.enums.PayoutStatus;
import org.chama.domain.model.Payout;

import java.time.Instant;
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

    /** Disbursed payouts strictly before a statement period (issue #66's opening balance). */
    public List<Payout> findDisbursedByChamaBefore(Long chamaId, Instant before) {
        return list("chama.id = ?1 and status = ?2 and disbursedAt < ?3", chamaId, PayoutStatus.DISBURSED, before);
    }

    /** Disbursed payouts within a statement period, start inclusive, end exclusive. */
    public List<Payout> findDisbursedByChamaBetween(Long chamaId, Instant startInclusive, Instant endExclusive) {
        return list("chama.id = ?1 and status = ?2 and disbursedAt >= ?3 and disbursedAt < ?4",
            chamaId, PayoutStatus.DISBURSED, startInclusive, endExclusive);
    }
}
