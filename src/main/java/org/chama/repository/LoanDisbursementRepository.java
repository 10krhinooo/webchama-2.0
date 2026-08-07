package org.chama.repository;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.enums.LoanDisbursementStatus;
import org.chama.domain.model.LoanDisbursement;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class LoanDisbursementRepository implements PanacheRepository<LoanDisbursement> {

    public List<LoanDisbursement> findByLoan(Long loanId) {
        return list("loan.id = ?1 order by requestedAt desc", loanId);
    }

    public Optional<LoanDisbursement> findByConversationId(String conversationId) {
        return find("conversationId", conversationId).firstResultOptional();
    }

    /** Rows still awaiting a callback past the reconciliation timeout window. */
    public List<LoanDisbursement> findPendingOlderThan(Instant cutoff) {
        return list("status = ?1 and requestedAt < ?2", LoanDisbursementStatus.PENDING, cutoff);
    }

    /** Rows still claimed but never acknowledged by Safaricom past the reconciliation timeout window. */
    public List<LoanDisbursement> findInitiatingOlderThan(Instant cutoff) {
        return list("status = ?1 and requestedAt < ?2", LoanDisbursementStatus.INITIATING, cutoff);
    }
}
