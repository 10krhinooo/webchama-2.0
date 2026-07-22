package org.chama.service.notification;

import io.quarkus.mailer.Mail;
import io.quarkus.mailer.Mailer;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Sends the one-time credential email when a member's account is first
 * provisioned (see MemberService.create). Delivery failure is swallowed and
 * logged rather than propagated, the chairperson can still see and share the
 * temporary password from the invite response if the email never arrives.
 */
@ApplicationScoped
public class MemberInvitationEmailService {

    private static final Logger LOG = Logger.getLogger(MemberInvitationEmailService.class);

    @Inject
    Mailer mailer;

    @ConfigProperty(name = "app.frontend.url", defaultValue = "http://localhost:5173")
    String frontendUrl;

    public void sendCredentials(String toEmail, String fullName, String temporaryPassword) {
        try {
            mailer.send(Mail.withHtml(toEmail, "Your Webchama account is ready", buildHtml(fullName, toEmail, temporaryPassword)));
        } catch (Exception e) {
            LOG.warnf(e, "Failed to send invite credentials email to %s", toEmail);
        }
    }

    String buildHtml(String fullName, String email, String temporaryPassword) {
        String firstName = fullName == null || fullName.isBlank() ? "there" : fullName.trim().split("\\s+", 2)[0];
        return """
            <!doctype html>
            <html>
              <body style="margin:0;padding:0;background:#f2f2f2;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;padding:24px 0;">
                  <tr>
                    <td align="center">
                      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
                        <tr>
                          <td style="background:#212529;padding:20px 32px;">
                            <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px;">WEBCHAMA</span>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:32px;color:#212529;">
                            <p style="margin:0 0 16px;font-size:16px;">Hi %s,</p>
                            <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">
                              You have been added as a member on Webchama. Use the credentials below to sign in,
                              you will be asked to set your own password on first login.
                            </p>
                            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0"
                                   style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:6px;margin-bottom:24px;">
                              <tr>
                                <td style="padding:16px 20px;font-size:14px;color:#495057;">
                                  <div style="margin-bottom:8px;"><strong>Email:</strong> %s</div>
                                  <div><strong>Temporary password:</strong>
                                    <span style="font-family:'Courier New',monospace;background:#ffffff;border:1px solid #dee2e6;border-radius:4px;padding:2px 8px;">%s</span>
                                  </div>
                                </td>
                              </tr>
                            </table>
                            <table role="presentation" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="border-radius:24px;background:#ce2329;">
                                  <a href="%s" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;
                                     font-weight:600;text-decoration:none;border-radius:24px;">Sign in to Webchama</a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td style="background:#212529;padding:16px 32px;">
                            <span style="color:rgba(255,255,255,0.5);font-size:12px;">
                              You are receiving this because a chairperson added you to a chama on Webchama.
                            </span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </body>
            </html>
            """.formatted(firstName, email, temporaryPassword, frontendUrl);
    }
}
