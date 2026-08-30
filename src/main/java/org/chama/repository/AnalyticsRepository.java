package org.chama.repository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Native aggregate queries behind the chama analytics, following PlatformStatsService's rule that
 * a dashboard number is computed in the database rather than by materialising entities. A chama
 * with three years of history has thousands of contributions and repayments, and none of them need
 * to reach Java for a total.
 *
 * <p>Every query is scoped by chama_id in its WHERE clause. There is no query here that a caller
 * can widen, which is what keeps tenant isolation intact in a class that bypasses Panache.
 */
@ApplicationScoped
public class AnalyticsRepository {

    @PersistenceContext
    EntityManager entityManager;

    /** Money billed and money collected per calendar month, for months that had any billing. */
    public List<Object[]> contributionTrend(Long chamaId, LocalDate from, LocalDate toExclusive) {
        return entityManager.createNativeQuery("""
                SELECT to_char(date_trunc('month', period), 'YYYY-MM') AS month,
                       COALESCE(SUM(amount_due), 0)  AS expected,
                       COALESCE(SUM(amount_paid), 0) AS collected
                  FROM contribution
                 WHERE chama_id = ?1 AND period >= ?2 AND period < ?3
                 GROUP BY 1
                 ORDER BY 1
                """)
            .setParameter(1, chamaId)
            .setParameter(2, from)
            .setParameter(3, toExclusive)
            .getResultList();
    }

    /**
     * Unpaid contribution balances aged into buckets.
     *
     * <p>Members are counted distinctly per bucket, so one member three months behind appears once
     * in each bucket they have a debt in rather than three times in the total.
     */
    public List<Object[]> arrearsBuckets(Long chamaId, LocalDate today) {
        return entityManager.createNativeQuery("""
                SELECT CASE WHEN (?2 - period) <= 30 THEN '1-30'
                            WHEN (?2 - period) <= 60 THEN '31-60'
                            WHEN (?2 - period) <= 90 THEN '61-90'
                            ELSE '90+' END              AS bucket,
                       COUNT(DISTINCT member_id)        AS members,
                       COALESCE(SUM(amount_due - amount_paid), 0) AS amount
                  FROM contribution
                 WHERE chama_id = ?1 AND period < ?2 AND status <> 'PAID'
                 GROUP BY 1
                """)
            .setParameter(1, chamaId)
            .setParameter(2, today)
            .getResultList();
    }

    /** Loans grouped by status, with principal and what is still owed against each group. */
    public List<Object[]> loanPortfolio(Long chamaId) {
        return entityManager.createNativeQuery("""
                SELECT l.status::text                      AS status,
                       COUNT(*)                            AS loans,
                       COALESCE(SUM(l.principal), 0)       AS principal,
                       COALESCE(SUM(o.outstanding), 0)     AS outstanding
                  FROM loan l
                  LEFT JOIN (
                        SELECT loan_id, SUM(GREATEST(amount_due - amount_paid, 0)) AS outstanding
                          FROM loan_repayment
                         GROUP BY loan_id
                  ) o ON o.loan_id = l.id
                 WHERE l.chama_id = ?1
                 GROUP BY 1
                """)
            .setParameter(1, chamaId)
            .getResultList();
    }

    /**
     * Contribution money billed and collected on everything already due, the collection rate the
     * health score is built from.
     *
     * <p>Returns due total, paid total, and the number of contributions behind them, so the caller
     * can tell "nobody has paid" from "nothing has been billed yet".
     */
    public Object[] contributionTotals(Long chamaId, LocalDate today) {
        return (Object[]) entityManager.createNativeQuery("""
                SELECT COALESCE(SUM(amount_due), 0),
                       COALESCE(SUM(LEAST(amount_paid, amount_due)), 0),
                       COUNT(*)
                  FROM contribution
                 WHERE chama_id = ?1 AND period <= ?2
                """)
            .setParameter(1, chamaId)
            .setParameter(2, today)
            .getSingleResult();
    }

    /** Repayment money due and paid on installments already scheduled, plus the installment count. */
    public Object[] repaymentTotals(Long chamaId, LocalDate today) {
        return (Object[]) entityManager.createNativeQuery("""
                SELECT COALESCE(SUM(r.amount_due), 0),
                       COALESCE(SUM(LEAST(r.amount_paid, r.amount_due)), 0),
                       COUNT(*)
                  FROM loan_repayment r
                  JOIN loan l ON l.id = r.loan_id
                 WHERE l.chama_id = ?1 AND r.scheduled_date <= ?2
                """)
            .setParameter(1, chamaId)
            .setParameter(2, today)
            .getSingleResult();
    }

    /** Meetings attended against meetings counted, with EXCUSED left out of both. */
    public Object[] attendanceTotals(Long chamaId) {
        return (Object[]) entityManager.createNativeQuery("""
                SELECT COUNT(*) FILTER (WHERE a.status = 'PRESENT'),
                       COUNT(*)
                  FROM meeting_attendance a
                  JOIN meeting m ON m.id = a.meeting_id
                 WHERE m.chama_id = ?1 AND a.status <> 'EXCUSED'
                """)
            .setParameter(1, chamaId)
            .getSingleResult();
    }

    /** Active members against everyone who has ever been one, the membership stability signal. */
    public Object[] membershipTotals(Long chamaId) {
        return (Object[]) entityManager.createNativeQuery("""
                SELECT COUNT(*) FILTER (WHERE status = 'ACTIVE'),
                       COUNT(*)
                  FROM member
                 WHERE chama_id = ?1
                """)
            .setParameter(1, chamaId)
            .getSingleResult();
    }

    /** How many distinct members owe anything at all, and how much is owed in total. */
    public Object[] arrearsTotals(Long chamaId, LocalDate today) {
        return (Object[]) entityManager.createNativeQuery("""
                SELECT COUNT(DISTINCT member_id),
                       COALESCE(SUM(amount_due - amount_paid), 0)
                  FROM contribution
                 WHERE chama_id = ?1 AND period < ?2 AND status <> 'PAID'
                """)
            .setParameter(1, chamaId)
            .setParameter(2, today)
            .getSingleResult();
    }

    /** Everything still owed across loans the chama has not closed off. */
    public BigDecimal outstandingLoanPrincipal(Long chamaId) {
        return (BigDecimal) entityManager.createNativeQuery("""
                SELECT COALESCE(SUM(GREATEST(r.amount_due - r.amount_paid, 0)), 0)
                  FROM loan_repayment r
                  JOIN loan l ON l.id = r.loan_id
                 WHERE l.chama_id = ?1 AND l.status IN ('DISBURSED', 'REPAYING', 'DEFAULTED')
                """)
            .setParameter(1, chamaId)
            .getSingleResult();
    }
}
