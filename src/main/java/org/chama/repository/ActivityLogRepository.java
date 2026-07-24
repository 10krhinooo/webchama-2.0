package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.model.ActivityLog;

import java.util.List;

@ApplicationScoped
public class ActivityLogRepository implements PanacheRepository<ActivityLog> {

    public List<ActivityLog> findRecentForChama(Long chamaId, int page, int size) {
        return find("chama.id = ?1 order by createdAt desc", chamaId).page(page, size).list();
    }

    public long countForChama(Long chamaId) {
        return count("chama.id = ?1", chamaId);
    }
}
