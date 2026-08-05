package org.chama.dto;

public record CreditScoreDto(
    Long memberId,
    int score,
    double contributionConsistency,
    double meetingAttendanceRate,
    double loanRepaymentRate,
    int contributionsConsidered,
    int meetingsConsidered,
    int loanRepaymentsConsidered) {
}
