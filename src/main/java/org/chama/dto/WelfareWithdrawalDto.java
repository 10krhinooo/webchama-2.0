package org.chama.dto;

import org.chama.domain.enums.WelfareWithdrawalStatus;
import org.chama.domain.model.WelfareWithdrawal;

import java.math.BigDecimal;
import java.time.Instant;

public record WelfareWithdrawalDto(
    Long id,
    Long chamaId,
    BigDecimal amount,
    String reason,
    WelfareWithdrawalStatus status,
    Long requestedByMemberId,
    String requestedByName,
    Instant requestedAt,
    /** All three disbursement fields are null while the withdrawal is still awaiting sign-off. */
    Long disbursedByMemberId,
    String disbursedByName,
    Instant disbursedAt) {

    public static WelfareWithdrawalDto from(WelfareWithdrawal withdrawal) {
        return new WelfareWithdrawalDto(
            withdrawal.id,
            withdrawal.chama.id,
            withdrawal.amount,
            withdrawal.reason,
            withdrawal.status,
            withdrawal.requestedBy.id,
            withdrawal.requestedBy.fullName,
            withdrawal.requestedAt,
            withdrawal.disbursedBy == null ? null : withdrawal.disbursedBy.id,
            withdrawal.disbursedBy == null ? null : withdrawal.disbursedBy.fullName,
            withdrawal.disbursedAt);
    }
}
