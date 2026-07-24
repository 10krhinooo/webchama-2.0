package org.chama.service;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.chama.domain.enums.ActivityEventType;
import org.chama.domain.model.Contribution;
import org.chama.repository.ContributionRepository;
import org.jboss.logging.Logger;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

/**
 * Opt-in scheduled auto-STK-push (issue #60, MIGRATION_PLAN.md section 9/11): with explicit
 * member opt-in ({@link org.chama.domain.model.Member#autoPayEnabled}), automatically fires an
 * STK push on a contribution's due date instead of waiting for the member to remember. Follows
 * the same sweep style as {@link LoanDisbursementService#reconcileStalePending()}: iterate a
 * repository query, try/catch per row so one member's failure never blocks the rest of the sweep.
 * The push itself goes through the exact same {@link PaymentService#initiateMpesaPayment} path a
 * member's own "Pay via M-Pesa" button uses, this scheduler only changes what triggers it.
 *
 * <p>Each candidate is pushed inside its own fresh transaction ({@link QuarkusTransaction#requiringNew()})
 * rather than one transaction for the whole sweep. {@code initiateMpesaPayment} is itself
 * {@code @Transactional}, and self-invocation of a {@code @Transactional} method from within the
 * same bean does not go through the CDI interceptor, so a single ambient transaction for the
 * whole loop would also mean a single failed push marks the entire sweep rollback-only, undoing
 * every other member's already-fired push. A fresh transaction per contribution keeps failures
 * isolated to the row that actually failed.
 */
@ApplicationScoped
public class ContributionAutoPushService {

    private static final Logger LOG = Logger.getLogger(ContributionAutoPushService.class);

    @Inject
    ContributionRepository contributionRepository;

    @Inject
    PaymentService paymentService;

    @Inject
    ActivityLogService activityLogService;

    @Scheduled(every = "1h", identity = "contribution-auto-stk-push")
    void fireDueAutoPushes() {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        Instant startOfToday = today.atStartOfDay(ZoneOffset.UTC).toInstant();

        List<Long> dueContributionIds = QuarkusTransaction.requiringNew().call(() ->
            contributionRepository.findDueForAutoPush(today, startOfToday).stream().map(c -> c.id).toList());

        for (Long contributionId : dueContributionIds) {
            try {
                QuarkusTransaction.requiringNew().run(() -> pushOne(contributionId));
            } catch (RuntimeException e) {
                LOG.errorf(e, "[AUTO-STK] Auto STK push failed for contribution %d", contributionId);
            }
        }
    }

    private void pushOne(Long contributionId) {
        Contribution contribution = contributionRepository.findById(contributionId);
        if (contribution == null) {
            return;
        }
        paymentService.initiateMpesaPayment(contribution.chama.id, contribution.id, contribution.member);
        contribution.lastAutoPushAt = Instant.now();
        activityLogService.log(contribution.chama, ActivityEventType.AUTO_STK_PUSH_SENT,
            "Auto STK push sent to " + contribution.member.fullName + " for their " + contribution.period + " contribution");
    }
}
