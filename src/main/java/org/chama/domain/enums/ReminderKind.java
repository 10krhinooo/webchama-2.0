package org.chama.domain.enums;

/**
 * Which rung of the reminder ladder a dispatch was.
 *
 * <p>Part of the uniqueness key on reminder_dispatch, so a member can receive the upcoming nudge
 * and the due-date nudge for the same contribution without either suppressing the other.
 */
public enum ReminderKind {
    /** Some days before the due date, configurable per chama. */
    UPCOMING,
    /** On the due date itself. */
    DUE_TODAY,
    /** Repeating after the due date has passed, at the chama's configured interval. */
    OVERDUE
}
