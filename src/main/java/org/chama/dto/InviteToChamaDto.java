package org.chama.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record InviteToChamaDto(@NotBlank @Email String email) {
}
