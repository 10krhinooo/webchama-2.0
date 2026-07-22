package org.chama.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record InitiateCardPaymentDto(@NotBlank @Email String email) {
}
