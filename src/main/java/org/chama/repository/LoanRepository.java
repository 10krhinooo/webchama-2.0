package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.enums.LoanStatus;
import org.chama.domain.model.Loan;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@ApplicationScoped
public class LoanRepository implements PanacheRepository<Loan> {

    public List<Loan> findByChama(Long chamaId) {
        return list("chama.id", chamaId);
    }

    /** Platform-wide count of loans currently disbursed and not yet fully repaid, for the SUPER_ADMIN overview. */
    public long countOutstanding() {
        return count("status in (?1, ?2)", LoanStatus.DISBURSED, LoanStatus.REPAYING);
    }

    /** Platform-wide sum of principal for loans currently disbursed and not yet fully repaid. */
    public BigDecimal sumOutstandingPrincipal() {
        return getEntityManager()
            .createQuery(
                "select coalesce(sum(l.principal), 0) from Loan l where l.status in (:disbursed, :repaying)",
                BigDecimal.class)
            .setParameter("disbursed", LoanStatus.DISBURSED)
            .setParameter("repaying", LoanStatus.REPAYING)
            .getSingleResult();
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
