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
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * Emails a member when their opt-in scheduled auto-STK-push fails to even fire (Daraja rejects
 * the request, bad phone number, etc), so they know their contribution was not charged instead of
 * silently assuming it was because they opted in (AUDIT_PLAN.md observation, found while
 * reviewing this area for the "payment receipt on success" suggestion: the failure side of that
 * same flow had no notification either). Same off-request-thread, plain-values-not-entities
 * convention as PaymentReceiptEmailService, see its class comment.
 */
@ApplicationScoped
public class AutoPushFailedEmailService {

    private static final Logger LOG = Logger.getLogger(AutoPushFailedEmailService.class);
    private static final DateTimeFormatter BILLING_PERIOD_FORMAT = DateTimeFormatter.ofPattern("MMMM yyyy");

    private static final ManagedExecutor MAIL_EXECUTOR = ManagedExecutor.builder()
        .propagated(ThreadContext.NONE)
        .cleared(ThreadContext.ALL_REMAINING)
        .build();

    @Inject
    Mailer mailer;

    @Inject
    KeycloakAdminService keycloakAdminService;

    public void sendPushFailed(String keycloakUserId, String memberFullName, String chamaName, String currency,
                                BigDecimal amountDue, LocalDate period, String reason) {
        String subject = HtmlEmailSupport.forSubject(
            "Your automatic contribution payment to " + chamaName + " did not go through");
        String detail = detailRow("Chama", chamaName)
            + detailRow("Period", period.format(BILLING_PERIOD_FORMAT))
            + detailRow("Amount due", currency + " " + amountDue)
            + (reason == null || reason.isBlank() ? "" : detailRow("Reason", reason));
        send(keycloakUserId, subject, buildHtml(memberFullName,
            "Your scheduled automatic M-Pesa payment for your contribution to <strong>%s</strong> did not go through."
                .formatted(HtmlEmailSupport.escapeHtml(chamaName)),
            detail,
            "No money was charged. You can pay manually from the app, or wait for the next scheduled attempt."));
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
                    LOG.debugf("No email on Keycloak account %s, skipping auto-push-failed email", keycloakUserId);
                    return;
                }
                mailer.send(Mail.withHtml(email, subject, html));
            } catch (Exception e) {
                LOG.warnf(e, "Failed to send auto-push-failed email for Keycloak account %s", keycloakUserId);
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
                          <td style="background:#B84B2E;padding:20px 32px;">
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
