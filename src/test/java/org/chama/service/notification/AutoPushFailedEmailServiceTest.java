package org.chama.service.notification;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * buildHtml is a plain function of its arguments, no CDI/mailer needed to exercise it directly,
 * same rationale as ChamaInvitationEmailServiceTest. The full send() path is covered indirectly
 * by ContributionAutoPushServiceTest exercising the real sweep.
 */
class AutoPushFailedEmailServiceTest {

    private final AutoPushFailedEmailService service = new AutoPushFailedEmailService();

    @Test
    void buildHtmlEscapesUserSuppliedValues() {
        String html = service.buildHtml("<script>alert(1)</script> Jane",
            "Your scheduled automatic M-Pesa payment for your contribution to <strong>\"onmouseover=alert(1) Chama</strong> did not go through.",
            "<div>Reason: &lt;escaped by caller&gt;</div>", "Footer note.");

        assertTrue(html.contains("&lt;script&gt;alert(1)&lt;/script&gt;"));
        assertFalse(html.contains("<script>"));
    }

    @Test
    void buildHtmlIncludesContentVerbatim() {
        String html = service.buildHtml("Jane Doe", "Intro sentence.", "<div>Amount due: KES 500</div>", "Footer note.");

        assertTrue(html.contains("Intro sentence."));
        assertTrue(html.contains("<div>Amount due: KES 500</div>"));
        assertTrue(html.contains("Footer note."));
    }

    @Test
    void fallsBackToThereWhenNameIsBlank() {
        String html = service.buildHtml("", "Intro.", "", "Footer.");
        assertTrue(html.contains("Hi there,"));
    }
}
