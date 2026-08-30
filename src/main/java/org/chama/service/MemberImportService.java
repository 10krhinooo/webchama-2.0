package org.chama.service;

import io.quarkus.narayana.jta.QuarkusTransaction;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import org.chama.domain.enums.ActivityEventType;
import org.chama.dto.CreateMemberDto;
import org.chama.dto.MemberImportResultDto;
import org.chama.dto.MemberImportRowResultDto;
import org.chama.dto.MemberImportRowResultDto.MemberImportOutcome;
import org.chama.repository.MemberRepository;
import org.jboss.logging.Logger;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Bulk member import from a CSV file.
 *
 * <p>Two rules shape the whole thing.
 *
 * <p><b>A structural failure rejects the batch; a row failure never does.</b> If the header is
 * missing a column, nothing can be judged and nothing is attempted. But refusing two hundred and
 * fifty valid members because row three has a typo is what makes a bulk import useless, so every
 * good row lands and the bad ones come back described.
 *
 * <p><b>One fresh transaction per row.</b> A single ambient transaction would let one bad row mark
 * the batch rollback-only and silently undo every member already created in it, which is the worst
 * possible outcome: the caller is told rows succeeded and the database disagrees.
 *
 * <p>The response is always a 200 carrying per-row outcomes, including when every row failed. The
 * detail is the answer to the request, and collapsing it into an error status would discard
 * exactly what the chairperson needs to fix the file.
 */
@ApplicationScoped
public class MemberImportService {

    private static final Logger LOG = Logger.getLogger(MemberImportService.class);

    /**
     * A ceiling on one upload. Each row provisions a Keycloak account and sends mail, so a file
     * far larger than a real chama is a mistake or an attack rather than a use case.
     */
    private static final int MAX_ROWS = 500;

    @Inject
    MemberService memberService;

    @Inject
    MemberRepository memberRepository;

    @Inject
    ChamaService chamaService;

    @Inject
    ActivityLogService activityLogService;

    @Inject
    Validator validator;

    public MemberImportResultDto importMembers(Long chamaId, String csv, boolean dryRun) {
        var parsed = MemberCsvParser.parse(csv);
        if (!parsed.isStructurallyValid()) {
            return new MemberImportResultDto(dryRun, 0, 0, 0, 0, 0, parsed.structuralErrors(), List.of());
        }
        if (parsed.rows().size() > MAX_ROWS) {
            return new MemberImportResultDto(dryRun, parsed.rows().size(), 0, 0, 0, 0,
                List.of("The file has %d rows, which is more than the %d allowed in one import."
                    .formatted(parsed.rows().size(), MAX_ROWS)),
                List.of());
        }

        // Emails and phone numbers already seen earlier in this same file. The database unique
        // indexes cannot catch a collision between two rows of one upload, because neither row
        // exists yet when the other is checked.
        Set<String> emailsInBatch = new HashSet<>();
        Set<String> phonesInBatch = new HashSet<>();

        List<MemberImportRowResultDto> results = new ArrayList<>(parsed.rows().size());
        for (var row : parsed.rows()) {
            List<String> problems = check(chamaId, row, emailsInBatch, phonesInBatch);
            if (!problems.isEmpty()) {
                results.add(skipped(row, problems));
                continue;
            }
            emailsInBatch.add(normalise(row.member().email()));
            phonesInBatch.add(row.member().phone());

            if (dryRun) {
                results.add(new MemberImportRowResultDto(row.lineNumber(), row.member().email(),
                    row.member().fullName(), MemberImportOutcome.READY, List.of(), null));
                continue;
            }
            results.add(createOne(chamaId, row));
        }

        if (!dryRun) {
            long created = results.stream().filter(r -> r.outcome() == MemberImportOutcome.CREATED).count();
            if (created > 0) {
                // One entry for the import, not one per member. Each member still gets their own
                // MEMBER_INVITED row from MemberService.create; a fifty row file adding fifty more
                // near-identical entries would bury everything else in the feed.
                QuarkusTransaction.requiringNew().run(() ->
                    activityLogService.log(chamaService.get(chamaId), ActivityEventType.MEMBERS_IMPORTED,
                        created + (created == 1 ? " member was" : " members were") + " added from an imported file"));
            }
        }

        return summarise(dryRun, results, parsed.rows().size());
    }

    /** Everything wrong with a row, gathered at once so one upload surfaces every problem in it. */
    private List<String> check(Long chamaId, MemberCsvParser.ParsedRow row,
                               Set<String> emailsInBatch, Set<String> phonesInBatch) {
        List<String> problems = new ArrayList<>();
        CreateMemberDto member = row.member();

        for (ConstraintViolation<CreateMemberDto> violation : validator.validate(member)) {
            problems.add(propertyLabel(violation.getPropertyPath().toString()) + " " + violation.getMessage());
        }
        for (String unknown : row.unknownRoles()) {
            problems.add("Unknown role: " + unknown);
        }

        // Only rows that passed every check are recorded by the caller, so a row duplicating an
        // already-rejected one is not itself penalised for that row's mistake.
        if (!member.email().isBlank() && emailsInBatch.contains(normalise(member.email()))) {
            problems.add("Duplicate email earlier in this file");
        }
        if (!member.phone().isBlank() && phonesInBatch.contains(member.phone())) {
            problems.add("Duplicate phone number earlier in this file");
        }

        // Through Panache, so the converter encrypts on the way in and the comparison is against
        // the ciphertext the unique index is actually built on.
        if (!member.phone().isBlank() && memberRepository.phoneExistsInChama(chamaId, member.phone())) {
            problems.add("A member with this phone number is already in this chama");
        }
        if (member.nationalId() != null
                && memberRepository.nationalIdExistsInChama(chamaId, member.nationalId())) {
            problems.add("A member with this national ID is already in this chama");
        }
        return List.copyOf(problems);
    }

    /**
     * One row, in its own transaction.
     *
     * <p>A failure here is caught and reported rather than thrown: the remaining rows still have
     * to be attempted, and the caller needs the outcome of every one of them.
     */
    private MemberImportRowResultDto createOne(Long chamaId, MemberCsvParser.ParsedRow row) {
        try {
            var result = QuarkusTransaction.requiringNew()
                .call(() -> memberService.create(chamaId, row.member()));
            return new MemberImportRowResultDto(row.lineNumber(), row.member().email(),
                row.member().fullName(), MemberImportOutcome.CREATED, List.of(),
                result.temporaryPassword());
        } catch (RuntimeException e) {
            LOG.warnf(e, "[IMPORT] Row %d of a member import failed for chama %d", row.lineNumber(), chamaId);
            return new MemberImportRowResultDto(row.lineNumber(), row.member().email(),
                row.member().fullName(), MemberImportOutcome.FAILED,
                List.of(readableCause(e)), null);
        }
    }

    private static MemberImportRowResultDto skipped(MemberCsvParser.ParsedRow row, List<String> problems) {
        return new MemberImportRowResultDto(row.lineNumber(), row.member().email(),
            row.member().fullName(), MemberImportOutcome.SKIPPED, problems, null);
    }

    private static MemberImportResultDto summarise(boolean dryRun, List<MemberImportRowResultDto> rows, int total) {
        return new MemberImportResultDto(dryRun, total,
            (int) rows.stream().filter(r -> r.outcome() == MemberImportOutcome.CREATED).count(),
            (int) rows.stream().filter(r -> r.outcome() == MemberImportOutcome.READY).count(),
            (int) rows.stream().filter(r -> r.outcome() == MemberImportOutcome.SKIPPED).count(),
            (int) rows.stream().filter(r -> r.outcome() == MemberImportOutcome.FAILED).count(),
            List.of(), List.copyOf(rows));
    }

    /** Turns a bean-validation property path into something a spreadsheet column maps onto. */
    private static String propertyLabel(String property) {
        return switch (property) {
            case "email" -> "Email";
            case "fullName" -> "Full name";
            case "phone" -> "Phone";
            case "roles" -> "Roles";
            default -> property;
        };
    }

    /**
     * A short cause for the row, never the raw exception. Stack traces and provider messages leak
     * infrastructure detail into a response a chairperson reads.
     */
    private static String readableCause(RuntimeException e) {
        String message = e.getMessage();
        if (message == null || message.isBlank()) {
            return "Could not create this member.";
        }
        return message.length() > 200 ? message.substring(0, 200) : message;
    }

    private static String normalise(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}
