package org.chama.service.notification;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * buildHtml is a plain function of its arguments, no CDI/mailer needed to exercise it directly,
 * same rationale as ChamaInvitationEmailServiceTest. The full send() path (including the
 * one-per-recipient fan-out) is covered indirectly by MeetingResourceTest exercising the real
 * create/minutes endpoints.
 */
class MeetingNotificationEmailServiceTest {

    private final MeetingNotificationEmailService service = new MeetingNotificationEmailService();

    @Test
    void buildHtmlEscapesUserSuppliedValues() {
        String html = service.buildHtml("<script>alert(1)</script> Jane",
            "A new meeting has been scheduled for <strong>\"onmouseover=alert(1) Chama</strong>.",
            "<div>Agenda: &lt;escaped already by caller&gt;</div>");

        assertTrue(html.contains("&lt;script&gt;alert(1)&lt;/script&gt;"));
        assertFalse(html.contains("<script>"));
    }

    @Test
    void buildHtmlIncludesContentVerbatim() {
        String html = service.buildHtml("Jane Doe", "Intro sentence.", "<div>Date: 5 Mar 2026</div>");

        assertTrue(html.contains("Intro sentence."));
        assertTrue(html.contains("<div>Date: 5 Mar 2026</div>"));
    }

    @Test
    void fallsBackToThereWhenNameIsBlank() {
        String html = service.buildHtml("", "Intro.", "");
        assertTrue(html.contains("Hi there,"));
    }
}
