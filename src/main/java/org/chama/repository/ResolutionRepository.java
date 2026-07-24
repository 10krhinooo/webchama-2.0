package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.model.Resolution;

import java.util.List;

@ApplicationScoped
public class ResolutionRepository implements PanacheRepository<Resolution> {

    public List<Resolution> findByChama(Long chamaId) {
        return list("chama.id = ?1 order by openedAt desc", chamaId);
    }

    public List<Resolution> findByMeeting(Long meetingId) {
        return list("meeting.id = ?1 order by openedAt desc", meetingId);
    }
}
