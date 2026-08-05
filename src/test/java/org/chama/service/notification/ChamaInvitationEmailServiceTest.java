package org.chama.service.notification;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * buildHtml is a plain function of its arguments (frontendUrl aside), no CDI/mailer needed to
 * exercise it directly, same rationale as MemberInvitationEmailServiceTest. The full send() path
 * is covered by ChamaResourceTest's join-code invite tests through the real endpoint.
 */
class ChamaInvitationEmailServiceTest {

    @Test
    void buildHtmlEscapesTheChamaNameAndJoinCodeSoTheyCannotInjectMarkup() {
        ChamaInvitationEmailService service = new ChamaInvitationEmailService();
        service.frontendUrl = "http://localhost:5173";

        String html = service.buildHtml("<script>alert(1)</script> Chama", "\"><img src=x onerror=alert(1)>");

        assertTrue(html.contains("&lt;script&gt;alert(1)&lt;/script&gt;"));
        assertTrue(html.contains("&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"));
        assertTrue(html.indexOf("<script>") < 0);
        assertTrue(html.indexOf("<img") < 0);
    }
}
