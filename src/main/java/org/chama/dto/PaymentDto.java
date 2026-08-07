package org.chama.dto;

import org.chama.domain.enums.PaymentMethod;
import org.chama.domain.enums.PaymentPurpose;
import org.chama.domain.enums.PaymentStatus;
import org.chama.domain.model.Payment;

import java.math.BigDecimal;
import java.time.Instant;

// providerReference (the Daraja CheckoutRequestID / Flutterwave tx_ref) is deliberately not
// exposed here: for M-Pesa it's the one credential a forged mpesa-callback POST needs, and it's
// handed to the same member who can trigger the payment. Card checkout gets its txRef through a
// dedicated response (ContributionResource.payWithCard), not this DTO.
public record PaymentDto(
    Long id,
    Long chamaId,
    Long memberId,
    Long contributionId,
    Long welfareContributionId,
    Long loanRepaymentId,
    Long penaltyId,
    PaymentPurpose purpose,
    BigDecimal amount,
    PaymentMethod method,
    PaymentStatus status,
    String mpesaReceiptNumber,
    Instant paidAt,
    Instant createdAt) {

    public static PaymentDto from(Payment payment) {
        return new PaymentDto(
            payment.id,
            payment.chama.id,
            payment.member.id,
            payment.contribution != null ? payment.contribution.id : null,
            payment.welfareContribution != null ? payment.welfareContribution.id : null,
            payment.loanRepayment != null ? payment.loanRepayment.id : null,
            payment.penalty != null ? payment.penalty.id : null,
            payment.purpose,
            payment.amount,
            payment.method,
            payment.status,
            payment.mpesaReceiptNumber,
            payment.paidAt,
            payment.createdAt);
    }
}
