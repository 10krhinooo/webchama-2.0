package org.chama.service.notification;

import io.quarkus.mailer.Mail;
import io.quarkus.mailer.Mailer;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.chama.service.KeycloakAdminService;
import org.jboss.logging.Logger;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * Emails a member when their merry-go-round payout is scheduled or disbursed (AUDIT_PLAN.md
 * suggestion: "Payout scheduled/disbursed notifications"). Same off-request-thread,
 * plain-values-not-entities convention as PaymentReceiptEmailService, see its class comment.
 */
@ApplicationScoped
public class PayoutStatusEmailService {

    private static final Logger LOG = Logger.getLogger(PayoutStatusEmailService.class);
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("d MMM yyyy");

    @Inject
    Mailer mailer;

    @Inject
    KeycloakAdminService keycloakAdminService;

    public void sendScheduled(String keycloakUserId, String memberFullName, String chamaName, String currency,
                               int roundNumber, BigDecimal amount, LocalDate scheduledDate) {
        String subject = HtmlEmailSupport.forSubject("Your payout from " + chamaName + " is scheduled");
        String detail = detailRow("Round", "#" + roundNumber)
            + detailRow("Amount", currency + " " + amount)
            + detailRow("Scheduled date", scheduledDate.format(DATE_FORMAT));
        send(keycloakUserId, subject, buildHtml(memberFullName,
            "It's your turn: your payout from <strong>%s</strong> has been scheduled.".formatted(HtmlEmailSupport.escapeHtml(chamaName)),
            detail,
            "Your treasurer will disburse this to your M-Pesa number on or around the scheduled date."));
    }

    public void sendDisbursed(String keycloakUserId, String memberFullName, String chamaName, String currency,
                               int roundNumber, BigDecimal amount) {
        String subject = HtmlEmailSupport.forSubject("Your payout of " + currency + " " + amount + " has been disbursed");
        String detail = detailRow("Round", "#" + roundNumber) + detailRow("Amount", currency + " " + amount);
        send(keycloakUserId, subject, buildHtml(memberFullName,
            "Your payout from <strong>%s</strong> has been disbursed.".formatted(HtmlEmailSupport.escapeHtml(chamaName)),
            detail,
            "Check your M-Pesa messages to confirm receipt."));
    }

    private static String detailRow(String label, String value) {
        return "<div style=\"margin-bottom:8px;\"><strong style=\"color:#241E1A;\">" + label + ":</strong> "
            + HtmlEmailSupport.escapeHtml(value) + "</div>";
    }

    private void send(String keycloakUserId, String subject, String html) {
        MailExecutor.INSTANCE.runAsync(() -> {
            try {
                String email = keycloakAdminService.getUserEmail(keycloakUserId);
                if (email == null) {
                    LOG.debugf("No email on Keycloak account %s, skipping payout status email", keycloakUserId);
                    return;
                }
                mailer.send(Mail.withHtml(email, subject, html));
            } catch (Exception e) {
                LOG.warnf(e, "Failed to send payout status email for Keycloak account %s", keycloakUserId);
            }
        });
    }

    String buildHtml(String memberFullName, String intro, String detailsBlock, String footerNote) {
        String firstName = memberFullName == null || memberFullName.isBlank()
            ? "there" : memberFullName.trim().split("\\s+", 2)[0];
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
                            <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">%s</p>
                            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0"
                                   style="background:#ffffff;border:1px solid #DCEAE6;border-radius:6px;margin-bottom:16px;">
                              <tr><td style="padding:16px 20px;font-size:14px;color:#6E6759;">
                                %s
                              </td></tr>
                            </table>
                            <p style="margin:0;font-size:13px;color:#6E6759;">%s</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </body>
            </html>
            """.formatted(HtmlEmailSupport.escapeHtml(firstName), intro, detailsBlock, footerNote);
    }
}
