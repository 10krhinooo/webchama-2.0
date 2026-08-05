package org.chama.service;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.NotFoundException;
import org.chama.domain.enums.PaymentMethod;
import org.chama.domain.enums.PaymentPurpose;
import org.chama.domain.enums.PaymentStatus;
import org.chama.domain.model.Contribution;
import org.chama.domain.model.Member;
import org.chama.domain.model.Payment;
import org.chama.domain.model.WelfareContribution;
import org.chama.dto.FlutterwaveCallbackDto;
import org.chama.dto.MpesaCallbackDto;
import org.chama.repository.PaymentRepository;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

@ApplicationScoped
public class PaymentService {

    private static final Logger LOG = Logger.getLogger(PaymentService.class);

    /**
     * Window a PENDING M-Pesa payment is left alone before {@link #reconcileStalePendingMpesaPayments()}
     * re-queries Daraja for it. Also doubles as the "already pending" window {@link #initiateMpesaPayment}
     * and {@link #initiateMpesaWelfareContribution} check, so a member can't fire a second STK push to
     * the same phone while the first one is still awaiting a PIN.
     */
    private static final Duration RECONCILE_TIMEOUT = Duration.ofMinutes(5);

    @Inject
    PaymentRepository paymentRepository;

    @Inject
    ContributionService contributionService;

    @Inject
    WelfareContributionService welfareContributionService;

    @Inject
    MpesaService mpesaService;

    @Inject
    FlutterwaveService flutterwaveService;

    @ConfigProperty(name = "payment.mpesa-reconciliation.enabled", defaultValue = "true")
    boolean reconciliationEnabled;

    public record CardPaymentInit(Payment payment, String paymentLink) {}

    @Transactional
    public Payment initiateMpesaPayment(Long chamaId, Long contributionId, Member caller) {
        Contribution contribution = contributionFor(chamaId, contributionId, caller);
        paymentRepository.findPendingByContribution(contributionId).ifPresent(existing -> {
            throw new BadRequestException(
                "An M-Pesa payment request was already sent for this contribution. "
                    + "Check your phone, or wait a few minutes and try again.");
        });
        BigDecimal remaining = remainingBalance(contribution);

        Payment payment = newPendingPayment(contribution, caller, PaymentMethod.MPESA);
        paymentRepository.persist(payment);

        try {
            String checkoutId = mpesaService.stkPush(caller.phone, remaining,
                "CHAMA" + chamaId + "-C" + contributionId);
            payment.providerReference = checkoutId;
        } catch (RuntimeException e) {
            payment.status = PaymentStatus.FAILED;
            throw new BadRequestException(e.getMessage());
        }
        return payment;
    }

    /** Self-service: a member tops up the chama's welfare fund by an amount of their own choosing, via M-Pesa STK push. */
    @Transactional
    public Payment initiateMpesaWelfareContribution(Long chamaId, Member caller, BigDecimal amount) {
        paymentRepository.findPendingWelfareByChamaAndMember(chamaId, caller.id).ifPresent(existing -> {
            throw new BadRequestException(
                "An M-Pesa payment request was already sent for your welfare fund contribution. "
                    + "Check your phone, or wait a few minutes and try again.");
        });
        WelfareContribution contribution = welfareContributionService.createPending(chamaId, caller, amount);

        Payment payment = new Payment();
        payment.chama = contribution.chama;
        payment.member = caller;
        payment.welfareContribution = contribution;
        payment.purpose = PaymentPurpose.WELFARE;
        payment.amount = amount;
        payment.method = PaymentMethod.MPESA;
        payment.status = PaymentStatus.PENDING;
        paymentRepository.persist(payment);

        try {
            String checkoutId = mpesaService.stkPush(caller.phone, amount,
                "CHAMA" + chamaId + "-W" + contribution.id);
            payment.providerReference = checkoutId;
        } catch (RuntimeException e) {
            payment.status = PaymentStatus.FAILED;
            throw new BadRequestException(e.getMessage());
        }
        return payment;
    }

    @Transactional
    public CardPaymentInit initiateCardPayment(Long chamaId, Long contributionId, Member caller, String email) {
        Contribution contribution = contributionFor(chamaId, contributionId, caller);
        BigDecimal remaining = remainingBalance(contribution);

        Payment payment = newPendingPayment(contribution, caller, PaymentMethod.CARD);
        payment.providerReference = "CHAMA-" + chamaId + "-C" + contributionId + "-" + System.currentTimeMillis();
        paymentRepository.persist(payment);

        try {
            String link = flutterwaveService.initializePayment(
                payment.providerReference, remaining, email, caller.fullName, caller.phone);
            return new CardPaymentInit(payment, link);
        } catch (RuntimeException e) {
            payment.status = PaymentStatus.FAILED;
            throw new BadRequestException(e.getMessage());
        }
    }

    @Transactional
    public boolean verifyCardPayment(Long chamaId, Long contributionId, String txRef, Long transactionId) {
        Payment payment = paymentRepository.findByProviderReference(txRef).orElseThrow(NotFoundException::new);
        if (!payment.chama.id.equals(chamaId)
                || payment.contribution == null
                || !payment.contribution.id.equals(contributionId)) {
            throw new NotFoundException();
        }
        if (payment.status == PaymentStatus.SUCCESS) return true;

        boolean verified = transactionId != null
            ? flutterwaveService.verifyPaymentById(transactionId, payment.amount)
            : flutterwaveService.verifyPayment(txRef, payment.amount);

        if (verified) {
            markSuccess(payment, null);
        }
        return verified;
    }

    @Transactional
    public void handleMpesaCallback(MpesaCallbackDto dto) {
        if (dto.body() == null || dto.body().stkCallback() == null) return;
        var callback = dto.body().stkCallback();

        Payment payment = paymentRepository.findByProviderReference(callback.checkoutRequestId()).orElse(null);
        if (payment == null) {
            LOG.warnf("[PAYMENT] M-Pesa callback for unknown CheckoutRequestID=%s, ignoring",
                callback.checkoutRequestId());
            return;
        }
        if (payment.status != PaymentStatus.PENDING) return;

        if (callback.resultCode() != 0) {
            LOG.infof("[PAYMENT] M-Pesa callback result %d for payment %d, not marking success",
                callback.resultCode(), payment.id);
            payment.status = PaymentStatus.FAILED;
            return;
        }
        markSuccess(payment, callback.mpesaReceiptNumber());
    }

    /**
     * Never trusts the webhook body's own amount/status fields directly, the hash verification
     * done by the caller only proves the request came from Flutterwave, not that the amount
     * matches what we actually expect to be paid, always re-verify server-to-server before
     * marking the payment paid.
     */
    @Transactional
    public void handleFlutterwaveWebhook(FlutterwaveCallbackDto dto) {
        if (dto.txRef() == null) return;

        Payment payment = paymentRepository.findByProviderReference(dto.txRef()).orElse(null);
        if (payment == null) {
            LOG.warnf("[PAYMENT] Flutterwave webhook for unknown txRef=%s, ignoring", dto.txRef());
            return;
        }
        if (payment.status != PaymentStatus.PENDING) return;

        boolean verified = dto.id() != null
            ? flutterwaveService.verifyPaymentById(dto.id(), payment.amount)
            : flutterwaveService.verifyPayment(dto.txRef(), payment.amount);

        if (verified) {
            markSuccess(payment, null);
        } else {
            LOG.warnf("[PAYMENT] Flutterwave webhook re-verification failed for txRef=%s (possible tamper)",
                dto.txRef());
        }
    }

    private Contribution contributionFor(Long chamaId, Long contributionId, Member caller) {
        Contribution contribution = contributionService.get(chamaId, contributionId);
        if (!contribution.member.id.equals(caller.id)) {
            throw new ForbiddenException("Can only pay your own contribution");
        }
        return contribution;
    }

    private BigDecimal remainingBalance(Contribution contribution) {
        BigDecimal remaining = contribution.amountDue.subtract(contribution.amountPaid);
        if (remaining.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BadRequestException("Contribution is already fully paid");
        }
        return remaining;
    }

    private Payment newPendingPayment(Contribution contribution, Member caller, PaymentMethod method) {
        Payment payment = new Payment();
        payment.chama = contribution.chama;
        payment.member = caller;
        payment.contribution = contribution;
        payment.purpose = PaymentPurpose.CONTRIBUTION;
        payment.amount = contribution.amountDue.subtract(contribution.amountPaid);
        payment.method = method;
        payment.status = PaymentStatus.PENDING;
        return payment;
    }

    private void markSuccess(Payment payment, String mpesaReceiptNumber) {
        payment.status = PaymentStatus.SUCCESS;
        payment.paidAt = Instant.now();
        payment.mpesaReceiptNumber = mpesaReceiptNumber;
        if (payment.contribution != null) {
            contributionService.recordPayment(payment.chama.id, payment.contribution.id, payment.amount, payment.method);
        } else if (payment.welfareContribution != null) {
            welfareContributionService.markPaid(payment.chama.id, payment.welfareContribution.id, payment.method);
        }
    }

    /**
     * Sweeps M-Pesa payments still PENDING past {@link #RECONCILE_TIMEOUT} and re-queries Daraja's
     * STK Query endpoint for each, so a lost or delayed callback still resolves the payment's real
     * status in the database instead of leaving it PENDING forever (which is what previously forced
     * members to fire repeat STK pushes to the same phone). Unlike the B2C disbursement
     * reconciliation sweep, STK Query returns the result synchronously, so this applies it directly
     * rather than just re-triggering an async callback.
     */
    @Scheduled(every = "5m", identity = "mpesa-stk-reconciliation")
    void reconcileStalePendingMpesaPayments() {
        if (!reconciliationEnabled) {
            return;
        }
        Instant cutoff = Instant.now().minus(RECONCILE_TIMEOUT);
        List<Long> staleIds = QuarkusTransaction.requiringNew().call(() ->
            paymentRepository.findPendingOlderThan(PaymentMethod.MPESA, cutoff).stream().map(p -> p.id).toList());

        for (Long paymentId : staleIds) {
            try {
                QuarkusTransaction.requiringNew().run(() -> reconcileOne(paymentId));
            } catch (RuntimeException e) {
                LOG.errorf(e, "[PAYMENT] M-Pesa reconciliation failed for payment %d", paymentId);
            }
        }
    }

    private void reconcileOne(Long paymentId) {
        Payment payment = paymentRepository.findById(paymentId);
        if (payment == null || payment.status != PaymentStatus.PENDING || payment.providerReference == null) {
            return;
        }

        MpesaService.StkQueryResult result = mpesaService.queryStkStatus(payment.providerReference);
        if ("PENDING".equals(result.resultCode())) {
            return;
        }
        if (result.isPaid()) {
            markSuccess(payment, null);
        } else {
            payment.status = PaymentStatus.FAILED;
            LOG.infof("[PAYMENT] M-Pesa reconciliation result %s (%s) for payment %d, marking failed",
                result.resultCode(), result.resultDesc(), payment.id);
        }
    }
}
