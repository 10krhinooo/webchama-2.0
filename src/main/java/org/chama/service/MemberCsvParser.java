package org.chama.service;

import org.chama.domain.enums.MemberRoleType;
import org.chama.dto.CreateMemberDto;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Parses the member import file.
 *
 * <p>Hand written rather than pulled from a library, because the accepted shape is deliberately
 * tiny: a header line naming the columns in any order, then one member per line. Quoted fields are
 * supported, since a next of kin entry like "Jane Doe, sister" is the obvious thing for someone to
 * type and would otherwise silently split into two columns.
 *
 * <p>Parsing never rejects a row. Anything wrong with a row's contents is reported by the import
 * service alongside every other problem with that row, so the person fixing the file sees all of
 * it at once rather than one error per upload.
 */
public final class MemberCsvParser {

    static final String EMAIL = "email";
    static final String FULL_NAME = "fullname";
    static final String PHONE = "phone";
    static final String NATIONAL_ID = "nationalid";
    static final String NEXT_OF_KIN = "nextofkin";
    static final String ROLES = "roles";

    private static final List<String> REQUIRED_COLUMNS = List.of(EMAIL, FULL_NAME, PHONE);

    /** A row as it was read, with the line it came from and whatever the roles column said. */
    public record ParsedRow(int lineNumber, CreateMemberDto member, List<String> unknownRoles) {}

    public record ParseResult(List<String> structuralErrors, List<ParsedRow> rows) {
        public boolean isStructurallyValid() {
            return structuralErrors.isEmpty();
        }
    }

    private MemberCsvParser() {
    }

    public static ParseResult parse(String csv) {
        List<String> structuralErrors = new ArrayList<>();
        if (csv == null || csv.isBlank()) {
            return new ParseResult(List.of("The file is empty."), List.of());
        }

        // Split on any line ending, so a file saved on Windows is not one enormous single row.
        String[] lines = csv.replace("\r\n", "\n").replace('\r', '\n').split("\n");
        List<String> header = splitLine(lines[0]).stream()
            .map(MemberCsvParser::normaliseColumn)
            .toList();

        for (String required : REQUIRED_COLUMNS) {
            if (!header.contains(required)) {
                structuralErrors.add("Missing required column: " + displayName(required));
            }
        }
        Set<String> duplicates = new LinkedHashSet<>();
        for (String column : header) {
            if (!column.isEmpty() && header.indexOf(column) != header.lastIndexOf(column)) {
                duplicates.add(displayName(column));
            }
        }
        for (String duplicate : duplicates) {
            structuralErrors.add("Duplicate column: " + duplicate);
        }
        if (!structuralErrors.isEmpty()) {
            return new ParseResult(List.copyOf(structuralErrors), List.of());
        }

        List<ParsedRow> rows = new ArrayList<>();
        for (int i = 1; i < lines.length; i++) {
            if (lines[i].isBlank()) {
                continue;
            }
            List<String> values = splitLine(lines[i]);
            List<String> unknownRoles = new ArrayList<>();
            List<MemberRoleType> roles = parseRoles(value(header, values, ROLES), unknownRoles);
            rows.add(new ParsedRow(
                i + 1,
                new CreateMemberDto(
                    value(header, values, EMAIL),
                    value(header, values, FULL_NAME),
                    value(header, values, PHONE),
                    emptyToNull(value(header, values, NATIONAL_ID)),
                    emptyToNull(value(header, values, NEXT_OF_KIN)),
                    roles),
                List.copyOf(unknownRoles)));
        }
        return new ParseResult(List.of(), List.copyOf(rows));
    }

    /**
     * An unset roles column means a plain member, which is what almost every row in a real file
     * is. Requiring it would make the common case the verbose one.
     */
    private static List<MemberRoleType> parseRoles(String raw, List<String> unknownRoles) {
        if (raw == null || raw.isBlank()) {
            return List.of(MemberRoleType.MEMBER);
        }
        List<MemberRoleType> roles = new ArrayList<>();
        for (String token : raw.split("[;|]")) {
            String name = token.trim().toUpperCase(Locale.ROOT);
            if (name.isEmpty()) {
                continue;
            }
            try {
                roles.add(MemberRoleType.valueOf(name));
            } catch (IllegalArgumentException e) {
                unknownRoles.add(token.trim());
            }
        }
        return roles.isEmpty() && unknownRoles.isEmpty() ? List.of(MemberRoleType.MEMBER) : List.copyOf(roles);
    }

    /** Missing trailing columns read as empty rather than throwing, since spreadsheets omit them. */
    private static String value(List<String> header, List<String> values, String column) {
        int index = header.indexOf(column);
        if (index < 0 || index >= values.size()) {
            return "";
        }
        return values.get(index).trim();
    }

    private static String normaliseColumn(String column) {
        return column.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z]", "");
    }

    private static String displayName(String normalised) {
        return switch (normalised) {
            case EMAIL -> "email";
            case FULL_NAME -> "full name";
            case PHONE -> "phone";
            case NATIONAL_ID -> "national id";
            case NEXT_OF_KIN -> "next of kin";
            case ROLES -> "roles";
            default -> normalised;
        };
    }

    private static String emptyToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    /** Minimal CSV field splitting: commas separate, double quotes protect, "" is a literal quote. */
    private static List<String> splitLine(String line) {
        List<String> values = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (inQuotes) {
                if (c == '"') {
                    if (i + 1 < line.length() && line.charAt(i + 1) == '"') {
                        current.append('"');
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    current.append(c);
                }
            } else if (c == '"') {
                inQuotes = true;
            } else if (c == ',') {
                values.add(current.toString());
                current.setLength(0);
            } else {
                current.append(c);
            }
        }
        values.add(current.toString());
        return List.copyOf(Arrays.asList(values.toArray(String[]::new)));
    }
}
