package org.chama.dto;

import java.math.BigDecimal;

/**
 * One month of the contribution trend.
 *
 * <p>Every month in the requested window is present even when nothing was billed in it. A chart
 * that silently loses its empty months redraws its x-axis and reads as though the gap never
 * existed.
 */
public record ContributionTrendPointDto(
    /** ISO year and month, for example "2026-05". */
    String month,
    BigDecimal expected,
    BigDecimal collected,
    double collectionRate) {
}
