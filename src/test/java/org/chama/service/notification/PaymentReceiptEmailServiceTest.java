package org.chama.service.notification;

import org.chama.domain.enums.PaymentMethod;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * buildContributionHtml/buildWelfareHtml are plain functions of their arguments, no CDI/mailer
 * needed to exercise them directly, same rationale as ChamaInvitationEmailServiceTest. The full
 * send() path (KeycloakAdminService email resolution + Mailer) is covered indirectly by
 * ContributionResourceTest/WelfareFundResourceTest exercising the real payment endpoints.
 */
class PaymentReceiptEmailServiceTest {

    private final PaymentReceiptEmailService service = new PaymentReceiptEmailService();

    @Test
    void contributionReceiptEscapesUserSuppliedValues() {
        String html = service.buildContributionHtml(
            "<script>alert(1)</script> Jane", "\"><img src=x onerror=alert(1)> Chama", "KE\"S",
            new BigDecimal("500"), new BigDecimal("1500"), new BigDecimal("1000"),
            LocalDate.of(2026, 3, 1), PaymentMethod.MPESA, Instant.parse("2026-03-05T10:15:00Z"));

        assertTrue(html.contains("&lt;script&gt;alert(1)&lt;/script&gt;"));
        assertTrue(html.contains("&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"));
        assertTrue(html.contains("KE&quot;S"));
        assertFalse(html.contains("<script>"));
        assertFalse(html.contains("<img"));
    }

    @Test
    void contributionReceiptShowsRemainingBalanceWhenNotFullyPaid() {
        String html = service.buildContributionHtml(
            "Jane Doe", "Tumaini Chama", "KES",
            new BigDecimal("500"), new BigDecimal("1500"), new BigDecimal("1000"),
            LocalDate.of(2026, 3, 1), PaymentMethod.MPESA, Instant.parse("2026-03-05T10:15:00Z"));

        assertTrue(html.contains("Remaining balance"));
        assertTrue(html.contains("KES 1000"));
        assertTrue(html.contains("M-Pesa"));
        assertTrue(html.contains("March 2026"));
        assertFalse(html.contains("fully paid"));
    }

    @Test
    void contributionReceiptAnnouncesFullyPaidWhenBalanceIsZero() {
        String html = service.buildContributionHtml(
            "Jane Doe", "Tumaini Chama", "KES",
            new BigDecimal("1500"), new BigDecimal("1500"), BigDecimal.ZERO,
            LocalDate.of(2026, 3, 1), PaymentMethod.CASH, Instant.parse("2026-03-05T10:15:00Z"));

        assertTrue(html.contains("fully paid"));
        assertFalse(html.contains("Remaining balance"));
        assertTrue(html.contains("Cash"));
    }

    @Test
    void welfareReceiptEscapesUserSuppliedValuesAndShowsAmount() {
        String html = service.buildWelfareHtml(
            "<b>Jane</b>", "\"onmouseover=alert(1) Chama", "KES",
            new BigDecimal("250"), PaymentMethod.BANK, Instant.parse("2026-03-05T10:15:00Z"));

        assertTrue(html.contains("&lt;b&gt;Jane&lt;/b&gt;"));
        assertTrue(html.contains("&quot;onmouseover=alert(1)"));
        assertFalse(html.contains("<b>Jane</b>"));
        assertTrue(html.contains("KES 250"));
        assertTrue(html.contains("Bank transfer"));
    }
}
