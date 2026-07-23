package org.chama.service;

import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;
import org.chama.domain.enums.LoanDisbursementStatus;
import org.chama.domain.enums.LoanStatus;
import org.chama.domain.model.Loan;
import org.chama.domain.model.LoanDisbursement;
import org.chama.dto.B2cResultCallbackDto;
import org.chama.repository.LoanDisbursementRepository;
import org.chama.repository.LoanRepository;
import org.jboss.logging.Logger;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Daraja B2C loan disbursement (MIGRATION_PLAN.md section 6). {@link #initiate} only ever records
 * a PENDING loan_disbursement row and fires the paymentrequest call through {@link DarajaB2cClient},
 * it never marks a loan DISBURSED itself, the initial 200 response only confirms Safaricom accepted
 * the request, not that money moved. Only {@link #applyResultCallback} (driven by
 * B2cCallbackResource) or the reconciliation sweep resolves a disbursement to COMPLETED/FAILED.
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

    /**
     * Triggers a B2C payout for an APPROVED loan. Restricted to TREASURER/CHAIRPERSON at the
     * resource layer (issue #36 notes the intended maker-checker dual sign-off from Phase 7a is
     * not yet in place, this single-role gate is the interim control).
     */
    @Transactional
    public LoanDisbursement initiate(Long chamaId, Long loanId) {
        Loan loan = loanRepository.findByIdOptional(loanId).orElseThrow(NotFoundException::new);
        if (!loan.chama.id.equals(chamaId)) {
            throw new NotFoundException();
        }
        if (loan.status != LoanStatus.APPROVED) {
            throw new BadRequestException("Only an approved loan can be disbursed");
        }

        DarajaB2cClient.B2cAckResult ack = b2cClient.requestPayout(
            loan.member.phone, loan.principal, "Loan disbursement " + loan.id);

        LoanDisbursement disbursement = new LoanDisbursement();
        disbursement.loan = loan;
        disbursement.conversationId = ack.conversationId();
        disbursement.originatorConversationId = ack.originatorConversationId();
        disbursement.targetPhone = MpesaService.normalizePhone(loan.member.phone);
        disbursement.amount = loan.principal;
        loanDisbursementRepository.persist(disbursement);
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
        } else {
            disbursement.status = LoanDisbursementStatus.FAILED;
            LOG.infof("[B2C] Disbursement %d failed: resultCode=%d %s",
                disbursement.id, result.resultCode(), result.resultDesc());
        }
    }

    /**
     * Sweeps loan_disbursement rows still PENDING past the reconciliation timeout and re-queries
     * Daraja, so a lost or delayed callback doesn't leave a loan silently stuck (issue #35). The
     * query result itself arrives back through the same ResultURL callback path, this only
     * re-triggers it, it doesn't resolve status synchronously.
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
    }
}
