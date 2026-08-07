package org.chama.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.chama.domain.enums.PaymentMethod;

import java.math.BigDecimal;

public record RecordLoanRepaymentDto(@NotNull @Positive BigDecimal amount, PaymentMethod method) {

    /** Defaults to CASH, the common case for a treasurer recording an in-person repayment. */
    public PaymentMethod methodOrDefault() {
        return method != null ? method : PaymentMethod.CASH;
    }
}
