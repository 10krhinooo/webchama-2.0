package org.chama.dto;

import java.math.BigDecimal;

/** One loan status and what sits in it, for the portfolio breakdown. */
public record LoanPortfolioSliceDto(
    String status,
    long loans,
    BigDecimal principal,
    BigDecimal outstanding) {
}
