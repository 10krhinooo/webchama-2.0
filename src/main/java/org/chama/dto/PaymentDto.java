package org.chama.dto;

import org.chama.domain.enums.PaymentMethod;
import org.chama.domain.enums.PaymentPurpose;
import org.chama.domain.enums.PaymentStatus;
import org.chama.domain.model.Payment;

import java.math.BigDecimal;
import java.time.Instant;

public record PaymentDto(
    Long id,
    Long chamaId,
    Long memberId,
    Long contributionId,
    PaymentPurpose purpose,
    BigDecimal amount,
    PaymentMethod method,
    PaymentStatus status,
    String providerReference,
    String mpesaReceiptNumber,
    Instant paidAt,
    Instant createdAt) {

    public static PaymentDto from(Payment payment) {
        return new PaymentDto(
            payment.id,
            payment.chama.id,
            payment.member.id,
            payment.contribution != null ? payment.contribution.id : null,
            payment.purpose,
            payment.amount,
            payment.method,
            payment.status,
            payment.providerReference,
            payment.mpesaReceiptNumber,
            payment.paidAt,
            payment.createdAt);
    }
}
