package org.chama.dto;

import org.chama.domain.enums.HealthBand;

import java.util.List;

/**
 * How a chama is doing, as one number plus the components behind it.
 *
 * <p>Follows the conventions {@code CreditScoreService} settled on, and for the same reasons: a
 * component the chama records nothing for is dropped and its weight redistributed rather than
 * scored as a pass, and a chama with no evidence at all reports a null score with the
 * INSUFFICIENT_HISTORY band rather than a number it has not earned.
 */
public record ChamaHealthDto(
    Long chamaId,
    Integer score,
    HealthBand band,
    List<HealthComponentDto> components,
    long activeMembers,
    long membersInArrears,
    java.math.BigDecimal totalContributed,
    java.math.BigDecimal totalOutstandingArrears,
    java.math.BigDecimal outstandingLoanPrincipal) {
}
