package org.chama.service.notification;

import io.quarkus.mailer.Mail;
import io.quarkus.mailer.Mailer;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.context.ManagedExecutor;
import org.eclipse.microprofile.context.ThreadContext;
import org.jboss.logging.Logger;

/**
 * Emails a chama's join code to someone the chairperson wants to recruit (issue #170), so they
 * don't have to relay the code by hand over WhatsApp/SMS. Unlike MemberInvitationEmailService,
 * this does not create any account or Member row, the recipient still has to redeem the code
 * themselves via POST /api/chamas/join once they are signed in. Runs off the request thread for
 * the same reason as MemberInvitationEmailService: a slow/unreachable SMTP server must not hold
 * up the chairperson's response, and delivery failure is logged rather than propagated since the
 * chairperson can always see and re-share the join code from the chama's own page.
 */
@ApplicationScoped
public class ChamaInvitationEmailService {

    private static final Logger LOG = Logger.getLogger(ChamaInvitationEmailService.class);

    private static final ManagedExecutor MAIL_EXECUTOR = ManagedExecutor.builder()
        .propagated(ThreadContext.NONE)
        .cleared(ThreadContext.ALL_REMAINING)
        .build();

    @Inject
    Mailer mailer;

    @ConfigProperty(name = "app.frontend.url", defaultValue = "http://localhost:5173")
    String frontendUrl;

    public void sendJoinInvite(String toEmail, String chamaName, String joinCode) {
        MAIL_EXECUTOR.runAsync(() -> {
            try {
                String subject = HtmlEmailSupport.forSubject("You're invited to join " + chamaName + " on Webchama");
                mailer.send(Mail.withHtml(toEmail, subject, buildHtml(chamaName, joinCode)));
            } catch (Exception e) {
                LOG.warnf(e, "Failed to send join invite email to %s", toEmail);
            }
        });
    }

    String buildHtml(String chamaName, String joinCode) {
        String safeChamaName = HtmlEmailSupport.escapeHtml(chamaName);
        String safeJoinCode = HtmlEmailSupport.escapeHtml(joinCode);
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
                            <p style="margin:0 0 16px;font-size:16px;">Hi there,</p>
                            <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">
                              You have been invited to join <strong>%s</strong> on Webchama. If you already
                              have a Webchama account, sign in and use the join code below. If not, create an
                              account first, then redeem the code from the same page.
                            </p>
                            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0"
                                   style="background:#ffffff;border:1px solid #DCEAE6;border-radius:6px;margin-bottom:24px;">
                              <tr>
                                <td style="padding:16px 20px;font-size:14px;color:#6E6759;text-align:center;">
                                  <div style="margin-bottom:8px;"><strong style="color:#241E1A;">Join code:</strong></div>
                                  <div style="font-family:'JetBrains Mono','Courier New',monospace;font-size:20px;letter-spacing:2px;background:#F7F0E4;border:1px solid #EDE1CC;border-radius:4px;padding:8px 16px;color:#241E1A;display:inline-block;">%s</div>
                                </td>
                              </tr>
                            </table>
                            <table role="presentation" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="border-radius:24px;background:#1B4D45;">
                                  <a href="%s" style="display:inline-block;padding:12px 28px;color:#F7F0E4;font-size:14px;
                                     font-family:'Archivo',Helvetica,Arial,sans-serif;font-weight:600;text-decoration:none;border-radius:24px;">Open Webchama</a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td style="background:#1B4D45;padding:16px 32px;">
                            <span style="color:rgba(247,240,228,0.6);font-size:12px;">
                              You are receiving this because a chairperson invited you to a chama on Webchama.
                            </span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </body>
            </html>
            """.formatted(safeChamaName, safeJoinCode, frontendUrl);
    }
}
