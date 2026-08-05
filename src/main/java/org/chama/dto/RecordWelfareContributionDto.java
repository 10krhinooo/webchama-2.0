package org.chama.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.chama.domain.enums.PaymentMethod;

import java.math.BigDecimal;

/** Treasurer/chairperson manually recording a welfare contribution paid outside M-Pesa (cash/bank/card in hand). */
public record RecordWelfareContributionDto(
    @NotNull Long memberId,
    @NotNull @Positive BigDecimal amount,
    @NotNull PaymentMethod method) {
}
