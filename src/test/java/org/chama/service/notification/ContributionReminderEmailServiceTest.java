package org.chama.service.notification;

import org.chama.domain.enums.ReminderKind;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The message-building half is a plain function of its arguments, so it needs no CDI or mailer,
 * same rationale as AutoPushFailedEmailServiceTest. The send path is exercised indirectly by
 * ContributionReminderServiceTest running the real sweep.
 */
class ContributionReminderEmailServiceTest {

    private final ContributionReminderEmailService service = new ContributionReminderEmailService();
    private static final LocalDate PERIOD = LocalDate.of(2026, 5, 1);

    @Test
    void eachRungGetsItsOwnSubject() {
        String upcoming = ContributionReminderEmailService.subjectFor(ReminderKind.UPCOMING, "Umoja");
        String dueToday = ContributionReminderEmailService.subjectFor(ReminderKind.DUE_TODAY, "Umoja");
        String overdue = ContributionReminderEmailService.subjectFor(ReminderKind.OVERDUE, "Umoja");

        assertTrue(upcoming.contains("due soon"));
        assertTrue(dueToday.contains("due today"));
        assertTrue(overdue.contains("overdue"));
        // A member who gets all three should be able to tell them apart in an inbox list.
        assertFalse(upcoming.equals(dueToday) || dueToday.equals(overdue));
    }

    @Test
    void eachRungGetsItsOwnWording() {
        String upcoming = ContributionReminderEmailService.introFor(
            ReminderKind.UPCOMING, "Umoja", "KES", new BigDecimal("500"), PERIOD);
        String overdue = ContributionReminderEmailService.introFor(
            ReminderKind.OVERDUE, "Umoja", "KES", new BigDecimal("500"), PERIOD);

        assertTrue(upcoming.contains("due shortly"));
        assertTrue(overdue.contains("still outstanding"));
        assertTrue(upcoming.contains("May 2026"));
    }

    @Test
    void aChamaNameCannotInjectMarkupIntoTheMessage() {
        String intro = ContributionReminderEmailService.introFor(
            ReminderKind.DUE_TODAY, "<script>alert(1)</script>", "KES", new BigDecimal("500"), PERIOD);

        // Chama names are user supplied and land in an HTML email.
        assertTrue(intro.contains("&lt;script&gt;"));
        assertFalse(intro.contains("<script>"));
    }

    @Test
    void aChamaNameCannotInjectAHeaderIntoTheSubject() {
        // The same composition sendReminder performs: subjectFor builds the line, forSubject is
        // what strips the CR/LF a chama name could otherwise use to add a header of its own.
        String subject = HtmlEmailSupport.forSubject(ContributionReminderEmailService.subjectFor(
            ReminderKind.DUE_TODAY, "Umoja\r\nBcc: attacker@example.com"));

        assertFalse(subject.contains("\r"));
        assertFalse(subject.contains("\n"));
    }

    @Test
    void buildHtmlEscapesTheMemberName() {
        String html = service.buildHtml("<img src=x onerror=alert(1)> Jane", "Intro.", "<div>Detail</div>", "Footer.");

        assertTrue(html.contains("&lt;img"));
        assertFalse(html.contains("<img src=x"));
    }

    @Test
    void buildHtmlFallsBackToThereWhenNameIsBlank() {
        assertTrue(service.buildHtml("", "Intro.", "", "Footer.").contains("Hi there,"));
    }
}
