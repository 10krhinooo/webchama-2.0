package org.chama.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.NotFoundException;
import org.chama.domain.enums.AttendanceStatus;
import org.chama.domain.model.Meeting;
import org.chama.domain.model.MeetingAttendance;
import org.chama.domain.model.Member;
import org.chama.dto.CreateMeetingDto;
import org.chama.repository.MeetingAttendanceRepository;
import org.chama.repository.MeetingRepository;
import org.chama.repository.MemberRepository;

import java.util.List;

@ApplicationScoped
public class MeetingService {

    @Inject
    MeetingRepository meetingRepository;

    @Inject
    MeetingAttendanceRepository meetingAttendanceRepository;

    @Inject
    MemberRepository memberRepository;

    @Inject
    ChamaService chamaService;

    public List<Meeting> listForChama(Long chamaId) {
        return meetingRepository.findByChama(chamaId);
    }

    public Meeting get(Long chamaId, Long meetingId) {
        Meeting meeting = meetingRepository.findByIdOptional(meetingId).orElseThrow(NotFoundException::new);
        if (!meeting.chama.id.equals(chamaId)) {
            throw new NotFoundException();
        }
        return meeting;
    }

    @Transactional
    public Meeting create(Long chamaId, CreateMeetingDto dto) {
        Meeting meeting = new Meeting();
        meeting.chama = chamaService.get(chamaId);
        meeting.meetingDate = dto.meetingDate();
        meeting.agenda = dto.agenda();
        meetingRepository.persist(meeting);
        return meeting;
    }

    @Transactional
    public Meeting updateMinutes(Long chamaId, Long meetingId, String minutes) {
        Meeting meeting = get(chamaId, meetingId);
        meeting.minutes = minutes;
        return meeting;
    }

    public List<MeetingAttendance> getAttendance(Long chamaId, Long meetingId) {
        get(chamaId, meetingId);
        return meetingAttendanceRepository.findByMeeting(meetingId);
    }

    /** Upserts one attendance row per (meeting, member), so recording attendance twice for the same member updates it in place. */
    @Transactional
    public MeetingAttendance recordAttendance(Long chamaId, Long meetingId, Long memberId, AttendanceStatus status) {
        Meeting meeting = get(chamaId, meetingId);
        Member member = memberRepository.findByIdOptional(memberId).orElseThrow(NotFoundException::new);
        if (!member.chama.id.equals(chamaId)) {
            throw new NotFoundException();
        }

        MeetingAttendance attendance = meetingAttendanceRepository.findByMeetingAndMember(meetingId, memberId)
            .orElseGet(() -> {
                MeetingAttendance created = new MeetingAttendance();
                created.meeting = meeting;
                created.member = member;
                created.status = status;
                meetingAttendanceRepository.persist(created);
                return created;
            });
        attendance.status = status;
        return attendance;
    }
}
