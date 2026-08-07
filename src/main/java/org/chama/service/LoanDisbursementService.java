package org.chama.service;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;
import org.chama.domain.enums.ApprovalTargetType;
import org.chama.domain.enums.LoanDisbursementStatus;
import org.chama.domain.enums.LoanStatus;
import org.chama.domain.model.Loan;
import org.chama.domain.model.LoanDisbursement;
import org.chama.dto.B2cResultCallbackDto;
import org.chama.repository.LoanDisbursementRepository;
import org.chama.repository.LoanRepository;
import org.chama.service.notification.LoanStatusEmailService;
import org.jboss.logging.Logger;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Daraja B2C loan disbursement. {@link #initiate} claims the loan and commits an INITIATING
 * loan_disbursement row in its own transaction {@code before} calling {@link DarajaB2cClient},
 * so a commit failure after Safaricom has already accepted the payout can never lose the only
 * record that it happened (issue P0-3); it never marks a loan DISBURSED itself, the initial 200
 * response only confirms Safaricom accepted the request, not that money moved. Only
 * {@link #applyResultCallback} (driven by B2cCallbackResource) or the reconciliation sweep
 * resolves a disbursement to COMPLETED/FAILED.
 */
@ApplicationScoped
public class LoanDisbursementService {

    private static final Logger LOG = Logger.getLogger(LoanDisbursementService.class);
    private static final Duration RECONCILE_TIMEOUT = Duration.ofMinutes(5);

    @Inject
    DarajaB2cClient b2cClient;

    @Inject
    LoanRepository loanRepository;

    @Inject
    LoanDisbursementRepository loanDisbursementRepository;

    @Inject
    ApprovalService approvalService;

    @Inject
    LoanStatusEmailService loanStatusEmailService;

    private record Claim(Long disbursementId, Long loanId, String phone, BigDecimal amount) {}

    /**
     * Triggers a B2C payout for an APPROVED loan. Restricted to TREASURER/CHAIRPERSON at the
     * resource layer. A principal at or above the chama's approval threshold additionally requires
     * a cleared maker-checker dual sign-off (issues #52/#54/#36) before the B2C call fires, see
     * {@link ApprovalService#requireApproved}.
     *
     * <p>Runs as three separate transactions rather than one: {@link #claim} commits an
     * INITIATING row and moves the loan to DISBURSEMENT_PENDING <em>before</em> the external call,
     * so that row survives even if this method never returns (crash, timeout) once Safaricom has
     * accepted the payout. The B2C call itself happens with no open transaction. Its outcome is
     * then applied in its own commit, {@link #applyAck} on success or {@link #releaseClaim} on
     * failure (which reopens the loan for a retry).
     */
    public LoanDisbursement initiate(Long chamaId, Long loanId) {
        Claim claim = QuarkusTransaction.requiringNew().call(() -> claim(chamaId, loanId));

        DarajaB2cClient.B2cAckResult ack;
        try {
            ack = b2cClient.requestPayout(claim.phone(), claim.amount(), "Loan disbursement " + claim.loanId());
        } catch (RuntimeException e) {
            QuarkusTransaction.requiringNew().run(() -> releaseClaim(claim.disbursementId(), claim.loanId(), e.getMessage()));
            throw e;
        }

        return QuarkusTransaction.requiringNew().call(() -> applyAck(claim.disbursementId(), ack));
    }

    /**
     * Atomically claims the loan for disbursement: an optimistic-locked transition off APPROVED
     * (mirroring Loan's existing claim-once pattern, see {@code Loan.version}'s doc comment) means
     * a double-click or client retry racing this same call fails on commit rather than both
     * proceeding to fire a real M-Pesa payout (issue P0-4). The loan_disbursement row this leaves
     * behind also backs a DB-level UNIQUE partial index on (loan_id) for active statuses, a
     * second line of defense independent of the optimistic lock.
     *
     * <p>Not itself {@code @Transactional}: it's only ever called through
     * {@code QuarkusTransaction.requiringNew()} at the {@link #initiate} call site, which is what
     * actually opens the transaction (a self-invoked {@code @Transactional} on a method in this
     * same class would never fire the CDI interceptor).
     */
    Claim claim(Long chamaId, Long loanId) {
        Loan loan = loanRepository.findByIdOptional(loanId).orElseThrow(NotFoundException::new);
        if (!loan.chama.id.equals(chamaId)) {
            throw new NotFoundException();
        }
        if (loan.status != LoanStatus.APPROVED) {
            throw new BadRequestException("Only an approved loan can be disbursed");
        }
        if (approvalService.requiresApproval(loan.chama, loan.principal)) {
            approvalService.requireApproved(chamaId, ApprovalTargetType.LOAN_DISBURSEMENT, loanId);
        }

        loan.status = LoanStatus.DISBURSEMENT_PENDING;

        LoanDisbursement disbursement = new LoanDisbursement();
        disbursement.loan = loan;
        disbursement.targetPhone = MpesaService.normalizePhone(loan.member.phone);
        disbursement.amount = loan.principal;
        disbursement.status = LoanDisbursementStatus.INITIATING;
        loanDisbursementRepository.persist(disbursement);
        loanDisbursementRepository.flush();

        return new Claim(disbursement.id, loan.id, loan.member.phone, loan.principal);
    }

    /** The B2C paymentrequest call itself failed (rejected, network error): release the claim so the loan can be retried. */
    void releaseClaim(Long disbursementId, Long loanId, String errorMessage) {
        LoanDisbursement disbursement = loanDisbursementRepository.findById(disbursementId);
        disbursement.status = LoanDisbursementStatus.FAILED;
        disbursement.resultDescription = errorMessage;
        Loan loan = loanRepository.findById(loanId);
        loan.status = LoanStatus.APPROVED;
    }

    /** Safaricom acknowledged the paymentrequest call: record its ConversationID and move to PENDING. */
    LoanDisbursement applyAck(Long disbursementId, DarajaB2cClient.B2cAckResult ack) {
        LoanDisbursement disbursement = loanDisbursementRepository.findById(disbursementId);
        disbursement.conversationId = ack.conversationId();
        disbursement.originatorConversationId = ack.originatorConversationId();
        disbursement.status = LoanDisbursementStatus.PENDING;
        return disbursement;
    }

    /**
     * Applies a ResultURL/QueueTimeOutURL callback. Validated against a known-PENDING
     * loan_disbursement by ConversationID before anything is updated (issue #34), an unsolicited
     * or replayed callback for an unknown or already-resolved conversation is a silent no-op.
     */
    @Transactional
    public void applyResultCallback(B2cResultCallbackDto.Result result) {
        if (result == null || result.conversationId() == null) return;

        LoanDisbursement disbursement = loanDisbursementRepository
            .findByConversationId(result.conversationId()).orElse(null);
        if (disbursement == null) {
            LOG.warnf("[B2C] Callback for unknown ConversationID=%s, ignoring", result.conversationId());
            return;
        }
        if (disbursement.status != LoanDisbursementStatus.PENDING) return;

        disbursement.resultCode = String.valueOf(result.resultCode());
        disbursement.resultDescription = result.resultDesc();
        disbursement.transactionId = result.transactionId();

        if (result.resultCode() == 0) {
            disbursement.status = LoanDisbursementStatus.COMPLETED;
            disbursement.disbursedAt = Instant.now();
            Loan loan = disbursement.loan;
            loan.status = LoanStatus.DISBURSED;
            loan.disbursedAt = disbursement.disbursedAt;
            loanStatusEmailService.sendDisbursed(loan.member.keycloakUserId, loan.member.fullName,
                loan.chama.name, loan.chama.currency, disbursement.amount);
        } else {
            disbursement.status = LoanDisbursementStatus.FAILED;
            // Reopen the loan for a retry: initiate() requires status == APPROVED, and claim()
            // already moved it to DISBURSEMENT_PENDING, so a failed payout must not leave it
            // stuck there.
            Loan loan = disbursement.loan;
            loan.status = LoanStatus.APPROVED;
            LOG.infof("[B2C] Disbursement %d failed: resultCode=%d %s",
                disbursement.id, result.resultCode(), result.resultDesc());
            loanStatusEmailService.sendDisbursementFailed(loan.member.keycloakUserId, loan.member.fullName,
                loan.chama.name, loan.chama.currency, disbursement.amount, result.resultDesc());
        }
    }

    /**
     * Sweeps loan_disbursement rows still PENDING past the reconciliation timeout and re-queries
     * Daraja, so a lost or delayed callback doesn't leave a loan silently stuck (issue #35). The
     * query result itself arrives back through the same ResultURL callback path, this only
     * re-triggers it, it doesn't resolve status synchronously. A row still stuck INITIATING past
     * the same window means the process most likely crashed before or during the B2C call itself,
     * whether Safaricom ever received it is unknown, so unlike PENDING this is only logged for
     * manual investigation, never auto-resolved: guessing wrong in either direction either strands
     * the loan or risks a second real payout.
     */
    @Transactional
    @Scheduled(every = "5m", identity = "b2c-disbursement-reconciliation")
    void reconcileStalePending() {
        Instant cutoff = Instant.now().minus(RECONCILE_TIMEOUT);
        List<LoanDisbursement> stale = loanDisbursementRepository.findPendingOlderThan(cutoff);
        for (LoanDisbursement disbursement : stale) {
            try {
                b2cClient.queryTransactionStatus(disbursement.originatorConversationId);
            } catch (RuntimeException e) {
                LOG.errorf(e, "[B2C] Reconciliation query failed for disbursement %d", disbursement.id);
            }
        }

        for (LoanDisbursement disbursement : loanDisbursementRepository.findInitiatingOlderThan(cutoff)) {
            LOG.errorf("[B2C] Disbursement %d has been stuck INITIATING since %s, Safaricom may or may "
                    + "not have received the payout request, needs manual investigation before the loan "
                    + "is retried or the row is resolved",
                disbursement.id, disbursement.requestedAt);
        }
    }
}
