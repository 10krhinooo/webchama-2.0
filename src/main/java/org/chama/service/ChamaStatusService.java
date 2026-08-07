package org.chama.service;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.chama.domain.enums.ActivityEventType;
import org.chama.domain.enums.ChamaStatus;
import org.chama.domain.model.Chama;
import org.chama.repository.ChamaRepository;
import org.jboss.logging.Logger;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Derives {@link Chama#status} automatically instead of leaving it a dead field that always
 * defaults to ACTIVE and never changes (issue #179). A chama with no contribution paid in
 * {@link #INACTIVITY_WINDOW} flips to INACTIVE; one that resumes activity flips back to ACTIVE.
 * Purely a derived state, there is no manual chairperson toggle, matching the same sweep style as
 * {@link ContributionAutoPushService}: a broad repository query, then one fresh transaction per
 * row so a single failure never blocks the rest of the sweep.
 */
@ApplicationScoped
public class ChamaStatusService {

    private static final Logger LOG = Logger.getLogger(ChamaStatusService.class);

    private static final Duration INACTIVITY_WINDOW = Duration.ofDays(60);

    @Inject
    ChamaRepository chamaRepository;

    @Inject
    ActivityLogService activityLogService;

    @Scheduled(every = "24h", identity = "chama-status-sweep",
        concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void sweep() {
        Instant cutoff = Instant.now().minus(INACTIVITY_WINDOW);

        List<Long> staleIds = QuarkusTransaction.requiringNew().call(() ->
            chamaRepository.findStaleActive(cutoff).stream().map(c -> c.id).toList());
        for (Long chamaId : staleIds) {
            try {
                QuarkusTransaction.requiringNew().run(() -> markInactive(chamaId));
            } catch (RuntimeException e) {
                LOG.errorf(e, "[CHAMA-STATUS] Failed to mark chama %d inactive", chamaId);
            }
        }

        List<Long> reactivatableIds = QuarkusTransaction.requiringNew().call(() ->
            chamaRepository.findReactivatable(cutoff).stream().map(c -> c.id).toList());
        for (Long chamaId : reactivatableIds) {
            try {
                QuarkusTransaction.requiringNew().run(() -> reactivate(chamaId));
            } catch (RuntimeException e) {
                LOG.errorf(e, "[CHAMA-STATUS] Failed to reactivate chama %d", chamaId);
            }
        }
    }

    private void markInactive(Long chamaId) {
        Chama chama = chamaRepository.findById(chamaId);
        if (chama == null || chama.status != ChamaStatus.ACTIVE) {
            return;
        }
        chama.status = ChamaStatus.INACTIVE;
        activityLogService.log(chama, ActivityEventType.CHAMA_MARKED_INACTIVE,
            "Chama marked inactive: no contribution paid in the last " + INACTIVITY_WINDOW.toDays() + " days.");
    }

    private void reactivate(Long chamaId) {
        Chama chama = chamaRepository.findById(chamaId);
        if (chama == null || chama.status != ChamaStatus.INACTIVE) {
            return;
        }
        chama.status = ChamaStatus.ACTIVE;
        activityLogService.log(chama, ActivityEventType.CHAMA_REACTIVATED,
            "Chama reactivated: a contribution was paid after a period of inactivity.");
    }
}
