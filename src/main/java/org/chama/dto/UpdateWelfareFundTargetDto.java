package org.chama.dto;

import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;

public record UpdateWelfareFundTargetDto(
    // Null means no goal is set, distinct from a goal of zero.
    @PositiveOrZero BigDecimal target) {
}
