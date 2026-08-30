package org.chama;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.chama.repository.ActivityLogRepository;
import org.chama.repository.ApprovalRepository;
import org.chama.repository.ChamaRepository;
import org.chama.repository.ContributionRepository;
import org.chama.repository.DocumentDeliveryAttemptRepository;
import org.chama.repository.GeneratedDocumentRepository;
import org.chama.repository.LoanDisbursementRepository;
import org.chama.repository.LoanRepaymentRepository;
import org.chama.repository.LoanRepository;
import org.chama.repository.MeetingAttendanceRepository;
import org.chama.repository.MeetingRepository;
import org.chama.repository.MemberRepository;
import org.chama.repository.MemberRoleRepository;
import org.chama.repository.NotificationRepository;
import org.chama.repository.PaymentRepository;
import org.chama.repository.PayoutRepository;
import org.chama.repository.PayoutScheduleRepository;
import org.chama.repository.PenaltyRepository;
import org.chama.repository.WelfareContributionRepository;
import org.chama.repository.WelfareFundRepository;
import org.chama.repository.WelfareWithdrawalRepository;

/**
 * Empties every table a test might have written to, in an order the foreign keys allow.
 *
 * <p>Each test class used to carry its own copy of this list, which meant a new class that only
 * cleaned up the tables it wrote to passed on its own and failed in the full suite, on rows some
 * other class had left behind. That has happened often enough to be worth one shared list. Call it
 * inside {@code QuarkusTransaction.requiringNew()} from a {@code @BeforeEach}.
 *
 * <p>A table whose foreign key cascades does not need a line here, which is why notification and
 * the reminder tables are absent: their rows go when the chama or contribution does.
 */
@ApplicationScoped
public class TestDataCleaner {

    @Inject ActivityLogRepository activityLogRepository;
    @Inject ApprovalRepository approvalRepository;
    @Inject ChamaRepository chamaRepository;
    @Inject ContributionRepository contributionRepository;
    @Inject DocumentDeliveryAttemptRepository documentDeliveryAttemptRepository;
    @Inject GeneratedDocumentRepository generatedDocumentRepository;
    @Inject LoanDisbursementRepository loanDisbursementRepository;
    @Inject LoanRepaymentRepository loanRepaymentRepository;
    @Inject LoanRepository loanRepository;
    @Inject MeetingAttendanceRepository meetingAttendanceRepository;
    @Inject MeetingRepository meetingRepository;
    @Inject MemberRepository memberRepository;
    @Inject MemberRoleRepository memberRoleRepository;
    @Inject NotificationRepository notificationRepository;
    @Inject PaymentRepository paymentRepository;
    @Inject PayoutRepository payoutRepository;
    @Inject PayoutScheduleRepository payoutScheduleRepository;
    @Inject PenaltyRepository penaltyRepository;
    @Inject WelfareContributionRepository welfareContributionRepository;
    @Inject WelfareFundRepository welfareFundRepository;
    @Inject WelfareWithdrawalRepository welfareWithdrawalRepository;

    /** Order matters: children before parents, all the way down to chama. */
    public void deleteAll() {
        notificationRepository.deleteAll();
        documentDeliveryAttemptRepository.deleteAll();
        generatedDocumentRepository.deleteAll();
        meetingAttendanceRepository.deleteAll();
        meetingRepository.deleteAll();
        penaltyRepository.deleteAll();
        payoutRepository.deleteAll();
        payoutScheduleRepository.deleteAll();
        loanRepaymentRepository.deleteAll();
        loanDisbursementRepository.deleteAll();
        loanRepository.deleteAll();
        paymentRepository.deleteAll();
        contributionRepository.deleteAll();
        approvalRepository.deleteAll();
        welfareWithdrawalRepository.deleteAll();
        welfareContributionRepository.deleteAll();
        welfareFundRepository.deleteAll();
        memberRoleRepository.deleteAll();
        memberRepository.deleteAll();
        activityLogRepository.deleteAll();
        chamaRepository.deleteAll();
    }
}
