package org.chama.service;

import org.chama.domain.enums.MemberRoleType;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** The parser is a pure function of its input, so it needs no Quarkus. */
class MemberCsvParserTest {

    private static final String HEADER = "email,fullName,phone,nationalId,nextOfKin,roles\n";

    @Test
    void readsAWellFormedFile() {
        var result = MemberCsvParser.parse(HEADER
            + "jane@example.com,Jane Doe,254700000001,12345678,John Doe,TREASURER\n");

        assertTrue(result.isStructurallyValid());
        assertEquals(1, result.rows().size());
        var row = result.rows().get(0);
        assertEquals("jane@example.com", row.member().email());
        assertEquals("Jane Doe", row.member().fullName());
        assertEquals(List.of(MemberRoleType.TREASURER), row.member().roles());
    }

    @Test
    void lineNumbersMatchTheFileSoTheyMatchTheSpreadsheet() {
        var result = MemberCsvParser.parse(HEADER
            + "a@example.com,A,254700000001,,,\n"
            + "b@example.com,B,254700000002,,,\n");

        // Line 1 is the header, so the first member is line 2 in the person's editor.
        assertEquals(2, result.rows().get(0).lineNumber());
        assertEquals(3, result.rows().get(1).lineNumber());
    }

    @Test
    void acceptsColumnsInAnyOrderAndIgnoresHeaderCasingAndSpacing() {
        var result = MemberCsvParser.parse("Phone, Full Name ,EMAIL\n254700000001,Jane Doe,jane@example.com\n");

        assertTrue(result.isStructurallyValid());
        assertEquals("jane@example.com", result.rows().get(0).member().email());
        assertEquals("Jane Doe", result.rows().get(0).member().fullName());
    }

    @Test
    void rejectsAFileMissingARequiredColumn() {
        var result = MemberCsvParser.parse("email,fullName\njane@example.com,Jane Doe\n");

        assertFalse(result.isStructurallyValid());
        assertTrue(result.structuralErrors().stream().anyMatch(e -> e.contains("phone")));
        // Nothing is attempted when the shape is wrong, since no row can be judged.
        assertTrue(result.rows().isEmpty());
    }

    @Test
    void rejectsAFileWithARepeatedColumn() {
        var result = MemberCsvParser.parse("email,fullName,phone,email\na@x.com,A,254700000001,b@x.com\n");

        assertFalse(result.isStructurallyValid());
        assertTrue(result.structuralErrors().stream().anyMatch(e -> e.startsWith("Duplicate column")));
    }

    @Test
    void rejectsAnEmptyFile() {
        assertFalse(MemberCsvParser.parse("").isStructurallyValid());
        assertFalse(MemberCsvParser.parse(null).isStructurallyValid());
    }

    @Test
    void aQuotedFieldKeepsItsCommas() {
        var result = MemberCsvParser.parse(HEADER
            + "jane@example.com,Jane Doe,254700000001,,\"Doe, John\",\n");

        // Otherwise a next of kin written the obvious way silently splits into two columns and
        // shifts every value after it.
        assertEquals("Doe, John", result.rows().get(0).member().nextOfKin());
    }

    @Test
    void aDoubledQuoteInsideAQuotedFieldIsALiteralQuote() {
        var result = MemberCsvParser.parse(HEADER
            + "jane@example.com,\"Jane \"\"JD\"\" Doe\",254700000001,,,\n");

        assertEquals("Jane \"JD\" Doe", result.rows().get(0).member().fullName());
    }

    @Test
    void handlesWindowsAndClassicMacLineEndings() {
        assertEquals(2, MemberCsvParser.parse(HEADER.replace("\n", "\r\n")
            + "a@example.com,A,254700000001,,,\r\n"
            + "b@example.com,B,254700000002,,,\r\n").rows().size());

        assertEquals(1, MemberCsvParser.parse("email,fullName,phone\ra@example.com,A,254700000001\r")
            .rows().size());
    }

    @Test
    void blankLinesAreSkippedRatherThanReadAsEmptyMembers() {
        var result = MemberCsvParser.parse(HEADER
            + "a@example.com,A,254700000001,,,\n"
            + "\n"
            + "b@example.com,B,254700000002,,,\n");

        assertEquals(2, result.rows().size());
    }

    @Test
    void aMissingRolesColumnMeansAPlainMember() {
        var result = MemberCsvParser.parse("email,fullName,phone\njane@example.com,Jane,254700000001\n");

        // The common case in a real file is a plain member, so it should not be the verbose one.
        assertEquals(List.of(MemberRoleType.MEMBER), result.rows().get(0).member().roles());
        assertTrue(result.rows().get(0).unknownRoles().isEmpty());
    }

    @Test
    void severalRolesCanBeGivenInOneCell() {
        var result = MemberCsvParser.parse(HEADER
            + "jane@example.com,Jane,254700000001,,,TREASURER;SECRETARY\n");

        assertEquals(List.of(MemberRoleType.TREASURER, MemberRoleType.SECRETARY),
            result.rows().get(0).member().roles());
    }

    @Test
    void anUnrecognisedRoleIsReportedRatherThanSilentlyDropped() {
        var result = MemberCsvParser.parse(HEADER
            + "jane@example.com,Jane,254700000001,,,PRESIDENT\n");

        // Silently defaulting it to MEMBER would give someone a quieter role than the file asked
        // for and nobody would notice until they could not do their job.
        assertEquals(List.of("PRESIDENT"), result.rows().get(0).unknownRoles());
    }

    @Test
    void missingTrailingColumnsReadAsEmptyRatherThanThrowing() {
        var result = MemberCsvParser.parse(HEADER + "jane@example.com,Jane,254700000001\n");

        assertNull(result.rows().get(0).member().nationalId());
        assertNull(result.rows().get(0).member().nextOfKin());
    }

    @Test
    void blankOptionalFieldsBecomeNullRatherThanEmptyStrings() {
        var result = MemberCsvParser.parse(HEADER + "jane@example.com,Jane,254700000001,,,\n");

        // An empty string in national_id would occupy the unique index and collide with the next
        // member who also left it blank.
        assertNull(result.rows().get(0).member().nationalId());
    }
}
