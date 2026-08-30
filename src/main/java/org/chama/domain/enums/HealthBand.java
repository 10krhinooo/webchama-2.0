package org.chama.domain.enums;

/**
 * A plain-language reading of a chama's health score, using the same shape as
 * {@link CreditScoreBand} so the two are read the same way.
 *
 * <p>INSUFFICIENT_HISTORY is the absence of a score rather than the bottom of the scale. A chama
 * created last week has done nothing wrong, and presenting it as unhealthy would be as wrong as
 * presenting it as thriving.
 */
public enum HealthBand {
    INSUFFICIENT_HISTORY,
    AT_RISK,
    FAIR,
    GOOD,
    THRIVING
}
