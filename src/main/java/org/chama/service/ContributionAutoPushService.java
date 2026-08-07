package org.chama.service;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.chama.domain.enums.ActivityEventType;
import org.chama.domain.model.Contribution;
import org.chama.repository.ContributionRepository;
import org.chama.service.notification.AutoPushFailedEmailService;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
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

    @Inject
    AutoPushFailedEmailService autoPushFailedEmailService;

    @ConfigProperty(name = "contribution.auto-push.enabled", defaultValue = "true")
    boolean autoPushEnabled;

    // The shortest autoPushRetryHours a chama can configure (see UpdateAutoPushSettingsDto), used
    // as a broad pre-filter in the repository query; the exact per-chama interval is checked here.
    private static final int MIN_RETRY_HOURS = 1;

    // Every chama and member is Kenya-based, so a contribution is "due today" against the Nairobi
    // calendar day, never UTC or the server's own timezone, both of which disagree with Nairobi
    // for part of every day (see ContributionService.CHAMA_ZONE for the same reasoning).
    private static final ZoneId CHAMA_ZONE = ZoneId.of("Africa/Nairobi");

    @Scheduled(every = "1h", identity = "contribution-auto-stk-push")
    void fireDueAutoPushes() {
        if (!autoPushEnabled) {
            return;
        }
        LocalDate today = LocalDate.now(CHAMA_ZONE);
        Instant earliestPossibleRetry = Instant.now().minus(Duration.ofHours(MIN_RETRY_HOURS));

        List<Long> dueContributionIds = QuarkusTransaction.requiringNew().call(() ->
            contributionRepository.findDueForAutoPush(today, earliestPossibleRetry).stream().map(c -> c.id).toList());

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
        Instant retryCutoff = Instant.now().minus(Duration.ofHours(contribution.chama.autoPushRetryHours));
        if (contribution.lastAutoPushAt != null && contribution.lastAutoPushAt.isAfter(retryCutoff)) {
            return;
        }
        try {
            paymentService.initiateMpesaPayment(contribution.chama.id, contribution.id, contribution.member);
        } catch (RuntimeException e) {
            autoPushFailedEmailService.sendPushFailed(contribution.member.keycloakUserId, contribution.member.fullName,
                contribution.chama.name, contribution.chama.currency,
                contribution.amountDue.subtract(contribution.amountPaid), contribution.period, e.getMessage());
            throw e;
        }
        contribution.lastAutoPushAt = Instant.now();
        activityLogService.log(contribution.chama, ActivityEventType.AUTO_STK_PUSH_SENT,
            "Auto STK push sent to " + contribution.member.fullName + " for their " + contribution.period + " contribution");
    }
}
