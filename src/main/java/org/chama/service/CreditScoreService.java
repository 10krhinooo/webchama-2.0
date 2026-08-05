package org.chama.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.NotFoundException;
import org.chama.domain.enums.AttendanceStatus;
import org.chama.domain.enums.ContributionStatus;
import org.chama.domain.enums.LoanRepaymentStatus;
import org.chama.domain.model.Contribution;
import org.chama.domain.model.LoanRepayment;
import org.chama.domain.model.MeetingAttendance;
import org.chama.dto.CreditScoreDto;
import org.chama.repository.ContributionRepository;
import org.chama.repository.LoanRepaymentRepository;
import org.chama.repository.MeetingAttendanceRepository;
import org.chama.repository.MemberRepository;

import java.time.LocalDate;
import java.util.List;

/**
 * Internal credit score derived from contribution consistency, meeting attendance, and loan
 * repayment history (issue #58, MIGRATION_PLAN.md section 9). A signal for the chairperson/
 * treasurer reviewing a loan request, not a hard gate, nothing in the loan approval flow enforces
 * a minimum score.
 */
@ApplicationScoped
public class CreditScoreService {

    private static final double CONTRIBUTION_WEIGHT = 0.4;
    private static final double LOAN_REPAYMENT_WEIGHT = 0.3;
    private static final double ATTENDANCE_WEIGHT = 0.3;

    @Inject
    MemberRepository memberRepository;

    @Inject
    ContributionRepository contributionRepository;

    @Inject
    MeetingAttendanceRepository meetingAttendanceRepository;

    @Inject
    LoanRepaymentRepository loanRepaymentRepository;

    public CreditScoreDto calculate(Long chamaId, Long memberId) {
        var member = memberRepository.findByIdOptional(memberId).orElseThrow(NotFoundException::new);
        if (!member.chama.id.equals(chamaId)) {
            throw new NotFoundException();
        }

        List<Contribution> contributions = contributionRepository.findByChamaAndMember(chamaId, memberId);
        List<MeetingAttendance> attendance = meetingAttendanceRepository.findByChamaAndMember(chamaId, memberId);
        List<LoanRepayment> repayments = loanRepaymentRepository.findByChamaAndMember(chamaId, memberId);

        LocalDate today = LocalDate.now();

        // Only periods/installments that have actually come due count, an unpaid contribution or
        // installment that isn't due yet is not a consistency problem.
        List<Contribution> dueContributions = contributions.stream().filter(c -> !c.period.isAfter(today)).toList();
        double contributionConsistency = rate(dueContributions.size(),
            (int) dueContributions.stream().filter(c -> c.status == ContributionStatus.PAID).count());

        List<LoanRepayment> dueRepayments = repayments.stream().filter(r -> !r.scheduledDate.isAfter(today)).toList();
        double loanRepaymentRate = rate(dueRepayments.size(),
            (int) dueRepayments.stream().filter(r -> r.status == LoanRepaymentStatus.PAID).count());

        // EXCUSED absences are neither counted for nor against the member, only PRESENT/ABSENT
        // reflect actual attendance discipline.
        List<MeetingAttendance> countedAttendance = attendance.stream()
            .filter(a -> a.status != AttendanceStatus.EXCUSED).toList();
        double meetingAttendanceRate = rate(countedAttendance.size(),
            (int) countedAttendance.stream().filter(a -> a.status == AttendanceStatus.PRESENT).count());

        double weighted = contributionConsistency * CONTRIBUTION_WEIGHT
            + loanRepaymentRate * LOAN_REPAYMENT_WEIGHT
            + meetingAttendanceRate * ATTENDANCE_WEIGHT;
        int score = (int) Math.round(weighted * 100);

        return new CreditScoreDto(
            memberId,
            score,
            contributionConsistency,
            meetingAttendanceRate,
            loanRepaymentRate,
            dueContributions.size(),
            countedAttendance.size(),
            dueRepayments.size());
    }

    // No history to judge is treated as neutral (full marks for that component), rather than
    // penalizing a brand-new member who simply hasn't had a due date yet.
    private double rate(int total, int onTime) {
        return total == 0 ? 1.0 : (double) onTime / total;
    }
}
