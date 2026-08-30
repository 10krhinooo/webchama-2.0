package org.chama.service.notification;

import io.quarkus.mailer.Mail;
import io.quarkus.mailer.Mailer;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.chama.domain.enums.PaymentMethod;
import org.chama.service.KeycloakAdminService;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * Emails a receipt the moment a contribution or welfare payment clears, regardless of channel
 * (M-Pesa/card via PaymentService.markSuccess, or cash/bank recorded by staff), so a member gets
 * automatic confirmation their money landed instead of having to log in and check, or wait for
 * staff to manually generate a PDF via DocumentGenerationService (audit AUDIT_PLAN.md suggestion:
 * "Contribution/welfare payment receipt on success"). Callers pass plain values, not entities:
 * this runs off the request thread with its context cleared, so anything it touches must already
 * be resolved by the caller while the owning transaction is still open.
 */
@ApplicationScoped
public class PaymentReceiptEmailService {

    private static final Logger LOG = Logger.getLogger(PaymentReceiptEmailService.class);
    private static final DateTimeFormatter BILLING_PERIOD_FORMAT = DateTimeFormatter.ofPattern("MMMM yyyy");
    private static final DateTimeFormatter PAID_AT_FORMAT = DateTimeFormatter.ofPattern("d MMM yyyy, h:mm a")
        .withZone(java.time.ZoneId.of("Africa/Nairobi"));

    // Same off-request-thread rationale as MemberInvitationEmailService: a slow/unreachable SMTP
    // server must never hold up a payment-recording response, and delivery failure is logged
    // rather than propagated, the member can still see their payment reflected on the contribution
    // page even if the email never arrives.
    @Inject
    Mailer mailer;

    @Inject
    KeycloakAdminService keycloakAdminService;

    @ConfigProperty(name = "app.frontend.url", defaultValue = "http://localhost:5173")
    String frontendUrl;

    public void sendContributionReceipt(String keycloakUserId, String memberFullName, String chamaName,
                                         String currency, BigDecimal amountPaid, BigDecimal amountDue,
                                         BigDecimal remainingBalance, LocalDate period, PaymentMethod method,
                                         Instant paidAt) {
        String subject = HtmlEmailSupport.forSubject("Payment received: " + currency + " " + amountPaid + " to " + chamaName);
        String html = buildContributionHtml(memberFullName, chamaName, currency, amountPaid, amountDue,
            remainingBalance, period, method, paidAt);
        send(keycloakUserId, subject, html);
    }

    public void sendWelfareReceipt(String keycloakUserId, String memberFullName, String chamaName,
                                    String currency, BigDecimal amount, PaymentMethod method, Instant paidAt) {
        String subject = HtmlEmailSupport.forSubject("Welfare fund contribution received: " + currency + " " + amount);
        String html = buildWelfareHtml(memberFullName, chamaName, currency, amount, method, paidAt);
        send(keycloakUserId, subject, html);
    }

    private void send(String keycloakUserId, String subject, String html) {
        MailExecutor.INSTANCE.runAsync(() -> {
            try {
                String email = keycloakAdminService.getUserEmail(keycloakUserId);
                if (email == null) {
                    LOG.debugf("No email on Keycloak account %s, skipping payment receipt", keycloakUserId);
                    return;
                }
                mailer.send(Mail.withHtml(email, subject, html));
            } catch (Exception e) {
                LOG.warnf(e, "Failed to send payment receipt email for Keycloak account %s", keycloakUserId);
            }
        });
    }

    String buildContributionHtml(String memberFullName, String chamaName, String currency,
                                          BigDecimal amountPaid, BigDecimal amountDue, BigDecimal remainingBalance,
                                          LocalDate period, PaymentMethod method, Instant paidAt) {
        String firstName = firstNameOf(memberFullName);
        String safeCurrency = HtmlEmailSupport.escapeHtml(currency);
        String balanceLine = remainingBalance.compareTo(BigDecimal.ZERO) > 0
            ? "<div style=\"margin-bottom:8px;\"><strong style=\"color:#241E1A;\">Remaining balance:</strong> "
                + safeCurrency + " " + remainingBalance + "</div>"
            : "<div style=\"margin-bottom:8px;color:#1B4D45;\"><strong>This contribution is now fully paid.</strong></div>";

        return """
            <!doctype html>
            <html>
              <body style="margin:0;padding:0;background:#EDE1CC;font-family:'Public Sans',Helvetica,Arial,sans-serif;">
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#EDE1CC;padding:24px 0;">
                  <tr>
                    <td align="center">
                      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#F7F0E4;border-radius:8px;overflow:hidden;">
                        <tr>
                          <td style="background:#1B4D45;padding:20px 32px;">
                            <span style="color:#F7F0E4;font-size:20px;font-family:'Archivo',Helvetica,Arial,sans-serif;font-weight:700;letter-spacing:0.5px;">WEBCHAMA</span>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:32px;color:#241E1A;">
                            <p style="margin:0 0 16px;font-size:16px;">Hi %s,</p>
                            <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">
                              Your contribution payment to <strong>%s</strong> was received.
                            </p>
                            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0"
                                   style="background:#ffffff;border:1px solid #DCEAE6;border-radius:6px;margin-bottom:16px;">
                              <tr><td style="padding:16px 20px;font-size:14px;color:#6E6759;">
                                <div style="margin-bottom:8px;"><strong style="color:#241E1A;">Amount paid:</strong> %s %s</div>
                                <div style="margin-bottom:8px;"><strong style="color:#241E1A;">Period:</strong> %s</div>
                                <div style="margin-bottom:8px;"><strong style="color:#241E1A;">Method:</strong> %s</div>
                                <div style="margin-bottom:8px;"><strong style="color:#241E1A;">Paid at:</strong> %s</div>
                                %s
                              </td></tr>
                            </table>
                            <p style="margin:0;font-size:13px;color:#6E6759;">
                              Keep this email for your records.
                            </p>
                          </td>
                        </tr>
                        <tr>
                          <td style="background:#1B4D45;padding:16px 32px;">
                            <span style="color:rgba(247,240,228,0.6);font-size:12px;">
                              You are receiving this because you are a member of %s on Webchama.
                            </span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </body>
            </html>
            """.formatted(
                HtmlEmailSupport.escapeHtml(firstName),
                HtmlEmailSupport.escapeHtml(chamaName),
                safeCurrency, amountPaid,
                period.format(BILLING_PERIOD_FORMAT),
                methodLabel(method),
                PAID_AT_FORMAT.format(paidAt),
                balanceLine,
                HtmlEmailSupport.escapeHtml(chamaName));
    }

    String buildWelfareHtml(String memberFullName, String chamaName, String currency, BigDecimal amount,
                                     PaymentMethod method, Instant paidAt) {
        String firstName = firstNameOf(memberFullName);
        return """
            <!doctype html>
            <html>
              <body style="margin:0;padding:0;background:#EDE1CC;font-family:'Public Sans',Helvetica,Arial,sans-serif;">
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#EDE1CC;padding:24px 0;">
                  <tr>
                    <td align="center">
                      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#F7F0E4;border-radius:8px;overflow:hidden;">
                        <tr>
                          <td style="background:#1B4D45;padding:20px 32px;">
                            <span style="color:#F7F0E4;font-size:20px;font-family:'Archivo',Helvetica,Arial,sans-serif;font-weight:700;letter-spacing:0.5px;">WEBCHAMA</span>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:32px;color:#241E1A;">
                            <p style="margin:0 0 16px;font-size:16px;">Hi %s,</p>
                            <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">
                              Your welfare fund contribution to <strong>%s</strong> was received. Thank you for
                              keeping the fund ready for whoever needs it next.
                            </p>
                            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0"
                                   style="background:#ffffff;border:1px solid #DCEAE6;border-radius:6px;margin-bottom:16px;">
                              <tr><td style="padding:16px 20px;font-size:14px;color:#6E6759;">
                                <div style="margin-bottom:8px;"><strong style="color:#241E1A;">Amount:</strong> %s %s</div>
                                <div style="margin-bottom:8px;"><strong style="color:#241E1A;">Method:</strong> %s</div>
                                <div><strong style="color:#241E1A;">Paid at:</strong> %s</div>
                              </td></tr>
                            </table>
                            <p style="margin:0;font-size:13px;color:#6E6759;">
                              Keep this email for your records.
                            </p>
                          </td>
                        </tr>
                        <tr>
                          <td style="background:#1B4D45;padding:16px 32px;">
                            <span style="color:rgba(247,240,228,0.6);font-size:12px;">
                              You are receiving this because you are a member of %s on Webchama.
                            </span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </body>
            </html>
            """.formatted(
                HtmlEmailSupport.escapeHtml(firstName),
                HtmlEmailSupport.escapeHtml(chamaName),
                HtmlEmailSupport.escapeHtml(currency), amount,
                methodLabel(method),
                PAID_AT_FORMAT.format(paidAt),
                HtmlEmailSupport.escapeHtml(chamaName));
    }

    private static String firstNameOf(String fullName) {
        return fullName == null || fullName.isBlank() ? "there" : fullName.trim().split("\\s+", 2)[0];
    }

    private static String methodLabel(PaymentMethod method) {
        return switch (method) {
            case MPESA -> "M-Pesa";
            case CARD -> "Card";
            case CASH -> "Cash";
            case BANK -> "Bank transfer";
        };
    }
}
