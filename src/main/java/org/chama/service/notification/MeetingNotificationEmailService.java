package org.chama.service.notification;

import io.quarkus.mailer.Mail;
import io.quarkus.mailer.Mailer;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.chama.service.KeycloakAdminService;
import org.eclipse.microprofile.context.ManagedExecutor;
import org.eclipse.microprofile.context.ThreadContext;
import org.jboss.logging.Logger;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Emails every active member of a chama when a meeting is scheduled or its minutes are published
 * (AUDIT_PLAN.md suggestion: "Meeting scheduled/minutes published notifications"), so attendance
 * doesn't rely on someone relaying the agenda by hand. Unlike the other notification services in
 * this package, this is a broadcast: one send per recipient, each independently resolved and
 * failed/succeeded, so one member with a stale Keycloak account can't block delivery to everyone
 * else. Same off-request-thread, plain-values-not-entities convention as
 * PaymentReceiptEmailService, see its class comment.
 */
@ApplicationScoped
public class MeetingNotificationEmailService {

    private static final Logger LOG = Logger.getLogger(MeetingNotificationEmailService.class);
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("EEEE, d MMM yyyy");

    private static final ManagedExecutor MAIL_EXECUTOR = ManagedExecutor.builder()
        .propagated(ThreadContext.NONE)
        .cleared(ThreadContext.ALL_REMAINING)
        .build();

    @Inject
    Mailer mailer;

    @Inject
    KeycloakAdminService keycloakAdminService;

    public record Recipient(String keycloakUserId, String fullName) {}

    public void sendMeetingScheduled(List<Recipient> recipients, String chamaName, LocalDate meetingDate, String agenda) {
        String subject = HtmlEmailSupport.forSubject("New meeting scheduled for " + chamaName + ": " + meetingDate.format(DATE_FORMAT));
        String detail = detailRow("Date", meetingDate.format(DATE_FORMAT)) + detailRow("Agenda", agenda);
        for (Recipient recipient : recipients) {
            send(recipient, subject, buildHtml(recipient.fullName(),
                "A new meeting has been scheduled for <strong>%s</strong>.".formatted(HtmlEmailSupport.escapeHtml(chamaName)),
                detail));
        }
    }

    public void sendMinutesPublished(List<Recipient> recipients, String chamaName, LocalDate meetingDate) {
        String subject = HtmlEmailSupport.forSubject("Minutes published for " + chamaName + "'s " + meetingDate.format(DATE_FORMAT) + " meeting");
        String detail = detailRow("Meeting date", meetingDate.format(DATE_FORMAT));
        for (Recipient recipient : recipients) {
            send(recipient, subject, buildHtml(recipient.fullName(),
                "Minutes are now available for <strong>%s</strong>'s meeting.".formatted(HtmlEmailSupport.escapeHtml(chamaName)),
                detail + "<div>Sign in to Webchama to read the full minutes.</div>"));
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
                    LOG.debugf("No email on Keycloak account %s, skipping meeting notification", recipient.keycloakUserId());
                    return;
                }
                mailer.send(Mail.withHtml(email, subject, html));
            } catch (Exception e) {
                LOG.warnf(e, "Failed to send meeting notification email for Keycloak account %s", recipient.keycloakUserId());
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
