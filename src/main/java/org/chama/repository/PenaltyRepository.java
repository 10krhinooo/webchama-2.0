package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.enums.PenaltyStatus;
import org.chama.domain.model.Penalty;

import java.time.Instant;
import java.util.List;

@ApplicationScoped
public class PenaltyRepository implements PanacheRepository<Penalty> {

    public List<Penalty> findByChama(Long chamaId) {
        return list("chama.id = ?1 order by imposedAt desc", chamaId);
    }

    public List<Penalty> findByChamaAndMember(Long chamaId, Long memberId) {
        return list("chama.id = ?1 and member.id = ?2 order by imposedAt desc", chamaId, memberId);
    }

    /**
     * Penalties confirmed (the point they become a confirmed, collectible amount, not merely
     * imposed) strictly before a statement period (issue #66's opening balance). Includes PAID as
     * well as APPROVED, a since-settled penalty was still confirmed/imposed in this period, it
     * just no longer needs collecting; excluding it would make a statement understate what a
     * member owed at the time.
     */
    public List<Penalty> findApprovedByChamaBefore(Long chamaId, Instant before) {
        return list("chama.id = ?1 and status in (?2, ?3) and decidedAt < ?4",
            chamaId, PenaltyStatus.APPROVED, PenaltyStatus.PAID, before);
    }

    /** Penalties confirmed (APPROVED or since-settled PAID) within a statement period, start inclusive, end exclusive. */
    public List<Penalty> findApprovedByChamaBetween(Long chamaId, Instant startInclusive, Instant endExclusive) {
        return list("chama.id = ?1 and status in (?2, ?3) and decidedAt >= ?4 and decidedAt < ?5",
            chamaId, PenaltyStatus.APPROVED, PenaltyStatus.PAID, startInclusive, endExclusive);
    }
}
