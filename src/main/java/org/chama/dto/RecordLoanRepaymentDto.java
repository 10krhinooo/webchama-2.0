package org.chama.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

public record RecordLoanRepaymentDto(@NotNull @Positive BigDecimal amount) {
}
