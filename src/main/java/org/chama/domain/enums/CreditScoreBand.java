package org.chama.domain.enums;

/**
 * A plain-language reading of a credit score, so callers do not each invent their own thresholds.
 *
 * INSUFFICIENT_HISTORY is not the bottom of the scale, it is the absence of one. A member with no
 * due contributions, no meetings and no loans has done nothing wrong, and presenting them as high
 * risk is as misleading as presenting them as low risk. Consumers must branch on this band rather
 * than reading the score, which is null in that case.
 */
public enum CreditScoreBand {
    INSUFFICIENT_HISTORY,
    POOR,
    FAIR,
    GOOD,
    EXCELLENT
}
