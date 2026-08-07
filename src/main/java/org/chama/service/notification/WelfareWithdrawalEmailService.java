package org.chama.service.notification;

import io.quarkus.mailer.Mail;
import io.quarkus.mailer.Mailer;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.chama.service.KeycloakAdminService;
import org.eclipse.microprofile.context.ManagedExecutor;
import org.eclipse.microprofile.context.ThreadContext;
import org.jboss.logging.Logger;

import java.math.BigDecimal;
import java.util.List;

/**
 * Emails every active member of a chama when money is disbursed from the welfare fund
 * (AUDIT_PLAN.md suggestion: "Welfare fund withdrawal notification email" — found while reviewing
 * this area, WelfareWithdrawal has no single beneficiary member in its data model, it's a general
 * disbursement from the shared pool, so this is a transparency broadcast, not a one-recipient
 * notification). Same one-send-per-recipient independence as MeetingNotificationEmailService, and
 * the same off-request-thread, plain-values-not-entities convention as PaymentReceiptEmailService,
 * see its class comment.
 */
@ApplicationScoped
public class WelfareWithdrawalEmailService {

    private static final Logger LOG = Logger.getLogger(WelfareWithdrawalEmailService.class);

    private static final ManagedExecutor MAIL_EXECUTOR = ManagedExecutor.builder()
        .propagated(ThreadContext.NONE)
        .cleared(ThreadContext.ALL_REMAINING)
        .build();

    @Inject
    Mailer mailer;

    @Inject
    KeycloakAdminService keycloakAdminService;

    public record Recipient(String keycloakUserId, String fullName) {}

    public void sendWithdrawn(List<Recipient> recipients, String chamaName, String currency, BigDecimal amount,
                               String reason, String disbursedByName) {
        String subject = HtmlEmailSupport.forSubject(
            "Welfare fund disbursement at " + chamaName + ": " + currency + " " + amount);
        String detail = detailRow("Amount", currency + " " + amount)
            + detailRow("Reason", reason)
            + detailRow("Disbursed by", disbursedByName);
        for (Recipient recipient : recipients) {
            send(recipient, subject, buildHtml(recipient.fullName(),
                "A withdrawal was made from <strong>%s</strong>'s welfare fund.".formatted(HtmlEmailSupport.escapeHtml(chamaName)),
                detail));
        }
    }

    private static String detailRow(String label, String value) {
        return "<div style=\"margin-bottom:8px;\"><strong style=\"color:#241E1A;\">" + label + ":</strong> "
            + HtmlEmailSupport.escapeHtml(value) + "</div>";
    }

    private void send(Recipient recipient, String subject, String html) {
        MAIL_EXECUTOR.runAsync(() -> {
            try {
                String email = keycloakAdminService.getUserEmail(recipient.keycloakUserId());
                if (email == null) {
                    LOG.debugf("No email on Keycloak account %s, skipping welfare withdrawal notification", recipient.keycloakUserId());
                    return;
                }
                mailer.send(Mail.withHtml(email, subject, html));
            } catch (Exception e) {
                LOG.warnf(e, "Failed to send welfare withdrawal email for Keycloak account %s", recipient.keycloakUserId());
            }
        });
    }

    String buildHtml(String memberFullName, String intro, String detailsBlock) {
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
                                   style="background:#ffffff;border:1px solid #DCEAE6;border-radius:6px;">
                              <tr><td style="padding:16px 20px;font-size:14px;color:#6E6759;">
                                %s
                              </td></tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </body>
            </html>
            """.formatted(HtmlEmailSupport.escapeHtml(firstName), intro, detailsBlock);
    }
}
