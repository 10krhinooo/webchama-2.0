package org.chama.service;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.ws.rs.NotFoundException;
import org.chama.domain.enums.AttendanceStatus;
import org.chama.domain.enums.ChamaStatus;
import org.chama.domain.enums.ChamaType;
import org.chama.domain.enums.ContributionFrequency;
import org.chama.domain.enums.ContributionStatus;
import org.chama.domain.enums.InterestMethod;
import org.chama.domain.enums.LoanRepaymentStatus;
import org.chama.domain.enums.LoanStatus;
import org.chama.domain.enums.MemberStatus;
import org.chama.domain.model.Chama;
import org.chama.domain.model.Contribution;
import org.chama.domain.model.Loan;
import org.chama.domain.model.LoanRepayment;
import org.chama.domain.model.Meeting;
import org.chama.domain.model.MeetingAttendance;
import org.chama.domain.model.Member;
import org.chama.dto.CreditScoreDto;
import org.chama.repository.ApprovalRepository;
import org.chama.repository.ActivityLogRepository;
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
import org.chama.repository.PayoutRepository;
import org.chama.repository.PayoutScheduleRepository;
import org.chama.repository.PenaltyRepository;
import org.chama.repository.WelfareContributionRepository;
import org.chama.repository.WelfareFundRepository;
import org.chama.repository.WelfareWithdrawalRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@QuarkusTest
class CreditScoreServiceTest {

    @Inject
    CreditScoreService creditScoreService;

    @Inject
    ChamaRepository chamaRepository;

    @Inject
    ActivityLogRepository activityLogRepository;

    @Inject
    MemberRepository memberRepository;

    @Inject
    ContributionRepository contributionRepository;

    @Inject
    MeetingRepository meetingRepository;

    @Inject
    MeetingAttendanceRepository meetingAttendanceRepository;

    @Inject
    LoanRepository loanRepository;

    @Inject
    LoanRepaymentRepository loanRepaymentRepository;

    @Inject
    ApprovalRepository approvalRepository;

    @Inject
    DocumentDeliveryAttemptRepository documentDeliveryAttemptRepository;

    @Inject
    GeneratedDocumentRepository generatedDocumentRepository;

    @Inject
    LoanDisbursementRepository loanDisbursementRepository;

    @Inject
    PayoutRepository payoutRepository;

    @Inject
    PayoutScheduleRepository payoutScheduleRepository;

    @Inject
    PenaltyRepository penaltyRepository;

    @Inject
    WelfareContributionRepository welfareContributionRepository;

    @Inject
    WelfareFundRepository welfareFundRepository;

    @Inject
    WelfareWithdrawalRepository welfareWithdrawalRepository;

    private Long chamaId;
    private Long otherChamaId;
    private Long memberId;

    @BeforeEach
    void seed() {
        QuarkusTransaction.requiringNew().run(() -> {
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
            contributionRepository.deleteAll();
            approvalRepository.deleteAll();
            welfareWithdrawalRepository.deleteAll();
            welfareContributionRepository.deleteAll();
            welfareFundRepository.deleteAll();
            memberRepository.deleteAll();
            activityLogRepository.deleteAll();
            chamaRepository.deleteAll();

            Chama chama = newChama("Credit Score Test Chama");
            chamaRepository.persist(chama);
            chamaId = chama.id;

            Chama otherChama = newChama("Other Chama");
            chamaRepository.persist(otherChama);
            otherChamaId = otherChama.id;

            Member member = new Member();
            member.chama = chama;
            member.keycloakUserId = "credit-score-member-1";
            member.fullName = "Score Member";
            member.phone = "254700000501";
            member.status = MemberStatus.ACTIVE;
            memberRepository.persist(member);
            memberId = member.id;
        });
    }

    private Chama newChama(String name) {
        Chama chama = new Chama();
        chama.name = name;
        chama.type = ChamaType.TABLE_BANKING;
        chama.currency = "KES";
        chama.contributionFrequency = ContributionFrequency.MONTHLY;
        chama.contributionAmount = new BigDecimal("500");
        chama.status = ChamaStatus.ACTIVE;
        return chama;
    }

    @Test
    void aMemberWithNoHistoryAtAllGetsAPerfectNeutralScore() {
        CreditScoreDto result = creditScoreService.calculate(chamaId, memberId);

        assertEquals(100, result.score());
        assertEquals(0, result.contributionsConsidered());
        assertEquals(0, result.meetingsConsidered());
        assertEquals(0, result.loanRepaymentsConsidered());
    }

    @Test
    void rejectsAMemberFromAnotherChama() {
        assertThrows(NotFoundException.class, () -> creditScoreService.calculate(otherChamaId, memberId));
    }

    @Test
    void futureDueContributionsAndInstallmentsAreNotYetHeldAgainstTheMember() {
        persistContribution(LocalDate.now().plusMonths(1), ContributionStatus.PENDING);

        CreditScoreDto result = creditScoreService.calculate(chamaId, memberId);

        assertEquals(0, result.contributionsConsidered());
        assertEquals(1.0, result.contributionConsistency());
    }

    @Test
    void onlyPaidPastDueContributionsCountTowardConsistency() {
        persistContribution(LocalDate.now().minusMonths(2), ContributionStatus.PAID);
        persistContribution(LocalDate.now().minusMonths(1), ContributionStatus.PENDING);

        CreditScoreDto result = creditScoreService.calculate(chamaId, memberId);

        assertEquals(2, result.contributionsConsidered());
        assertEquals(0.5, result.contributionConsistency());
    }

    @Test
    void excusedAbsencesAreNeitherCountedForNorAgainstAttendance() {
        persistAttendance(AttendanceStatus.PRESENT);
        persistAttendance(AttendanceStatus.EXCUSED);
        persistAttendance(AttendanceStatus.ABSENT);

        CreditScoreDto result = creditScoreService.calculate(chamaId, memberId);

        // Excused is excluded from the denominator, only PRESENT/ABSENT count, so 1 of 2.
        assertEquals(2, result.meetingsConsidered());
        assertEquals(0.5, result.meetingAttendanceRate());
    }

    @Test
    void onlyPastDueLoanRepaymentsCountTowardRepaymentHistory() {
        Long loanId = persistLoan();
        persistRepayment(loanId, 1, LocalDate.now().minusMonths(1), LoanRepaymentStatus.PAID);
        persistRepayment(loanId, 2, LocalDate.now().plusMonths(1), LoanRepaymentStatus.PENDING);

        CreditScoreDto result = creditScoreService.calculate(chamaId, memberId);

        assertEquals(1, result.loanRepaymentsConsidered());
        assertEquals(1.0, result.loanRepaymentRate());
    }

    @Test
    void aWeakRecordAcrossAllThreeSignalsProducesALowScore() {
        persistContribution(LocalDate.now().minusMonths(1), ContributionStatus.PENDING);
        persistAttendance(AttendanceStatus.ABSENT);
        Long loanId = persistLoan();
        persistRepayment(loanId, 1, LocalDate.now().minusMonths(1), LoanRepaymentStatus.PARTIAL);

        CreditScoreDto result = creditScoreService.calculate(chamaId, memberId);

        assertEquals(0, result.score());
    }

    private void persistContribution(LocalDate period, ContributionStatus status) {
        QuarkusTransaction.requiringNew().run(() -> {
            Contribution contribution = new Contribution();
            contribution.chama = chamaRepository.findById(chamaId);
            contribution.member = memberRepository.findById(memberId);
            contribution.period = period;
            contribution.amountDue = new BigDecimal("500");
            contribution.amountPaid = status == ContributionStatus.PAID ? new BigDecimal("500") : BigDecimal.ZERO;
            contribution.status = status;
            contributionRepository.persist(contribution);
        });
    }

    private void persistAttendance(AttendanceStatus status) {
        QuarkusTransaction.requiringNew().run(() -> {
            Meeting meeting = new Meeting();
            meeting.chama = chamaRepository.findById(chamaId);
            meeting.meetingDate = LocalDate.now().minusDays(1);
            meeting.agenda = "Monthly meeting";
            meetingRepository.persist(meeting);

            MeetingAttendance attendance = new MeetingAttendance();
            attendance.meeting = meeting;
            attendance.member = memberRepository.findById(memberId);
            attendance.status = status;
            meetingAttendanceRepository.persist(attendance);
        });
    }

    private Long persistLoan() {
        return QuarkusTransaction.requiringNew().call(() -> {
            Loan loan = new Loan();
            loan.chama = chamaRepository.findById(chamaId);
            loan.member = memberRepository.findById(memberId);
            loan.principal = new BigDecimal("5000");
            loan.interestRate = new BigDecimal("0");
            loan.interestMethod = InterestMethod.FLAT;
            loan.termMonths = 6;
            loan.status = LoanStatus.APPROVED;
            loanRepository.persist(loan);
            return loan.id;
        });
    }

    private void persistRepayment(Long loanId, int installmentNumber, LocalDate scheduledDate, LoanRepaymentStatus status) {
        QuarkusTransaction.requiringNew().run(() -> {
            LoanRepayment repayment = new LoanRepayment();
            repayment.loan = loanRepository.findById(loanId);
            repayment.installmentNumber = installmentNumber;
            repayment.scheduledDate = scheduledDate;
            repayment.amountDue = new BigDecimal("900");
            repayment.amountPaid = status == LoanRepaymentStatus.PAID ? new BigDecimal("900") : BigDecimal.ZERO;
            repayment.status = status;
            loanRepaymentRepository.persist(repayment);
        });
    }
}
