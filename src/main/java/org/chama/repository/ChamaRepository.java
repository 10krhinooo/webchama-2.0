package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.enums.ChamaStatus;
import org.chama.domain.model.Chama;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class ChamaRepository implements PanacheRepository<Chama> {

    public long countByStatus(ChamaStatus status) {
        return count("status", status);
    }

    public long countCreatedSince(Instant since) {
        return count("createdAt >= ?1", since);
    }

    public Optional<Chama> findByJoinCode(String joinCode) {
        return find("joinCode", joinCode).firstResultOptional();
    }

    public boolean joinCodeExists(String joinCode) {
        return count("joinCode", joinCode) > 0;
    }

    /**
     * ACTIVE chamas past their grace period (createdAt older than the cutoff, so a brand-new
     * chama with no contributions yet is never flipped INACTIVE) with no contribution paid on or
     * after the cutoff. Candidates for {@link org.chama.service.ChamaStatusService}'s sweep.
     */
    public List<Chama> findStaleActive(Instant cutoff) {
        return list("status = ?1 and createdAt < ?2"
                + " and id not in (select ct.chama.id from Contribution ct where ct.paidAt >= ?2)",
            ChamaStatus.ACTIVE, cutoff);
    }

    /**
     * INACTIVE chamas with a contribution paid on or after the cutoff, meaning activity has
     * resumed. Candidates for automatic reactivation in {@link org.chama.service.ChamaStatusService}.
     */
    public List<Chama> findReactivatable(Instant cutoff) {
        return list("status = ?1 and id in (select ct.chama.id from Contribution ct where ct.paidAt >= ?2)",
            ChamaStatus.INACTIVE, cutoff);
    }
}
