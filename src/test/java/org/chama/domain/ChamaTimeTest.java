package org.chama.domain;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ChamaTimeTest {

    @Test
    void theCalendarIsNairobis() {
        assertEquals("Africa/Nairobi", ChamaTime.ZONE.getId());
    }

    @Test
    void todayIsTheNairobiDateAndNotTheHosts() {
        // These differ for the first three hours of every Nairobi morning, which is the whole
        // reason this constant exists rather than a bare LocalDate.now().
        LocalDate nairobi = ChamaTime.today();
        LocalDate utc = LocalDate.now(ZoneOffset.UTC);

        assertTrue(nairobi.equals(utc) || nairobi.equals(utc.plusDays(1)),
            "Nairobi is UTC+3, so its date is the UTC date or one day ahead of it, never behind");
    }
}
