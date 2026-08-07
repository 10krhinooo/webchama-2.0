package org.chama.service.notification;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * buildHtml is a plain function of its arguments, no CDI/mailer needed to exercise it directly,
 * same rationale as ChamaInvitationEmailServiceTest. The full send() path is covered indirectly
 * by PayoutResourceTest exercising the real endpoints.
 */
class PayoutStatusEmailServiceTest {

    private final PayoutStatusEmailService service = new PayoutStatusEmailService();

    @Test
    void buildHtmlEscapesUserSuppliedValues() {
        String html = service.buildHtml("<script>alert(1)</script> Jane",
            "It's your turn: your payout from <strong>\"onmouseover=alert(1) Chama</strong> has been scheduled.",
            "<div>Round: #3</div>", "Footer note.");

        assertTrue(html.contains("&lt;script&gt;alert(1)&lt;/script&gt;"));
        assertFalse(html.contains("<script>"));
    }

    @Test
    void buildHtmlIncludesContentVerbatim() {
        String html = service.buildHtml("Jane Doe", "Intro sentence.", "<div>Amount: KES 5000</div>", "Footer note.");

        assertTrue(html.contains("Intro sentence."));
        assertTrue(html.contains("<div>Amount: KES 5000</div>"));
        assertTrue(html.contains("Footer note."));
    }

    @Test
    void fallsBackToThereWhenNameIsBlank() {
        String html = service.buildHtml(null, "Intro.", "", "Footer.");
        assertTrue(html.contains("Hi there,"));
    }
}
