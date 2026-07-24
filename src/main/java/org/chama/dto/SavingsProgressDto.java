package org.chama.dto;

import java.math.BigDecimal;

/** Progress toward a chama's optional lifetime savings goal. target is null when none is set. */
public record SavingsProgressDto(BigDecimal target, BigDecimal totalPaid) {
}
