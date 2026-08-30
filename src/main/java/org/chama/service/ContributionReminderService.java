package org.chama.service;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.chama.domain.ChamaTime;
import org.chama.domain.enums.NotificationEventFamily;
import org.chama.domain.enums.ReminderKind;
import org.chama.domain.model.ChamaReminderSettings;
import org.chama.domain.model.Contribution;
import org.chama.repository.ChamaReminderSettingsRepository;
import org.chama.repository.ContributionRepository;
import org.chama.repository.ReminderDispatchRepository;
import org.chama.service.notification.ContributionReminderEmailService;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Nudges members about contributions that are coming up, due today, or overdue (issue #60's
 * automation half).
 *
 * <p>Follows {@link ContributionAutoPushService}: an hourly sweep with
 * {@link Scheduled.ConcurrentExecution#SKIP}, Nairobi dates throughout, and one fresh transaction
 * per member so a single failure cannot mark the whole sweep rollback-only and undo every reminder
 * already sent in it.
 *
 * <p>It runs hourly but acts only in the chama's configured send hour, so a restart or a missed
 * tick self-heals on the next run instead of firing a batch of reminders at three in the morning.
 *
 * <p>Sending is claim-then-send. Each reminder first inserts its row in reminder_dispatch with
 * ON CONFLICT DO NOTHING and gives up if the insert did not take, so two instances sweeping the
 * same hour cannot both nudge the same member. A claim that is then followed by a failed send is
 * deliberately not retried: a duplicate nudge annoys a member who has done nothing wrong, whereas
 * a missed one is caught by the next rung of the ladder.
 */
@ApplicationScoped
public class ContributionReminderService {

    private static final Logger LOG = Logger.getLogger(ContributionReminderService.class);

    /** Same reasoning as ContributionService.ChamaTime.ZONE: a due date is a Nairobi calendar date. */

    @ConfigProperty(name = "contribution.reminders.enabled", defaultValue = "true")
    boolean remindersEnabled;

    @Inject
    ChamaReminderSettingsRepository settingsRepository;

    @Inject
    ContributionRepository contributionRepository;

    @Inject
    ReminderDispatchRepository reminderDispatchRepository;

    @Inject
    NotificationService notificationService;

    @Inject
    ContributionReminderEmailService reminderEmailService;

    @Inject
    ChamaService chamaService;

    /** Read-or-create, matching WelfareFundService.getOrCreate: no row until someone looks. */
    @Transactional
    public ChamaReminderSettings getOrCreate(Long chamaId) {
        return settingsRepository.findByChama(chamaId).orElseGet(() -> {
            ChamaReminderSettings settings = new ChamaReminderSettings();
            settings.chama = chamaService.get(chamaId);
            settingsRepository.persist(settings);
            return settings;
        });
    }

    @Transactional
    public ChamaReminderSettings update(Long chamaId, boolean enabled, int daysBeforeDue,
                                        int overdueEveryDays, int sendHour) {
        ChamaReminderSettings settings = getOrCreate(chamaId);
        settings.enabled = enabled;
        settings.daysBeforeDue = daysBeforeDue;
        settings.overdueEveryDays = overdueEveryDays;
        settings.sendHour = sendHour;
        return settings;
    }

    @Scheduled(every = "1h", identity = "contribution-reminders",
        concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void sendDueReminders() {
        if (!remindersEnabled) {
            return;
        }
        LocalDate today = LocalDate.now(ChamaTime.ZONE);
        int hour = LocalTime.now(ChamaTime.ZONE).getHour();

        List<Long> chamaIds = QuarkusTransaction.requiringNew().call(() ->
            settingsRepository.findEnabledForHour(hour).stream().map(s -> s.chama.id).toList());

        for (Long chamaId : chamaIds) {
            try {
                sweepChama(chamaId, today);
            } catch (RuntimeException e) {
                LOG.errorf(e, "[REMINDERS] Reminder sweep failed for chama %d", chamaId);
            }
        }
    }

    private void sweepChama(Long chamaId, LocalDate today) {
        record Due(Long contributionId, ReminderKind kind) {}

        List<Due> due = QuarkusTransaction.requiringNew().call(() -> {
            ChamaReminderSettings settings = settingsRepository.findByChama(chamaId).orElse(null);
            if (settings == null || !settings.enabled) {
                return List.<Due>of();
            }
            // One query for the whole chama, bounded by the furthest-ahead rung, rather than one
            // query per rung.
            LocalDate horizon = today.plusDays(settings.daysBeforeDue);
            return contributionRepository.findUnsettledByChamaUpTo(chamaId, horizon).stream()
                .map(c -> {
                    ReminderKind kind = kindFor(c.period, today, settings);
                    return kind == null ? null : new Due(c.id, kind);
                })
                .filter(java.util.Objects::nonNull)
                .toList();
        });

        for (Due row : due) {
            try {
                QuarkusTransaction.requiringNew().run(() -> sendOne(row.contributionId(), row.kind(), today));
            } catch (RuntimeException e) {
                LOG.errorf(e, "[REMINDERS] Reminder failed for contribution %d", row.contributionId());
            }
        }
    }

    /**
     * Which rung, if any, this contribution has reached today.
     *
     * <p>Overdue nudges land on an exact multiple of the configured interval rather than on
     * "anything past due", so a member two months behind is nudged weekly rather than daily. If a
     * sweep misses the day a rung falls on, that rung is skipped rather than caught up later,
     * which is the same trade the claim ledger makes: better a missed nudge than a repeated one.
     */
    static ReminderKind kindFor(LocalDate period, LocalDate today, ChamaReminderSettings settings) {
        long daysUntilDue = ChronoUnit.DAYS.between(today, period);
        if (daysUntilDue == settings.daysBeforeDue) {
            return ReminderKind.UPCOMING;
        }
        if (daysUntilDue == 0) {
            return ReminderKind.DUE_TODAY;
        }
        long daysOverdue = -daysUntilDue;
        if (daysOverdue > 0 && daysOverdue % settings.overdueEveryDays == 0) {
            return ReminderKind.OVERDUE;
        }
        return null;
    }

    private void sendOne(Long contributionId, ReminderKind kind, LocalDate today) {
        // The claim comes first. Everything after it is best effort, and a failure here leaves the
        // row claimed on purpose, see the class comment.
        if (!reminderDispatchRepository.claim(contributionId, kind, today)) {
            return;
        }
        Contribution contribution = contributionRepository.findById(contributionId);
        if (contribution == null) {
            return;
        }
        BigDecimal outstanding = contribution.amountDue.subtract(contribution.amountPaid);
        String title = titleFor(kind);
        String body = bodyFor(kind, contribution, outstanding);
        String userId = contribution.member.keycloakUserId;

        notificationService.record(userId, contribution.chama.id, NotificationEventFamily.REMINDER,
            title, body, "/chamas/" + contribution.chama.id + "/contributions");

        if (notificationService.emailEnabled(userId, NotificationEventFamily.REMINDER)) {
            reminderEmailService.sendReminder(userId, contribution.member.fullName,
                contribution.chama.name, contribution.chama.currency, outstanding,
                contribution.period, kind);
        }
    }

    private static String titleFor(ReminderKind kind) {
        return switch (kind) {
            case UPCOMING -> "Contribution due soon";
            case DUE_TODAY -> "Contribution due today";
            case OVERDUE -> "Contribution overdue";
        };
    }

    private static String bodyFor(ReminderKind kind, Contribution contribution, BigDecimal outstanding) {
        String amount = contribution.chama.currency + " " + outstanding;
        return switch (kind) {
            case UPCOMING -> "%s is due on %s for %s.".formatted(amount, contribution.period, contribution.chama.name);
            case DUE_TODAY -> "%s is due today for %s.".formatted(amount, contribution.chama.name);
            case OVERDUE -> "%s has been outstanding since %s for %s."
                .formatted(amount, contribution.period, contribution.chama.name);
        };
    }
}
