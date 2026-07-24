package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.model.Loan;

import java.time.Instant;
import java.util.List;

@ApplicationScoped
public class LoanRepository implements PanacheRepository<Loan> {

    public List<Loan> findByChama(Long chamaId) {
        return list("chama.id", chamaId);
    }

    public List<Loan> findByChamaAndMember(Long chamaId, Long memberId) {
        return list("chama.id = ?1 and member.id = ?2", chamaId, memberId);
    }

    /**
     * Loans disbursed strictly before a statement period (issue #66's opening balance). Filters on
     * disbursedAt rather than the current status, a loan that has since moved on to REPAYING/CLOSED/
     * DEFAULTED still keeps its original disbursedAt timestamp.
     */
    public List<Loan> findDisbursedByChamaBefore(Long chamaId, Instant before) {
        return list("chama.id = ?1 and disbursedAt is not null and disbursedAt < ?2", chamaId, before);
    }

    /** Loans disbursed within a statement period, start inclusive, end exclusive. */
    public List<Loan> findDisbursedByChamaBetween(Long chamaId, Instant startInclusive, Instant endExclusive) {
        return list("chama.id = ?1 and disbursedAt is not null and disbursedAt >= ?2 and disbursedAt < ?3",
            chamaId, startInclusive, endExclusive);
    }
}
