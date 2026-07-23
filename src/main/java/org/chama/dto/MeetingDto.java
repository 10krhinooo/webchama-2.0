package org.chama.dto;

import org.chama.domain.model.Meeting;

import java.time.Instant;
import java.time.LocalDate;

public record MeetingDto(
    Long id,
    Long chamaId,
    LocalDate meetingDate,
    String agenda,
    String minutes,
    Instant createdAt) {

    public static MeetingDto from(Meeting meeting) {
        return new MeetingDto(
            meeting.id,
            meeting.chama.id,
            meeting.meetingDate,
            meeting.agenda,
            meeting.minutes,
            meeting.createdAt);
    }
}
