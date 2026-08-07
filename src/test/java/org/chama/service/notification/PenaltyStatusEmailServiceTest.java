package org.chama.service.notification;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * buildHtml is a plain function of its arguments, no CDI/mailer needed to exercise it directly,
 * same rationale as ChamaInvitationEmailServiceTest. The full send() path is covered indirectly
 * by PenaltyResourceTest exercising the real approve/waive endpoints.
 */
class PenaltyStatusEmailServiceTest {

    private final PenaltyStatusEmailService service = new PenaltyStatusEmailService();

    @Test
    void buildHtmlEscapesUserSuppliedValues() {
        String html = service.buildHtml("<script>alert(1)</script> Jane",
            "A penalty was issued against you at <strong>\"onmouseover=alert(1) Chama</strong>.",
            "<div>Reason: late</div>", "Footer note.", "#B84B2E");

        assertTrue(html.contains("&lt;script&gt;alert(1)&lt;/script&gt;"));
        assertFalse(html.contains("<script>"));
    }

    @Test
    void buildHtmlIncludesContentVerbatim() {
        String html = service.buildHtml("Jane Doe", "Intro sentence.", "<div>Amount: KES 200</div>",
            "Footer note.", "#1B4D45");

        assertTrue(html.contains("Intro sentence."));
        assertTrue(html.contains("<div>Amount: KES 200</div>"));
        assertTrue(html.contains("Footer note."));
        assertTrue(html.contains("#1B4D45"));
    }

    @Test
    void fallsBackToThereWhenNameIsBlank() {
        String html = service.buildHtml("   ", "Intro.", "", "Footer.", "#B84B2E");
        assertTrue(html.contains("Hi there,"));
    }
}
