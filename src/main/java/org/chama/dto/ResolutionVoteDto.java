package org.chama.dto;

import org.chama.domain.enums.VoteChoice;
import org.chama.domain.model.ResolutionVote;

import java.time.Instant;

public record ResolutionVoteDto(
    Long id,
    Long resolutionId,
    Long memberId,
    String memberName,
    VoteChoice choice,
    Instant votedAt) {

    public static ResolutionVoteDto from(ResolutionVote vote) {
        return new ResolutionVoteDto(
            vote.id,
            vote.resolution.id,
            vote.member.id,
            vote.member.fullName,
            vote.choice,
            vote.votedAt);
    }
}
