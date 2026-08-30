package org.chama.service.notification;

import io.quarkus.mailer.Mail;
import io.quarkus.mailer.Mailer;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.chama.domain.model.KeycloakSecurityEvent;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.util.List;
import java.util.Optional;

/**
 * Notifies platform owners by email when KeycloakSecurityEventSyncService ingests a suspicious
 * event, currently just the bruteForceProtected lockout signal (see
 * KeycloakSecurityEventSyncService.isSuspicious). app.security.alert-emails is optional, unset
 * means alerting is disabled (dev/test default), not an error.
 */
@ApplicationScoped
public class SecurityAlertEmailService {

    private static final Logger LOG = Logger.getLogger(SecurityAlertEmailService.class);

    // Same off-request-thread rationale as MemberInvitationEmailService: this runs off the
    // @Scheduled sync job's own thread already, but keeps SMTP latency off it regardless so a
    // slow mail server never delays the next poll tick.
    @Inject
    Mailer mailer;

    // Optional<String> rather than a plain String with an empty defaultValue: SmallRye Config's
    // built-in String converter treats an empty-string default as absent and rejects it at
    // startup ("considered to be null"), so Optional is the only idiomatic way to express a
    // MicroProfile Config property that is allowed to be genuinely unset.
    //
    // Static analysis flags Optional as a field type by default. That guidance is about domain
    // objects and does not apply to a MicroProfile Config injection point, where the type is what
    // communicates "may be genuinely unset" to the config layer. Replacing it with a String would
    // fail startup, so this is suppressed rather than fixed.
    @SuppressWarnings("OptionalUsedAsFieldOrParameterType")
    @ConfigProperty(name = "app.security.alert-emails")
    Optional<String> alertEmails;

    public void alertSuspiciousEvent(KeycloakSecurityEvent event) {
        List<String> recipients = alertEmails.map(raw -> raw.split(","))
            .map(List::of)
            .orElse(List.of())
            .stream()
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .toList();

        if (recipients.isEmpty()) {
            LOG.debugf("Suspicious security event %s ingested but app.security.alert-emails is unset, no alert sent", event.dedupeKey);
            return;
        }

        MailExecutor.INSTANCE.runAsync(() -> {
            try {
                Mail mail = new Mail()
                    .addTo(recipients.toArray(new String[0]))
                    .setSubject("Webchama security alert: " + HtmlEmailSupport.forSubject(nz(event.type)))
                    .setHtml(buildHtml(event));
                mailer.send(mail);
            } catch (Exception e) {
                LOG.warnf(e, "Failed to send security alert email for event %s", event.dedupeKey);
            }
        });
    }

    String buildHtml(KeycloakSecurityEvent event) {
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
                            <span style="color:#F7F0E4;font-size:20px;font-family:'Archivo',Helvetica,Arial,sans-serif;font-weight:700;letter-spacing:0.5px;">WEBCHAMA SECURITY ALERT</span>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:32px;color:#241E1A;">
                            <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">
                              A suspicious %s event was detected on the platform.
                            </p>
                            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0"
                                   style="background:#ffffff;border:1px solid #DCEAE6;border-radius:6px;">
                              <tr><td style="padding:16px 20px;font-size:14px;color:#6E6759;">
                                <div style="margin-bottom:8px;"><strong style="color:#241E1A;">Type:</strong> %s</div>
                                <div style="margin-bottom:8px;"><strong style="color:#241E1A;">Error:</strong> %s</div>
                                <div style="margin-bottom:8px;"><strong style="color:#241E1A;">User:</strong> %s</div>
                                <div style="margin-bottom:8px;"><strong style="color:#241E1A;">IP address:</strong> %s</div>
                                <div><strong style="color:#241E1A;">Time:</strong> %s</div>
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
            """.formatted(
                event.source,
                HtmlEmailSupport.escapeHtml(nz(event.type)),
                HtmlEmailSupport.escapeHtml(nz(event.error)),
                HtmlEmailSupport.escapeHtml(nz(event.keycloakUserId)),
                HtmlEmailSupport.escapeHtml(nz(event.ipAddress)),
                event.eventTime);
    }

    private static String nz(String value) {
        return value != null ? value : "unknown";
    }
}
