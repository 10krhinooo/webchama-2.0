package org.chama.dto;

import org.chama.domain.enums.CreditScoreBand;

import java.math.BigDecimal;
import java.util.List;

/**
 * A member's internal credit score.
 *
 * {@code score} is null when {@code band} is INSUFFICIENT_HISTORY. There is no number that
 * honestly describes a member nothing is known about, and a placeholder zero or hundred would be
 * read as a judgement. Callers must handle the null rather than defaulting it.
 *
 * {@code confidence} is how much evidence the score rests on, from 0 to 1, and is independent of
 * the score itself: a well-evidenced bad score and a thin good one are different things.
 *
 * <p>Each component rate is null where the chama has no evidence for it, rather than zero. A chama
 * that has never recorded a meeting has not established that its members fail to attend, and that
 * component is dropped from the score rather than counted as a failure or a free pass.
 */
public record CreditScoreDto(
    Long memberId,
    Integer score,
    CreditScoreBand band,
    double confidence,
    Double contributionConsistency,
    Double contributionTimeliness,
    Double loanRepaymentRate,
    Double meetingAttendanceRate,
    /** Points taken off for penalties that stood. Nothing is added for having none. */
    int penaltyDeduction,
    /** Unsettled balance across loans the member is still repaying. */
    BigDecimal outstandingDebt,
    /** Everything the member has actually paid in, the counterweight to the debt above. */
    BigDecimal totalSavings,
    /** Any loan written off as defaulted, which caps the score regardless of the rest. */
    boolean hasDefaultedLoan,
    int contributionsConsidered,
    int meetingsConsidered,
    int loanRepaymentsConsidered,
    List<CreditScoreFactorDto> strengths,
    List<CreditScoreFactorDto> weaknesses) {
}
