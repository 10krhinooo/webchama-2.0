package org.chama.service;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.chama.domain.enums.ChamaStatus;
import org.chama.domain.enums.ChamaType;
import org.chama.domain.enums.ContributionFrequency;
import org.chama.domain.enums.ContributionStatus;
import org.chama.domain.enums.MemberStatus;
import org.chama.domain.enums.NotificationEventFamily;
import org.chama.domain.enums.ReminderKind;
import org.chama.domain.model.Chama;
import org.chama.domain.model.ChamaReminderSettings;
import org.chama.domain.model.Contribution;
import org.chama.domain.model.Member;
import org.chama.repository.ActivityLogRepository;
import org.chama.repository.ApprovalRepository;
import org.chama.repository.ChamaRepository;
import org.chama.repository.DocumentDeliveryAttemptRepository;
import org.chama.repository.GeneratedDocumentRepository;
import org.chama.repository.LoanDisbursementRepository;
import org.chama.repository.LoanRepaymentRepository;
import org.chama.repository.LoanRepository;
import org.chama.repository.MeetingAttendanceRepository;
import org.chama.repository.MeetingRepository;
import org.chama.repository.MemberRoleRepository;
import org.chama.repository.NotificationRepository;
import org.chama.repository.PaymentRepository;
import org.chama.repository.PayoutRepository;
import org.chama.repository.PayoutScheduleRepository;
import org.chama.repository.PenaltyRepository;
import org.chama.repository.WelfareContributionRepository;
import org.chama.repository.WelfareFundRepository;
import org.chama.repository.WelfareWithdrawalRepository;
import org.chama.repository.ChamaReminderSettingsRepository;
import org.chama.repository.ContributionRepository;
import org.chama.repository.MemberRepository;
import org.chama.repository.ReminderDispatchRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@QuarkusTest
class ContributionReminderServiceTest {

    @Inject
    ContributionReminderService reminderService;

    @Inject
    ChamaReminderSettingsRepository settingsRepository;

    @Inject
    ReminderDispatchRepository reminderDispatchRepository;

    @Inject
    ContributionRepository contributionRepository;

    @Inject
    ChamaRepository chamaRepository;

    @Inject
    MemberRepository memberRepository;

    @Inject
    MemberRoleRepository memberRoleRepository;

    @Inject
    ActivityLogRepository activityLogRepository;

    @Inject
    ApprovalRepository approvalRepository;

    @Inject
    DocumentDeliveryAttemptRepository documentDeliveryAttemptRepository;

    @Inject
    GeneratedDocumentRepository generatedDocumentRepository;

    @Inject
    LoanDisbursementRepository loanDisbursementRepository;

    @Inject
    LoanRepaymentRepository loanRepaymentRepository;

    @Inject
    LoanRepository loanRepository;

    @Inject
    MeetingAttendanceRepository meetingAttendanceRepository;

    @Inject
    MeetingRepository meetingRepository;

    @Inject
    PaymentRepository paymentRepository;

    @Inject
    PayoutRepository payoutRepository;

    @Inject
    PayoutScheduleRepository payoutScheduleRepository;

    @Inject
    PenaltyRepository penaltyRepository;

    @Inject
    WelfareContributionRepository welfareContributionRepository;

    @Inject
    WelfareFundRepository welfareFundRepository;

    @Inject
    WelfareWithdrawalRepository welfareWithdrawalRepository;

    @Inject
    NotificationRepository notificationRepository;

    private static final ZoneId NAIROBI = ZoneId.of("Africa/Nairobi");

    private Long chamaId;
    private Long memberId;
    private Long secondMemberId;

    @BeforeEach
    void seed() {
        QuarkusTransaction.requiringNew().run(() -> {
            // The full ordered cleanup every suite here carries. Deleting only this test's own
            // tables passes in isolation and fails in the suite, because rows another class left
            // behind still reference contribution and member.
            notificationRepository.deleteAll();
            reminderDispatchRepository.deleteAll();
            settingsRepository.deleteAll();
            documentDeliveryAttemptRepository.deleteAll();
            generatedDocumentRepository.deleteAll();
            meetingAttendanceRepository.deleteAll();
            meetingRepository.deleteAll();
            penaltyRepository.deleteAll();
            payoutRepository.deleteAll();
            payoutScheduleRepository.deleteAll();
            loanRepaymentRepository.deleteAll();
            loanDisbursementRepository.deleteAll();
            loanRepository.deleteAll();
            paymentRepository.deleteAll();
            contributionRepository.deleteAll();
            approvalRepository.deleteAll();
            welfareWithdrawalRepository.deleteAll();
            welfareContributionRepository.deleteAll();
            welfareFundRepository.deleteAll();
            memberRoleRepository.deleteAll();
            memberRepository.deleteAll();
            activityLogRepository.deleteAll();
            chamaRepository.deleteAll();

            Chama chama = new Chama();
            chama.name = "Reminder Test Chama";
            chama.type = ChamaType.TABLE_BANKING;
            chama.currency = "KES";
            chama.contributionFrequency = ContributionFrequency.MONTHLY;
            chama.contributionAmount = new BigDecimal("500");
            chama.status = ChamaStatus.ACTIVE;
            chamaRepository.persist(chama);
            chamaId = chama.id;

            Member member = new Member();
            member.chama = chama;
            member.keycloakUserId = "reminder-member-1";
            member.fullName = "Reminder Member";
            member.phone = "254700000601";
            member.status = MemberStatus.ACTIVE;
            memberRepository.persist(member);
            memberId = member.id;

            Member second = new Member();
            second.chama = chama;
            second.keycloakUserId = "reminder-member-2";
            second.fullName = "Second Member";
            second.phone = "254700000602";
            second.status = MemberStatus.ACTIVE;
            memberRepository.persist(second);
            secondMemberId = second.id;
        });
    }

    @Test
    void settingsAreCreatedOnFirstLookAndStartSwitchedOff() {
        var settings = reminderService.getOrCreate(chamaId);

        // Enabling this for every chama at once would mean members receive mail nobody asked for.
        assertFalse(settings.enabled);
        assertEquals(3, settings.daysBeforeDue);
        assertEquals(7, settings.overdueEveryDays);
        assertEquals(8, settings.sendHour);
    }

    @Test
    void lookingTwiceReusesTheSameRowRatherThanCreatingASecond() {
        Long first = reminderService.getOrCreate(chamaId).id;
        Long second = reminderService.getOrCreate(chamaId).id;

        assertEquals(first, second);
        assertEquals(1, settingsRepository.count());
    }

    @Test
    void updatingSettingsPersistsThem() {
        reminderService.update(chamaId, true, 5, 14, 17);

        var reloaded = reminderService.getOrCreate(chamaId);
        assertTrue(reloaded.enabled);
        assertEquals(5, reloaded.daysBeforeDue);
        assertEquals(14, reloaded.overdueEveryDays);
        assertEquals(17, reloaded.sendHour);
    }

    @Test
    void onlyChamasWantingRemindersInThisHourAreSwept() {
        reminderService.update(chamaId, true, 3, 7, 9);

        assertEquals(1, settingsRepository.findEnabledForHour(9).size());
        assertTrue(settingsRepository.findEnabledForHour(10).isEmpty());

        reminderService.update(chamaId, false, 3, 7, 9);
        assertTrue(settingsRepository.findEnabledForHour(9).isEmpty(), "a disabled chama must never be swept");
    }

    @Test
    void aContributionReachesTheUpcomingRungExactlyOnceOnItsLeadDay() {
        ChamaReminderSettings settings = settingsWith(3, 7);
        LocalDate today = LocalDate.of(2026, 5, 1);

        assertEquals(ReminderKind.UPCOMING, ContributionReminderService.kindFor(today.plusDays(3), today, settings));
        // Not on every day up to it, which would be a nudge a day for three days.
        assertNull(ContributionReminderService.kindFor(today.plusDays(2), today, settings));
        assertNull(ContributionReminderService.kindFor(today.plusDays(4), today, settings));
    }

    @Test
    void aContributionDueTodayReachesTheDueTodayRung() {
        ChamaReminderSettings settings = settingsWith(3, 7);
        LocalDate today = LocalDate.of(2026, 5, 1);

        assertEquals(ReminderKind.DUE_TODAY, ContributionReminderService.kindFor(today, today, settings));
    }

    @Test
    void overdueNudgesRepeatOnTheConfiguredIntervalRatherThanEveryDay() {
        ChamaReminderSettings settings = settingsWith(3, 7);
        LocalDate today = LocalDate.of(2026, 5, 29);

        assertEquals(ReminderKind.OVERDUE, ContributionReminderService.kindFor(today.minusDays(7), today, settings));
        assertEquals(ReminderKind.OVERDUE, ContributionReminderService.kindFor(today.minusDays(14), today, settings));
        // A member two months behind is nudged weekly, not daily.
        assertNull(ContributionReminderService.kindFor(today.minusDays(8), today, settings));
        assertNull(ContributionReminderService.kindFor(today.minusDays(1), today, settings));
    }

    @Test
    void aReminderCanOnlyBeClaimedOnce() {
        Long contributionId = persistContribution(LocalDate.now(), "500", "0");
        LocalDate today = LocalDate.now();

        assertTrue(claim(contributionId, ReminderKind.DUE_TODAY, today));
        // The second caller is told so by the row count rather than by a constraint violation,
        // which would mark the whole sweep transaction rollback-only.
        assertFalse(claim(contributionId, ReminderKind.DUE_TODAY, today));
        assertEquals(1, reminderDispatchRepository.countForContribution(contributionId));
    }

    @Test
    void differentRungsOnTheSameContributionDoNotSuppressEachOther() {
        Long contributionId = persistContribution(LocalDate.now(), "500", "0");
        LocalDate today = LocalDate.now();

        assertTrue(claim(contributionId, ReminderKind.UPCOMING, today.minusDays(3)));
        assertTrue(claim(contributionId, ReminderKind.DUE_TODAY, today));
        assertEquals(2, reminderDispatchRepository.countForContribution(contributionId));
    }

    @Test
    void repeatOverdueNudgesOnDifferentDaysAreDistinctClaims() {
        Long contributionId = persistContribution(LocalDate.now().minusDays(14), "500", "0");
        LocalDate today = LocalDate.now();

        assertTrue(claim(contributionId, ReminderKind.OVERDUE, today.minusDays(7)));
        assertTrue(claim(contributionId, ReminderKind.OVERDUE, today));
        assertEquals(2, reminderDispatchRepository.countForContribution(contributionId));
    }

    @Test
    void aPartlyPaidContributionIsStillWorthReminding() {
        persistContribution(LocalDate.now(), "500", "200");

        var unsettled = contributionRepository.findUnsettledByChamaUpTo(chamaId, LocalDate.now().plusDays(3));

        // Half paid still owes the other half, which is exactly who a reminder is for.
        assertEquals(1, unsettled.size());
        assertEquals(ContributionStatus.PARTIAL, unsettled.get(0).status);
    }

    @Test
    void aFullyPaidContributionIsNeverRemindedAbout() {
        persistContribution(LocalDate.now(), "500", "500");

        assertTrue(contributionRepository.findUnsettledByChamaUpTo(chamaId, LocalDate.now().plusDays(3)).isEmpty());
    }

    @Test
    void contributionsBeyondTheLeadHorizonAreNotYetLoaded() {
        persistContribution(LocalDate.now().plusDays(30), "500", "0");

        assertTrue(contributionRepository.findUnsettledByChamaUpTo(chamaId, LocalDate.now().plusDays(3)).isEmpty());
    }

    @Test
    void theSweepNudgesEveryRungAndClaimsEachExactlyOnce() {
        int hour = LocalTime.now(NAIROBI).getHour();
        reminderService.update(chamaId, true, 3, 7, hour);
        LocalDate today = LocalDate.now(NAIROBI);

        Long upcoming = persistContribution(today.plusDays(3), "500", "0");
        Long dueToday = persistContribution(today, "500", "0");
        Long overdue = persistContribution(today.minusDays(7), "500", "100");
        Long notYet = persistContribution(today.plusDays(1), "500", "0");
        // On a second member: contribution is unique per (member, period), and this one has to sit
        // on the same due date as dueToday for the comparison to mean anything.
        Long settled = persistContributionFor(secondMemberId, today, "500", "500");

        reminderService.sendDueReminders();

        assertEquals(1, reminderDispatchRepository.countForContribution(upcoming));
        assertEquals(1, reminderDispatchRepository.countForContribution(dueToday));
        assertEquals(1, reminderDispatchRepository.countForContribution(overdue));
        assertEquals(0, reminderDispatchRepository.countForContribution(notYet),
            "a contribution between rungs must not be nudged");
        assertEquals(0, reminderDispatchRepository.countForContribution(settled),
            "a fully paid contribution must never be nudged");

        // The claim ledger is what makes a second sweep in the same hour a no-op, which matters
        // because the scheduler fires hourly and two instances can overlap.
        reminderService.sendDueReminders();
        assertEquals(1, reminderDispatchRepository.countForContribution(dueToday));
    }

    @Test
    void theSweepWritesAnInAppNotificationForEachNudge() {
        int hour = LocalTime.now(NAIROBI).getHour();
        reminderService.update(chamaId, true, 3, 7, hour);
        persistContribution(LocalDate.now(NAIROBI), "500", "0");

        reminderService.sendDueReminders();

        var inbox = notificationRepository.findForUser("reminder-member-1", 0, 20);
        assertEquals(1, inbox.size());
        assertEquals(NotificationEventFamily.REMINDER, inbox.get(0).eventFamily);
        assertTrue(inbox.get(0).body.contains("500"), "the member needs to know what they owe");
    }

    @Test
    void theSweepSkipsAChamaThatHasNotOptedIn() {
        int hour = LocalTime.now(NAIROBI).getHour();
        reminderService.update(chamaId, false, 3, 7, hour);
        Long contributionId = persistContribution(LocalDate.now(NAIROBI), "500", "0");

        reminderService.sendDueReminders();

        assertEquals(0, reminderDispatchRepository.countForContribution(contributionId));
    }

    @Test
    void theSweepDoesNothingOutsideTheChamasChosenHour() {
        int otherHour = (LocalTime.now(NAIROBI).getHour() + 5) % 24;
        reminderService.update(chamaId, true, 3, 7, otherHour);
        Long contributionId = persistContribution(LocalDate.now(NAIROBI), "500", "0");

        reminderService.sendDueReminders();

        // Running hourly and acting in one hour is what lets a restart self-heal on the next tick
        // instead of firing a batch of reminders at whatever time the process came back up.
        assertEquals(0, reminderDispatchRepository.countForContribution(contributionId));
    }

    private boolean claim(Long contributionId, ReminderKind kind, LocalDate scheduledFor) {
        return QuarkusTransaction.requiringNew().call(() ->
            reminderDispatchRepository.claim(contributionId, kind, scheduledFor));
    }

    private ChamaReminderSettings settingsWith(int daysBeforeDue, int overdueEveryDays) {
        ChamaReminderSettings settings = new ChamaReminderSettings();
        settings.daysBeforeDue = daysBeforeDue;
        settings.overdueEveryDays = overdueEveryDays;
        return settings;
    }

    private Long persistContribution(LocalDate period, String due, String paid) {
        return persistContributionFor(memberId, period, due, paid);
    }

    private Long persistContributionFor(Long member, LocalDate period, String due, String paid) {
        return QuarkusTransaction.requiringNew().call(() -> {
            Contribution contribution = new Contribution();
            contribution.chama = chamaRepository.findById(chamaId);
            contribution.member = memberRepository.findById(member);
            contribution.period = period;
            contribution.amountDue = new BigDecimal(due);
            contribution.amountPaid = new BigDecimal(paid);
            contribution.status = contribution.amountPaid.signum() == 0
                ? ContributionStatus.PENDING
                : contribution.amountPaid.compareTo(contribution.amountDue) >= 0
                    ? ContributionStatus.PAID
                    : ContributionStatus.PARTIAL;
            contributionRepository.persist(contribution);
            return contribution.id;
        });
    }
}
