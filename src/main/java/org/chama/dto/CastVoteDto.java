package org.chama.dto;

import jakarta.validation.constraints.NotNull;
import org.chama.domain.enums.VoteChoice;

public record CastVoteDto(@NotNull VoteChoice choice) {
}
