package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.enums.ApprovalStatus;
import org.chama.domain.enums.ApprovalTargetType;
import org.chama.domain.model.Approval;

import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class ApprovalRepository implements PanacheRepository<Approval> {

    public List<Approval> findByChama(Long chamaId) {
        return list("chama.id = ?1 order by requestedAt desc", chamaId);
    }

    public List<Approval> findPendingByChama(Long chamaId) {
        return list("chama.id = ?1 and status = ?2 order by requestedAt desc", chamaId, ApprovalStatus.PENDING);
    }

    /** Most recent approval request for a given target, regardless of status. */
    public Optional<Approval> findLatestByTarget(ApprovalTargetType targetType, Long targetId) {
        return find("targetType = ?1 and targetId = ?2 order by requestedAt desc", targetType, targetId)
            .firstResultOptional();
    }
}
