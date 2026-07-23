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
}
