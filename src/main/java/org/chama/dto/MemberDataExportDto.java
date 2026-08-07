package org.chama.dto;

import java.time.Instant;
import java.util.List;

/**
 * Self-service GDPR Article 20 data portability export: everything the platform holds about the
 * calling member within one chama, in a structured machine-readable format. Deliberately scoped
 * to the member's own data only (see MemberResource.exportMyData), never another member's.
 */
public record MemberDataExportDto(
    Instant generatedAt,
    MemberDto profile,
    List<ContributionDto> contributions,
    List<LoanDto> loans,
    List<LoanRepaymentDto> loanRepayments,
    List<PaymentDto> payments,
    List<WelfareContributionDto> welfareContributions,
    List<PenaltyDto> penalties,
    List<MeetingAttendanceDto> meetingAttendance) {
}
