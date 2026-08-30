package org.chama.service.notification;

import io.quarkus.mailer.Mail;
import io.quarkus.mailer.Mailer;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.chama.domain.enums.ReminderKind;
import org.chama.service.KeycloakAdminService;
import org.eclipse.microprofile.context.ManagedExecutor;
import org.eclipse.microprofile.context.ThreadContext;
import org.jboss.logging.Logger;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * Emails a member that a contribution is coming up, due today, or overdue.
 *
 * <p>Only ever sent for a reminder the caller has already claimed in reminder_dispatch, so this
 * class does no deduplication of its own. Same off-request-thread, plain-values-not-entities
 * convention as PaymentReceiptEmailService, see its class comment.
 */
@ApplicationScoped
public class ContributionReminderEmailService {

    private static final Logger LOG = Logger.getLogger(ContributionReminderEmailService.class);
    private static final DateTimeFormatter BILLING_PERIOD_FORMAT = DateTimeFormatter.ofPattern("MMMM yyyy");

    private static final ManagedExecutor MAIL_EXECUTOR = ManagedExecutor.builder()
        .propagated(ThreadContext.NONE)
        .cleared(ThreadContext.ALL_REMAINING)
        .build();

    @Inject
    Mailer mailer;

    @Inject
    KeycloakAdminService keycloakAdminService;

    public void sendReminder(String keycloakUserId, String memberFullName, String chamaName, String currency,
                             BigDecimal outstanding, LocalDate period, ReminderKind kind) {
        String subject = HtmlEmailSupport.forSubject(subjectFor(kind, chamaName));
        String detail = detailRow("Chama", chamaName)
            + detailRow("Period", period.format(BILLING_PERIOD_FORMAT))
            + detailRow("Still outstanding", currency + " " + outstanding);
        send(keycloakUserId, subject,
            buildHtml(memberFullName, introFor(kind, chamaName, currency, outstanding, period), detail,
                "You can pay from the app. If you have already paid, no action is needed."));
    }

    static String subjectFor(ReminderKind kind, String chamaName) {
        return switch (kind) {
            case UPCOMING -> "Your contribution to " + chamaName + " is due soon";
            case DUE_TODAY -> "Your contribution to " + chamaName + " is due today";
            case OVERDUE -> "Your contribution to " + chamaName + " is overdue";
        };
    }

    /** Every interpolated value is escaped: chama names and member names are user supplied. */
    static String introFor(ReminderKind kind, String chamaName, String currency,
                                   BigDecimal outstanding, LocalDate period) {
        String chama = HtmlEmailSupport.escapeHtml(chamaName);
        String amount = HtmlEmailSupport.escapeHtml(currency + " " + outstanding);
        String due = HtmlEmailSupport.escapeHtml(period.format(BILLING_PERIOD_FORMAT));
        return switch (kind) {
            case UPCOMING -> "Your <strong>%s</strong> contribution of <strong>%s</strong> to <strong>%s</strong> is due shortly."
                .formatted(due, amount, chama);
            case DUE_TODAY -> "Your <strong>%s</strong> contribution of <strong>%s</strong> to <strong>%s</strong> is due today."
                .formatted(due, amount, chama);
            case OVERDUE -> "Your <strong>%s</strong> contribution of <strong>%s</strong> to <strong>%s</strong> is still outstanding."
                .formatted(due, amount, chama);
        };
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
                    LOG.debugf("No email on Keycloak account %s, skipping contribution reminder", keycloakUserId);
                    return;
                }
                mailer.send(Mail.withHtml(email, subject, html));
            } catch (Exception e) {
                LOG.warnf(e, "Failed to send contribution reminder for Keycloak account %s", keycloakUserId);
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
