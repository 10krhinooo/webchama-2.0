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

/**
 * Emails a member when a penalty against them is issued (approved) or waived (AUDIT_PLAN.md
 * suggestion: "Penalty issued/waived notifications"), so a balance change doesn't show up
 * unexplained the next time they check the app. Same off-request-thread,
 * plain-values-not-entities convention as PaymentReceiptEmailService, see its class comment.
 */
@ApplicationScoped
public class PenaltyStatusEmailService {

    private static final Logger LOG = Logger.getLogger(PenaltyStatusEmailService.class);

    private static final ManagedExecutor MAIL_EXECUTOR = ManagedExecutor.builder()
        .propagated(ThreadContext.NONE)
        .cleared(ThreadContext.ALL_REMAINING)
        .build();

    @Inject
    Mailer mailer;

    @Inject
    KeycloakAdminService keycloakAdminService;

    public void sendIssued(String keycloakUserId, String memberFullName, String chamaName, String currency,
                            BigDecimal amount, String reason) {
        String subject = HtmlEmailSupport.forSubject("A penalty of " + currency + " " + amount + " was issued at " + chamaName);
        String detail = detailRow("Amount", currency + " " + amount) + detailRow("Reason", reason);
        send(keycloakUserId, subject, buildHtml(memberFullName,
            "A penalty was issued against you at <strong>%s</strong>.".formatted(HtmlEmailSupport.escapeHtml(chamaName)),
            detail,
            "This will be reflected in your balance. Reach out to your chairperson or treasurer if you have questions.",
            "#B84B2E"));
    }

    public void sendWaived(String keycloakUserId, String memberFullName, String chamaName, String currency,
                            BigDecimal amount, String waiverReason) {
        String subject = HtmlEmailSupport.forSubject("Your penalty of " + currency + " " + amount + " at " + chamaName + " was waived");
        String detail = detailRow("Amount waived", currency + " " + amount)
            + (waiverReason == null || waiverReason.isBlank() ? "" : detailRow("Reason", waiverReason));
        send(keycloakUserId, subject, buildHtml(memberFullName,
            "A penalty against you at <strong>%s</strong> has been waived.".formatted(HtmlEmailSupport.escapeHtml(chamaName)),
            detail,
            "No action needed on your part.",
            "#1B4D45"));
    }

    private static String detailRow(String label, String value) {
        return "<div style=\"margin-bottom:8px;\"><strong style=\"color:#241E1A;\">" + label + ":</strong> "
            + HtmlEmailSupport.escapeHtml(value) + "</div>";
    }

    private void send(String keycloakUserId, String subject, String html) {
        MAIL_EXECUTOR.runAsync(() -> {
            try {
                String email = keycloakAdminService.getUserEmail(keycloakUserId);
                if (email == null) {
                    LOG.debugf("No email on Keycloak account %s, skipping penalty status email", keycloakUserId);
                    return;
                }
                mailer.send(Mail.withHtml(email, subject, html));
            } catch (Exception e) {
                LOG.warnf(e, "Failed to send penalty status email for Keycloak account %s", keycloakUserId);
            }
        });
    }

    String buildHtml(String memberFullName, String intro, String detailsBlock, String footerNote, String headerColor) {
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
                          <td style="background:%s;padding:20px 32px;">
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
            """.formatted(headerColor, HtmlEmailSupport.escapeHtml(firstName), intro, detailsBlock, footerNote);
    }
}
