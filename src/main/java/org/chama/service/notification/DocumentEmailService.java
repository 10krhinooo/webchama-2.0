package org.chama.service.notification;

import io.quarkus.mailer.Mail;
import io.quarkus.mailer.Mailer;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.chama.domain.enums.DeliveryChannel;
import org.chama.domain.enums.DeliveryStatus;
import org.chama.domain.enums.DocumentType;
import org.chama.domain.model.DocumentDeliveryAttempt;
import org.chama.domain.model.GeneratedDocument;
import org.chama.repository.DocumentDeliveryAttemptRepository;
import org.chama.service.KeycloakAdminService;
import org.jboss.logging.Logger;

import java.time.Instant;

/**
 * Emails a generated statement/receipt (issue #38), the EMAIL half of the two delivery channels
 * GeneratedDocument/DocumentDeliveryAttempt were built for (issue #41), WhatsApp is issue #40.
 * Unlike MemberInvitationEmailService's credential email, a failure here is not swallowed: it is
 * recorded on the document (emailStatus/emailSentAt/emailError) and as its own
 * DocumentDeliveryAttempt row, so a treasurer can see and retry a failed delivery from the
 * document list rather than it silently vanishing into a log line.
 */
@ApplicationScoped
public class DocumentEmailService {

    private static final Logger LOG = Logger.getLogger(DocumentEmailService.class);

    @Inject
    Mailer mailer;

    @Inject
    KeycloakAdminService keycloakAdminService;

    @Inject
    DocumentDeliveryAttemptRepository documentDeliveryAttemptRepository;

    @Transactional
    public GeneratedDocument send(GeneratedDocument doc) {
        if (doc.memberEmail == null) {
            doc.memberEmail = resolveEmail(doc);
        }
        if (doc.memberEmail == null) {
            markResult(doc, DeliveryStatus.FAILED, "Member has no email address on their Keycloak account");
            return doc;
        }

        try {
            Mail mail = Mail.withHtml(doc.memberEmail, subjectFor(doc), buildHtml(doc));
            mail.addAttachment(doc.documentNumber + ".pdf", doc.pdfBytes, "application/pdf");
            mailer.send(mail);
            markResult(doc, DeliveryStatus.SENT, null);
        } catch (Exception e) {
            LOG.warnf(e, "Failed to email document %s to %s", doc.documentNumber, doc.memberEmail);
            markResult(doc, DeliveryStatus.FAILED, e.getMessage());
        }
        return doc;
    }

    private String resolveEmail(GeneratedDocument doc) {
        try {
            return keycloakAdminService.getUserEmail(doc.member.keycloakUserId);
        } catch (Exception e) {
            LOG.warnf(e, "Failed to resolve Keycloak email for member %d", doc.member.id);
            return null;
        }
    }

    private void markResult(GeneratedDocument doc, DeliveryStatus status, String error) {
        doc.emailStatus = status;
        doc.emailSentAt = Instant.now();
        doc.emailError = error;

        DocumentDeliveryAttempt attempt = new DocumentDeliveryAttempt();
        attempt.document = doc;
        attempt.channel = DeliveryChannel.EMAIL;
        attempt.status = status;
        attempt.errorDetail = error;
        documentDeliveryAttemptRepository.persist(attempt);
    }

    private String subjectFor(GeneratedDocument doc) {
        String chamaName = doc.chama.name;
        return switch (doc.documentType) {
            case CONTRIBUTION_RECEIPT -> "Your contribution receipt from " + chamaName;
            case LOAN_STATEMENT -> "Your loan statement from " + chamaName;
            case PAYOUT_RECEIPT -> "Your payout receipt from " + chamaName;
            case CUSTOM_INVOICE -> "Your invoice from " + chamaName;
            case CUSTOM_RECEIPT -> "Your receipt from " + chamaName;
            case AGM_STATEMENT -> "AGM/auditor annual financial statement from " + chamaName;
        };
    }

    private String documentLabel(DocumentType type) {
        return switch (type) {
            case CONTRIBUTION_RECEIPT -> "contribution receipt";
            case LOAN_STATEMENT -> "loan statement";
            case PAYOUT_RECEIPT -> "payout receipt";
            case CUSTOM_INVOICE -> "invoice";
            case CUSTOM_RECEIPT -> "receipt";
            case AGM_STATEMENT -> "AGM/auditor annual financial statement";
        };
    }

    private String buildHtml(GeneratedDocument doc) {
        String firstName = doc.memberName == null || doc.memberName.isBlank()
            ? "there" : doc.memberName.trim().split("\\s+", 2)[0];
        return """
            <!doctype html>
            <html>
              <body style="margin:0;padding:0;background:#F2EBD9;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#F2EBD9;padding:24px 0;">
                  <tr>
                    <td align="center">
                      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#FBF7EE;border-radius:8px;overflow:hidden;">
                        <tr>
                          <td style="background:#3D3A6B;padding:20px 32px;">
                            <span style="color:#FBF7EE;font-size:20px;font-weight:700;letter-spacing:0.5px;">WEBCHAMA</span>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:32px;color:#1C1A17;">
                            <p style="margin:0 0 16px;font-size:16px;">Hi %s,</p>
                            <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">
                              Attached is your %s from %s, document number <strong>%s</strong>.
                            </p>
                            <p style="margin:0;font-size:13px;color:#6E6759;">
                              Keep this for your records, it reflects the ledger at the time it was generated.
                            </p>
                          </td>
                        </tr>
                        <tr>
                          <td style="background:#3D3A6B;padding:16px 32px;">
                            <span style="color:rgba(251,247,238,0.6);font-size:12px;">
                              You are receiving this because you are a member of %s on Webchama.
                            </span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </body>
            </html>
            """.formatted(firstName, documentLabel(doc.documentType), doc.chama.name, doc.documentNumber, doc.chama.name);
    }
}
