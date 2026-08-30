package org.chama.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.NotFoundException;
import org.chama.domain.enums.AttendanceStatus;
import org.chama.domain.enums.MemberStatus;
import org.chama.domain.enums.NotificationEventFamily;
import org.chama.domain.model.Meeting;
import org.chama.domain.model.MeetingAttendance;
import org.chama.domain.model.Member;
import org.chama.dto.CreateMeetingDto;
import org.chama.repository.MeetingAttendanceRepository;
import org.chama.repository.MeetingRepository;
import org.chama.repository.MemberRepository;
import org.chama.service.notification.MeetingNotificationEmailService;

import java.util.List;

@ApplicationScoped
public class MeetingService {

    @Inject
    MeetingRepository meetingRepository;

    @Inject
    NotificationService notificationService;

    @Inject
    MeetingAttendanceRepository meetingAttendanceRepository;

    @Inject
    MemberRepository memberRepository;

    @Inject
    ChamaService chamaService;

    @Inject
    MeetingNotificationEmailService meetingNotificationEmailService;

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
        List<MeetingNotificationEmailService.Recipient> emailable = announce(chamaId,
            "Meeting scheduled", "%s: %s".formatted(meeting.meetingDate, meeting.agenda));
        meetingNotificationEmailService.sendMeetingScheduled(
            emailable, meeting.chama.name, meeting.meetingDate, meeting.agenda);
        return meeting;
    }

    @Transactional
    public Meeting updateMinutes(Long chamaId, Long meetingId, String minutes) {
        Meeting meeting = get(chamaId, meetingId);
        meeting.minutes = minutes;
        List<MeetingNotificationEmailService.Recipient> emailable = announce(chamaId,
            "Minutes published",
            "Minutes for the meeting of %s are available.".formatted(meeting.meetingDate));
        meetingNotificationEmailService.sendMinutesPublished(
            emailable, meeting.chama.name, meeting.meetingDate);
        return meeting;
    }

    /**
     * Puts a meeting announcement in every active member's inbox and returns the subset who still
     * want it by email as well, so both channels come from a single member query.
     */
    private List<MeetingNotificationEmailService.Recipient> announce(Long chamaId, String title, String body) {
        List<MeetingNotificationEmailService.Recipient> recipients = activeMemberRecipients(chamaId);
        String link = "/chamas/" + chamaId + "/meetings";
        recipients.forEach(r -> notificationService.record(
            r.keycloakUserId(), chamaId, NotificationEventFamily.MEETING, title, body, link));
        return recipients.stream()
            .filter(r -> notificationService.emailEnabled(r.keycloakUserId(), NotificationEventFamily.MEETING))
            .toList();
    }

    private List<MeetingNotificationEmailService.Recipient> activeMemberRecipients(Long chamaId) {
        return memberRepository.findByChama(chamaId).stream()
            .filter(m -> m.status == MemberStatus.ACTIVE)
            .map(m -> new MeetingNotificationEmailService.Recipient(m.keycloakUserId, m.fullName))
            .toList();
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
