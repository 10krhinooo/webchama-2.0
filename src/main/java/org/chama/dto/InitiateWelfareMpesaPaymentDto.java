package org.chama.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

/** Self-service: the amount a member chooses to top up the welfare fund by, paid via M-Pesa STK push. */
public record InitiateWelfareMpesaPaymentDto(@NotNull @Positive BigDecimal amount) {
}
