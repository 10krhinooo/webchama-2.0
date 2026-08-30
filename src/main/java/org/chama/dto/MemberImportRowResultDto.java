package org.chama.dto;

import java.util.List;

/**
 * What happened to one row of an imported file.
 *
 * <p>{@code lineNumber} is the line in the uploaded file, header included, so it matches what the
 * person sees in their spreadsheet rather than a zero-based index into the parsed rows.
 */
public record MemberImportRowResultDto(
    int lineNumber,
    String email,
    String fullName,
    MemberImportOutcome outcome,
    /** Why the row was skipped or failed. Empty when it succeeded. */
    List<String> problems,
    /** Set only on a committed row that provisioned a new Keycloak account. */
    String temporaryPassword) {

    public enum MemberImportOutcome {
        /** Passed every check. On a dry run this means it would be created, not that it was. */
        READY,
        CREATED,
        /** Rejected before anything was attempted: bad data, a duplicate, or an existing member. */
        SKIPPED,
        /** Passed the checks but failed while being created, usually a Keycloak or mail problem. */
        FAILED
    }
}
