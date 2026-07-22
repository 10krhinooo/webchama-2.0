package org.chama.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import org.chama.domain.enums.MemberRoleType;

import java.util.List;

public record UpdateMemberDto(
    @NotBlank String fullName,
    @NotBlank String phone,
    String nationalId,
    String nextOfKin,
    @NotEmpty List<MemberRoleType> roles) {
}
