package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.chama.domain.enums.ReminderKind;
import org.chama.domain.model.ReminderDispatch;

@ApplicationScoped
public class ReminderDispatchRepository implements PanacheRepository<ReminderDispatch> {

    @PersistenceContext
    EntityManager entityManager;

    /**
     * Claims the right to send one reminder, returning false if it has already been sent.
     *
     * <p>An atomic insert-or-skip against the unique constraint, rather than a select followed by
     * an insert. Two instances sweeping the same hour would both pass a select and both send; here
     * exactly one insert takes effect and the loser is told so by the row count.
     *
     * <p>ON CONFLICT DO NOTHING rather than catching the constraint violation: a violation would
     * mark the whole transaction rollback-only, taking down every other reminder in the same sweep
     * along with it.
     */
    public boolean claim(Long contributionId, ReminderKind kind, java.time.LocalDate scheduledFor) {
        return entityManager.createNativeQuery("""
                INSERT INTO reminder_dispatch (contribution_id, reminder_kind, scheduled_for)
                VALUES (?1, CAST(?2 AS reminder_kind), ?3)
                ON CONFLICT (contribution_id, reminder_kind, scheduled_for) DO NOTHING
                """)
            .setParameter(1, contributionId)
            .setParameter(2, kind.name())
            .setParameter(3, scheduledFor)
            .executeUpdate() == 1;
    }

    public long countForContribution(Long contributionId) {
        return count("contribution.id", contributionId);
    }
}
