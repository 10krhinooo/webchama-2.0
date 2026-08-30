package org.chama.dto;

import java.util.List;

/**
 * The outcome of a whole import.
 *
 * <p>Always returned with a 200, including when every row failed. The per-row detail is the
 * answer to the request, not an error condition, and collapsing it into a 400 would throw away
 * exactly the information the chairperson needs to fix the file.
 *
 * <p>{@code structuralErrors} is different: a missing header or an unreadable file means no row
 * could be judged, so nothing is attempted and the row list is empty.
 */
public record MemberImportResultDto(
    boolean dryRun,
    int totalRows,
    int created,
    int ready,
    int skipped,
    int failed,
    List<String> structuralErrors,
    List<MemberImportRowResultDto> rows) {
}
