package org.chama.domain.enums;

/**
 * The kind of event a notification is about.
 *
 * Coarser than the individual emails on purpose: a member choosing to stop hearing about loans
 * should not have to switch off "loan approved", "loan rejected", "loan disbursed" and "loan
 * payout failed" separately. Preferences are expressed per family for that reason.
 */
public enum NotificationEventFamily {
    CONTRIBUTION,
    PAYMENT,
    LOAN,
    PAYOUT,
    PENALTY,
    MEETING,
    RESOLUTION,
    WELFARE,
    APPROVAL,
    DOCUMENT,
    MEMBERSHIP,
    REMINDER
}
