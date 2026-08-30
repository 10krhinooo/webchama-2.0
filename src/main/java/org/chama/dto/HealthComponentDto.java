package org.chama.dto;

/**
 * One scored component of a chama's health.
 *
 * <p>{@code weight} is the share actually applied after redistribution over the components that
 * had evidence, so the weights a caller receives always add to one.
 */
public record HealthComponentDto(
    String code,
    String label,
    double rate,
    double weight) {
}
