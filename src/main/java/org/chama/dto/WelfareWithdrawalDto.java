package org.chama.dto;

import org.chama.domain.model.WelfareWithdrawal;

import java.math.BigDecimal;
import java.time.Instant;

public record WelfareWithdrawalDto(
    Long id,
    Long chamaId,
    BigDecimal amount,
    String reason,
    Long disbursedByMemberId,
    String disbursedByName,
    Instant disbursedAt) {

    public static WelfareWithdrawalDto from(WelfareWithdrawal withdrawal) {
        return new WelfareWithdrawalDto(
            withdrawal.id,
            withdrawal.chama.id,
            withdrawal.amount,
            withdrawal.reason,
            withdrawal.disbursedBy.id,
            withdrawal.disbursedBy.fullName,
            withdrawal.disbursedAt);
    }
}
