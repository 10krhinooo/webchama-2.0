package org.chama.dto;

import org.chama.domain.enums.AttendanceStatus;
import org.chama.domain.model.MeetingAttendance;

public record MeetingAttendanceDto(
    Long id,
    Long meetingId,
    Long memberId,
    String memberName,
    AttendanceStatus status) {

    public static MeetingAttendanceDto from(MeetingAttendance attendance) {
        return new MeetingAttendanceDto(
            attendance.id,
            attendance.meeting.id,
            attendance.member.id,
            attendance.member.fullName,
            attendance.status);
    }
}
