package org.chama.dto;

import org.chama.domain.enums.PaymentMethod;

public record SettlePenaltyDto(PaymentMethod method) {

    /** Defaults to CASH, the common case for a treasurer recording an in-person settlement. */
    public PaymentMethod methodOrDefault() {
        return method != null ? method : PaymentMethod.CASH;
    }
}
