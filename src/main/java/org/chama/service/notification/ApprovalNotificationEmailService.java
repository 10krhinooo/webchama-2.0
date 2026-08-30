package org.chama.service.notification;

import io.quarkus.mailer.Mail;
import io.quarkus.mailer.Mailer;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.chama.service.KeycloakAdminService;
import org.jboss.logging.Logger;

import java.math.BigDecimal;
import java.util.List;

/**
 * Emails eligible signatories when a maker-checker dual sign-off request opens, and the requester
 * once it clears (AUDIT_PLAN.md suggestion: "Dual sign-off requested / cleared"), so a payout or
 * loan disbursement waiting on a second signature doesn't sit unnoticed until someone happens to
 * check the Approvals page. Any TREASURER/CHAIRPERSON in the chama can sign (ApprovalResource has
 * no fixed pair of named approvers), so "requested" is a broadcast to that whole eligible pool
 * minus the requester, same one-send-per-recipient independence as MeetingNotificationEmailService.
 */
@ApplicationScoped
public class ApprovalNotificationEmailService {

    private static final Logger LOG = Logger.getLogger(ApprovalNotificationEmailService.class);

    @Inject
    Mailer mailer;

    @Inject
    KeycloakAdminService keycloakAdminService;

    public record Recipient(String keycloakUserId, String fullName) {}

    public void sendRequested(List<Recipient> eligibleSigners, String requestedByName, String chamaName,
                               String currency, BigDecimal amount, String beneficiaryName, String reason) {
        String subject = HtmlEmailSupport.forSubject(
            "Sign-off needed: " + currency + " " + amount + " at " + chamaName);
        String detail = detailRow("Requested by", requestedByName)
            + detailRow("For", beneficiaryName)
            + detailRow("Amount", currency + " " + amount)
            + (reason == null || reason.isBlank() ? "" : detailRow("Reason", reason));
        for (Recipient recipient : eligibleSigners) {
            send(recipient, subject, buildHtml(recipient.fullName(),
                "A dual sign-off is waiting on you at <strong>%s</strong>.".formatted(HtmlEmailSupport.escapeHtml(chamaName)),
                detail));
        }
    }

    public void sendCleared(String keycloakUserId, String requestedByName, String chamaName, String currency,
                             BigDecimal amount, String beneficiaryName) {
        String subject = HtmlEmailSupport.forSubject(
            "Sign-off cleared: " + currency + " " + amount + " at " + chamaName);
        String detail = detailRow("For", beneficiaryName) + detailRow("Amount", currency + " " + amount);
        send(new Recipient(keycloakUserId, requestedByName), subject, buildHtml(requestedByName,
            "Your dual sign-off request at <strong>%s</strong> has cleared.".formatted(HtmlEmailSupport.escapeHtml(chamaName)),
            detail + "<div>You can now proceed with the disbursement.</div>"));
    }

    private static String detailRow(String label, String value) {
        return "<div style=\"margin-bottom:8px;\"><strong style=\"color:#241E1A;\">" + label + ":</strong> "
            + HtmlEmailSupport.escapeHtml(value) + "</div>";
    }

    private void send(Recipient recipient, String subject, String html) {
        MailExecutor.INSTANCE.runAsync(() -> {
            try {
                String email = keycloakAdminService.getUserEmail(recipient.keycloakUserId());
                if (email == null) {
                    LOG.debugf("No email on Keycloak account %s, skipping approval notification", recipient.keycloakUserId());
                    return;
                }
                mailer.send(Mail.withHtml(email, subject, html));
            } catch (Exception e) {
                LOG.warnf(e, "Failed to send approval notification email for Keycloak account %s", recipient.keycloakUserId());
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
