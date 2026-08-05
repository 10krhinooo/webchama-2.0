package org.chama.service.notification;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * buildHtml is a plain function of its arguments (frontendUrl aside), no CDI/mailer needed to
 * exercise it directly, unlike the full send() path which MemberResourceTest covers through the
 * real member-invite flow.
 */
class MemberInvitationEmailServiceTest {

    @Test
    void buildHtmlEscapesTheMemberNameAndEmailSoTheyCannotInjectMarkup() {
        MemberInvitationEmailService service = new MemberInvitationEmailService();
        service.frontendUrl = "http://localhost:5173";

        String html = service.buildHtml("<script>alert(1)</script> Jane", "\"><img src=x onerror=alert(1)>@example.com", "Temp1234!");

        assertTrue(html.contains("&lt;script&gt;alert(1)&lt;/script&gt;"));
        assertTrue(html.contains("&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"));
        assertTrue(html.indexOf("<script>") < 0);
        assertTrue(html.indexOf("<img") < 0);
    }
}
