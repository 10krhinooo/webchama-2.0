package org.chama.service.notification;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * buildHtml is a plain function of its arguments, no CDI/mailer needed to exercise it directly,
 * same rationale as ChamaInvitationEmailServiceTest. The full send() path (including the
 * one-per-eligible-signer fan-out) is covered indirectly by ApprovalResourceTest exercising the
 * real request/approve endpoints.
 */
class ApprovalNotificationEmailServiceTest {

    private final ApprovalNotificationEmailService service = new ApprovalNotificationEmailService();

    @Test
    void buildHtmlEscapesUserSuppliedValues() {
        String html = service.buildHtml("<script>alert(1)</script> Jane",
            "A dual sign-off is waiting on you at <strong>\"onmouseover=alert(1) Chama</strong>.",
            "<div>Reason: &lt;escaped by caller&gt;</div>");

        assertTrue(html.contains("&lt;script&gt;alert(1)&lt;/script&gt;"));
        assertFalse(html.contains("<script>"));
    }

    @Test
    void buildHtmlIncludesContentVerbatim() {
        String html = service.buildHtml("Jane Doe", "Intro sentence.", "<div>Amount: KES 150000</div>");

        assertTrue(html.contains("Intro sentence."));
        assertTrue(html.contains("<div>Amount: KES 150000</div>"));
    }

    @Test
    void fallsBackToThereWhenNameIsBlank() {
        String html = service.buildHtml(null, "Intro.", "");
        assertTrue(html.contains("Hi there,"));
    }
}
