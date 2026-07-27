package org.chama.service.notification;

/**
 * Shared helpers for the hand-built HTML emails in this package. Every value interpolated into
 * one of these templates that did not originate in this codebase (a member's own name, a chama
 * name someone typed in, a Keycloak event's logged fields) must go through escapeHtml first, none
 * of the .formatted() calls that build these templates do any escaping on their own.
 */
final class HtmlEmailSupport {

    private HtmlEmailSupport() {
    }

    static String escapeHtml(String value) {
        if (value == null) {
            return "";
        }
        return value
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
            .replace("'", "&#39;");
    }

    /** Strips CR/LF from a value headed for a mail subject line, so it can't inject extra headers into the outgoing message. */
    static String forSubject(String value) {
        return value == null ? "" : value.replaceAll("[\\r\\n]", " ");
    }
}
