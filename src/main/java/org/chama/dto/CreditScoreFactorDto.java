package org.chama.dto;

/**
 * One component of a credit score, named so the UI can explain the number instead of only showing
 * it. {@code rate} is the component's own 0..1 result and {@code weight} its share of the final
 * score after the weights were renormalized over the components that had any evidence.
 */
public record CreditScoreFactorDto(
    String code,
    String label,
    double rate,
    double weight,
    int observations) {
}
