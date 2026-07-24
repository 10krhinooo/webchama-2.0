package org.chama.dto;

import org.chama.domain.enums.ResolutionStatus;
import org.chama.domain.model.Resolution;

import java.time.Instant;

public record ResolutionDto(
    Long id,
    Long chamaId,
    Long meetingId,
    String title,
    String description,
    ResolutionStatus status,
    Long openedByMemberId,
    String openedByName,
    Instant openedAt,
    Instant closedAt,
    long forVotes,
    long againstVotes,
    long abstainVotes) {

    public static ResolutionDto from(Resolution resolution, long forVotes, long againstVotes, long abstainVotes) {
        return new ResolutionDto(
            resolution.id,
            resolution.chama.id,
            resolution.meeting.id,
            resolution.title,
            resolution.description,
            resolution.status,
            resolution.openedBy.id,
            resolution.openedBy.fullName,
            resolution.openedAt,
            resolution.closedAt,
            forVotes,
            againstVotes,
            abstainVotes);
    }
}
