package org.chama.dto;

import jakarta.validation.constraints.NotNull;
import org.chama.domain.enums.MemberStatus;

public record UpdateMemberStatusDto(@NotNull MemberStatus status) {
}
