package org.chama.dto;

import java.math.BigDecimal;

/**
 * One ageing bucket of unpaid contributions.
 *
 * <p>All four buckets are always returned, zeros included, for the same reason the trend is
 * gap-filled: a bar chart that drops its empty categories is read as a different shape.
 */
public record ArrearsBucketDto(
    String bucket,
    long members,
    BigDecimal amount) {
}
