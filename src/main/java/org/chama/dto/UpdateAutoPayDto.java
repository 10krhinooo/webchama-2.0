package org.chama.dto;

import jakarta.validation.constraints.NotNull;

public record UpdateAutoPayDto(@NotNull Boolean autoPayEnabled) {
}
