package org.chama.service.notification;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * buildHtml is a plain function of its arguments, no CDI/mailer needed to exercise it directly,
 * same rationale as ChamaInvitationEmailServiceTest. The full send() path is covered indirectly
 * by LoanResourceTest's approve/reject/disburse tests and LoanDisbursementServiceTest's callback
 * tests exercising the real endpoints/service methods.
 */
class LoanStatusEmailServiceTest {

    private final LoanStatusEmailService service = new LoanStatusEmailService();

    @Test
    void buildHtmlEscapesUserSuppliedValues() {
        String html = service.buildHtml(
            "<script>alert(1)</script> Jane",
            "Your loan with <strong>\"onmouseover=alert(1) Chama</strong> was approved.",
            "<div>plain detail block, already escaped by caller</div>",
            "Some footer note.",
            "#1B4D45");

        assertTrue(html.contains("&lt;script&gt;alert(1)&lt;/script&gt;"));
        assertFalse(html.contains("<script>"));
    }

    @Test
    void buildHtmlIncludesTheIntroDetailsAndFooterVerbatim() {
        String html = service.buildHtml("Jane Doe", "Intro sentence.", "<div>Principal: KES 5000</div>",
            "Footer note here.", "#B84B2E");

        assertTrue(html.contains("Intro sentence."));
        assertTrue(html.contains("<div>Principal: KES 5000</div>"));
        assertTrue(html.contains("Footer note here."));
        assertTrue(html.contains("#B84B2E"));
    }

    @Test
    void fallsBackToThereWhenNameIsBlank() {
        String html = service.buildHtml("", "Intro.", "", "Footer.", "#1B4D45");
        assertTrue(html.contains("Hi there,"));
    }
}
