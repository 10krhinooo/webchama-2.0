package org.chama.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.chama.domain.enums.PaymentMethod;

import java.math.BigDecimal;

public record RecordPaymentDto(@NotNull @Positive BigDecimal amount, @NotNull PaymentMethod method) {
}
