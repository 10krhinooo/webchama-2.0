package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.model.Meeting;

import java.util.List;

@ApplicationScoped
public class MeetingRepository implements PanacheRepository<Meeting> {

    public List<Meeting> findByChama(Long chamaId) {
        return list("chama.id = ?1 order by meetingDate desc", chamaId);
    }
}
