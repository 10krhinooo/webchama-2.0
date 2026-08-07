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
 * Emails a member when their loan's status changes: approved, rejected, disbursed, or a
 * disbursement attempt failed (AUDIT_PLAN.md suggestion: "Loan status emails: approved,
 * disbursed, or disbursement failed"). Same off-request-thread, plain-values-not-entities
 * convention as PaymentReceiptEmailService, see its class comment for why.
 */
@ApplicationScoped
public class LoanStatusEmailService {

    private static final Logger LOG = Logger.getLogger(LoanStatusEmailService.class);

    private static final ManagedExecutor MAIL_EXECUTOR = ManagedExecutor.builder()
        .propagated(ThreadContext.NONE)
        .cleared(ThreadContext.ALL_REMAINING)
        .build();

    @Inject
    Mailer mailer;

    @Inject
    KeycloakAdminService keycloakAdminService;

    public void sendApproved(String keycloakUserId, String memberFullName, String chamaName, String currency,
                              BigDecimal principal) {
        String subject = HtmlEmailSupport.forSubject("Your loan of " + currency + " " + principal + " was approved");
        send(keycloakUserId, subject, buildHtml(memberFullName,
            "Your loan request with <strong>%s</strong> was approved.".formatted(HtmlEmailSupport.escapeHtml(chamaName)),
            detailRow("Principal", currency + " " + principal),
            "It will be disbursed to your registered M-Pesa number once your treasurer initiates the payout.",
            "#1B4D45"));
    }

    public void sendRejected(String keycloakUserId, String memberFullName, String chamaName, String currency,
                              BigDecimal principal) {
        String subject = HtmlEmailSupport.forSubject("Your loan request with " + chamaName + " was not approved");
        send(keycloakUserId, subject, buildHtml(memberFullName,
            "Your loan request with <strong>%s</strong> was not approved this time.".formatted(HtmlEmailSupport.escapeHtml(chamaName)),
            detailRow("Requested amount", currency + " " + principal),
            "Reach out to your chama's chairperson or treasurer if you'd like to understand why, or to discuss reapplying.",
            "#B84B2E"));
    }

    public void sendDisbursed(String keycloakUserId, String memberFullName, String chamaName, String currency,
                               BigDecimal amount) {
        String subject = HtmlEmailSupport.forSubject("Your loan of " + currency + " " + amount + " has been disbursed");
        send(keycloakUserId, subject, buildHtml(memberFullName,
            "Your loan from <strong>%s</strong> has been disbursed to your M-Pesa number.".formatted(HtmlEmailSupport.escapeHtml(chamaName)),
            detailRow("Amount disbursed", currency + " " + amount),
            "Check your M-Pesa messages to confirm receipt. Your repayment schedule is available in the app.",
            "#1B4D45"));
    }

    public void sendDisbursementFailed(String keycloakUserId, String memberFullName, String chamaName,
                                        String currency, BigDecimal amount, String reason) {
        String subject = HtmlEmailSupport.forSubject("Your loan disbursement from " + chamaName + " did not go through");
        String reasonLine = reason == null || reason.isBlank()
            ? ""
            : detailRow("Reason", reason);
        send(keycloakUserId, subject, buildHtml(memberFullName,
            "An attempt to disburse your loan from <strong>%s</strong> did not go through.".formatted(HtmlEmailSupport.escapeHtml(chamaName)),
            detailRow("Amount", currency + " " + amount) + reasonLine,
            "No money has moved. Your treasurer has been notified and can retry the disbursement.",
            "#B84B2E"));
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
                    LOG.debugf("No email on Keycloak account %s, skipping loan status email", keycloakUserId);
                    return;
                }
                mailer.send(Mail.withHtml(email, subject, html));
            } catch (Exception e) {
                LOG.warnf(e, "Failed to send loan status email for Keycloak account %s", keycloakUserId);
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
