package org.chama.domain;

import java.time.LocalDate;
import java.time.ZoneId;

/**
 * The calendar a chama actually keeps.
 *
 * <p>Every due date, streak, arrears bucket and reminder window in this product is a Nairobi
 * calendar date, not a UTC one and not the server's. Getting that wrong is not a rounding error: on
 * a UTC host, "today" is a day behind Nairobi's for the first three hours of every Nairobi morning,
 * so a contribution due today reads as overdue, a streak breaks, and a reminder fires against the
 * wrong day. Commit 357b7fb moved the due-date checks off UTC for exactly this reason.
 *
 * <p>The zone lived as a private constant in seven services and was restated in the tests, which is
 * what let one of those tests build its fixture in UTC while the service it exercised read Nairobi.
 * That test passed for twenty-one hours a day and failed for the other three. Stated once here so
 * there is nothing to drift.
 */
public final class ChamaTime {

    public static final ZoneId ZONE = ZoneId.of("Africa/Nairobi");

    private ChamaTime() {
    }

    /** Today, on the chama's calendar. */
    public static LocalDate today() {
        return LocalDate.now(ZONE);
    }
}
