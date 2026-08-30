package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.model.MeetingAttendance;

import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class MeetingAttendanceRepository implements PanacheRepository<MeetingAttendance> {

    public List<MeetingAttendance> findByMeeting(Long meetingId) {
        return list("meeting.id", meetingId);
    }

    public Optional<MeetingAttendance> findByMeetingAndMember(Long meetingId, Long memberId) {
        return find("meeting.id = ?1 and member.id = ?2", meetingId, memberId).firstResultOptional();
    }

    public List<MeetingAttendance> findByChamaAndMember(Long chamaId, Long memberId) {
        return list("meeting.chama.id = ?1 and member.id = ?2", chamaId, memberId);
    }

    /**
     * Every attendance row in a chama, with the meeting joined in. Credit scoring reads each
     * row's meeting date, so leaving the association lazy would turn one query into one per
     * meeting.
     */
    public List<MeetingAttendance> findByChama(Long chamaId) {
        return find("select a from MeetingAttendance a join fetch a.meeting m where m.chama.id = ?1", chamaId)
            .list();
    }
}
