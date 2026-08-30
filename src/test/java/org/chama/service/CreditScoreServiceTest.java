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
import org.chama.domain.enums.CreditScoreBand;
import org.chama.domain.enums.MemberStatus;
import org.chama.domain.enums.PenaltyReason;
import org.chama.domain.enums.PenaltyStatus;
import org.chama.domain.model.Chama;
import org.chama.domain.model.Contribution;
import org.chama.domain.model.Loan;
import org.chama.domain.model.LoanRepayment;
import org.chama.domain.model.Meeting;
import org.chama.domain.model.MeetingAttendance;
import org.chama.domain.model.Member;
import org.chama.domain.model.Penalty;
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
import org.chama.repository.PaymentRepository;
import org.chama.repository.PayoutRepository;
import org.chama.repository.PayoutScheduleRepository;
import org.chama.repository.PenaltyRepository;
import org.chama.repository.WelfareContributionRepository;
import org.chama.repository.WelfareFundRepository;
import org.chama.repository.WelfareWithdrawalRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

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

    @Inject
    PaymentRepository paymentRepository;

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
            paymentRepository.deleteAll();
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
    void aMemberWithNothingToJudgeGetsNoScoreRatherThanAFlatteringOne() {
        CreditScoreDto result = creditScoreService.calculate(chamaId, memberId);

        // The old model handed this member 100. Nothing is known about them, which is not the
        // same as knowing they are reliable, so there is no number to report.
        assertNull(result.score());
        assertEquals(CreditScoreBand.INSUFFICIENT_HISTORY, result.band());
        assertEquals(0.0, result.confidence());
        assertNull(result.contributionConsistency());
        assertNull(result.meetingAttendanceRate());
    }

    @Test
    void rejectsAMemberFromAnotherChama() {
        assertThrows(NotFoundException.class, () -> creditScoreService.calculate(otherChamaId, memberId));
    }

    @Test
    void futureObligationsAreNotYetHeldAgainstTheMember() {
        contribution(days(30), "500", "0", null);

        CreditScoreDto result = creditScoreService.calculate(chamaId, memberId);

        assertEquals(0, result.contributionsConsidered());
        assertEquals(CreditScoreBand.INSUFFICIENT_HISTORY, result.band());
    }

    @Test
    void aPartlyPaidContributionScoresBetweenNothingAndEverything() {
        contribution(days(-30), "500", "250", null);
        double partial = creditScoreService.calculate(chamaId, memberId).contributionConsistency();

        reseed();
        contribution(days(-30), "500", "0", null);
        double none = creditScoreService.calculate(chamaId, memberId).contributionConsistency();

        reseed();
        contribution(days(-30), "500", "500", null);
        double full = creditScoreService.calculate(chamaId, memberId).contributionConsistency();

        // The previous model read status only, so PARTIAL and PENDING were indistinguishable.
        assertTrue(none < partial, "a part payment must beat no payment: " + none + " vs " + partial);
        assertTrue(partial < full, "a part payment must not equal full payment: " + partial + " vs " + full);
    }

    @Test
    void overpayingOneContributionDoesNotCoverAMissedOne() {
        contribution(days(-60), "500", "1000", null);
        contribution(days(-30), "500", "0", null);

        double rate = creditScoreService.calculate(chamaId, memberId).contributionConsistency();

        // Capped at each obligation's own amount due, so paying double one month is not a credit
        // against skipping the next.
        assertTrue(rate < 0.75, "overpayment must not mask a miss, got " + rate);
    }

    @Test
    void aThinPerfectRecordScoresBelowAThickOne() {
        contribution(days(-30), "500", "500", null);
        int thin = creditScoreService.calculate(chamaId, memberId).score();

        reseed();
        for (int month = 1; month <= 8; month++) {
            contribution(days(-30 * month), "500", "500", null);
        }
        int thick = creditScoreService.calculate(chamaId, memberId).score();

        assertTrue(thin < thick, "one payment must not score as well as eight: " + thin + " vs " + thick);
    }

    @Test
    void confidenceGrowsWithEvidenceIndependentlyOfTheScore() {
        contribution(days(-30), "500", "0", null);
        CreditScoreDto thin = creditScoreService.calculate(chamaId, memberId);

        reseed();
        for (int month = 1; month <= 12; month++) {
            contribution(days(-30 * month), "500", "0", null);
        }
        CreditScoreDto thick = creditScoreService.calculate(chamaId, memberId);

        assertTrue(thin.confidence() < thick.confidence());
        // Both records are bad, but only one of them is well evidenced.
        assertTrue(thick.score() < thin.score());
    }

    @Test
    void recentBehaviourOutweighsOldBehaviour() {
        contribution(days(-30), "500", "500", null);
        contribution(days(-730), "500", "0", null);
        int recentlyGood = creditScoreService.calculate(chamaId, memberId).score();

        reseed();
        contribution(days(-30), "500", "0", null);
        contribution(days(-730), "500", "500", null);
        int recentlyBad = creditScoreService.calculate(chamaId, memberId).score();

        assertTrue(recentlyBad < recentlyGood,
            "a recent miss must cost more than a two year old one: " + recentlyBad + " vs " + recentlyGood);
    }

    @Test
    void payingLateScoresBelowPayingOnTime() {
        contribution(days(-60), "500", "500", instant(-60));
        double onTime = creditScoreService.calculate(chamaId, memberId).contributionTimeliness();

        reseed();
        contribution(days(-60), "500", "500", instant(-20));
        double late = creditScoreService.calculate(chamaId, memberId).contributionTimeliness();

        assertTrue(late < onTime, "40 days late must score below on time: " + late + " vs " + onTime);
    }

    @Test
    void anUnpaidObligationIsNotChargedToTimelinessAsWellAsConsistency() {
        contribution(days(-60), "500", "0", null);

        CreditScoreDto result = creditScoreService.calculate(chamaId, memberId);

        // It is already fully counted against consistency. Timeliness measures how promptly
        // settled obligations were settled, and this one never was.
        assertTrue(result.contributionConsistency() < 0.6, "the miss must count, got " + result.contributionConsistency());
        assertNull(result.contributionTimeliness());
    }

    @Test
    void excusedAbsencesAreNeitherCountedForNorAgainstAttendance() {
        attendance(AttendanceStatus.PRESENT, days(-10));
        attendance(AttendanceStatus.EXCUSED, days(-10));
        attendance(AttendanceStatus.ABSENT, days(-10));

        CreditScoreDto result = creditScoreService.calculate(chamaId, memberId);

        assertEquals(2, result.meetingsConsidered());
        // One of two counted meetings attended, smoothed toward the neutral prior.
        assertTrue(result.meetingAttendanceRate() > 0.5 && result.meetingAttendanceRate() < 0.75);
    }

    @Test
    void aComponentWithNoEvidenceIsDroppedRatherThanScoredAsAPass() {
        // A chama that has never recorded a meeting must not hand every member the attendance
        // weight for free, nor score them as having failed to attend.
        contribution(days(-30), "500", "0", null);

        CreditScoreDto result = creditScoreService.calculate(chamaId, memberId);

        assertNull(result.meetingAttendanceRate());
        assertNull(result.loanRepaymentRate());
        // Consistency is the only measured component, so it is the whole score rather than being
        // averaged with free passes for attendance and repayment.
        assertEquals((int) Math.round(result.contributionConsistency() * 100), result.score());
    }

    @Test
    void onlyPastDueLoanRepaymentsCountTowardRepaymentHistory() {
        Long loanId = loan(LoanStatus.REPAYING);
        repayment(loanId, 1, days(-30), "900", "900", instant(-30));
        repayment(loanId, 2, days(30), "900", "0", null);

        CreditScoreDto result = creditScoreService.calculate(chamaId, memberId);

        assertEquals(1, result.loanRepaymentsConsidered());
        // A single perfect installment is smoothed toward the prior, so it is short of 1.0.
        assertTrue(result.loanRepaymentRate() > 0.8, "got " + result.loanRepaymentRate());
    }

    @Test
    void anUpheldPenaltyCountsAgainstTheMemberAndAWaivedOneDoesNot() {
        contribution(days(-30), "500", "500", instant(-30));
        penalty(PenaltyStatus.WAIVED);
        int waived = creditScoreService.calculate(chamaId, memberId).score();

        reseed();
        contribution(days(-30), "500", "500", instant(-30));
        penalty(PenaltyStatus.APPROVED);
        int upheld = creditScoreService.calculate(chamaId, memberId).score();

        // A waiver is the chama deciding the penalty should not have counted.
        assertTrue(upheld < waived, "an upheld penalty must cost something: " + upheld + " vs " + waived);
    }

    @Test
    void havingNoPenaltiesEarnsNoBonus() {
        contribution(days(-30), "500", "500", instant(-30));

        CreditScoreDto result = creditScoreService.calculate(chamaId, memberId);

        // Penalties only ever count in one direction. Were they a scored component, "has never
        // been penalised" would describe nearly every member and quietly lift all of them.
        assertEquals(0, result.penaltyDeduction());
        assertEquals((int) Math.round(result.contributionConsistency() * 100), result.score());
    }

    @Test
    void theDeductionForPenaltiesIsCapped() {
        contribution(days(-30), "500", "500", instant(-30));
        for (int i = 0; i < 12; i++) {
            penalty(PenaltyStatus.APPROVED);
        }

        CreditScoreDto result = creditScoreService.calculate(chamaId, memberId);

        // Twelve penalties are a bad record, but the deduction must not run the score to zero on
        // its own and drown out everything the member did right.
        assertEquals(25, result.penaltyDeduction());
    }

    @Test
    void aSettledPenaltyStillCountsBecauseItWasUpheld() {
        contribution(days(-30), "500", "500", instant(-30));
        penalty(PenaltyStatus.PAID);

        assertTrue(creditScoreService.calculate(chamaId, memberId).penaltyDeduction() > 0);
    }

    @Test
    void aPendingPenaltyDoesNotPreEmptTheChamasOwnDecision() {
        contribution(days(-30), "500", "500", instant(-30));
        penalty(PenaltyStatus.PENDING);
        int pending = creditScoreService.calculate(chamaId, memberId).score();

        reseed();
        contribution(days(-30), "500", "500", instant(-30));
        int none = creditScoreService.calculate(chamaId, memberId).score();

        assertEquals(none, pending);
    }

    @Test
    void aDefaultedLoanCapsTheScoreHoweverGoodTheRestOfTheRecordIs() {
        for (int month = 1; month <= 12; month++) {
            contribution(days(-30 * month), "500", "500", instant(-30 * month));
        }
        int spotless = creditScoreService.calculate(chamaId, memberId).score();
        assertTrue(spotless > 80, "expected a strong score to cap, got " + spotless);

        loan(LoanStatus.DEFAULTED);
        CreditScoreDto result = creditScoreService.calculate(chamaId, memberId);

        assertTrue(result.hasDefaultedLoan());
        assertTrue(result.score() <= 40, "a default must cap the score, got " + result.score());
        assertEquals(CreditScoreBand.POOR, result.band());
    }

    @Test
    void reportsDebtAndSavingsSoTheTwoCanBeWeighedAgainstEachOther() {
        contribution(days(-30), "500", "500", instant(-30));
        Long loanId = loan(LoanStatus.REPAYING);
        repayment(loanId, 1, days(-30), "900", "400", null);
        repayment(loanId, 2, days(30), "900", "0", null);

        CreditScoreDto result = creditScoreService.calculate(chamaId, memberId);

        assertEquals(0, new BigDecimal("500.00").compareTo(result.totalSavings()));
        // Both installments are still owed money, including the one not yet due.
        assertEquals(0, new BigDecimal("1400.00").compareTo(result.outstandingDebt()));
    }

    @Test
    void aClearedLoanIsNotCountedAsOutstandingDebt() {
        Long loanId = loan(LoanStatus.CLOSED);
        repayment(loanId, 1, days(-30), "900", "900", instant(-30));

        assertEquals(0, BigDecimal.ZERO.compareTo(creditScoreService.calculate(chamaId, memberId).outstandingDebt()));
    }

    @Test
    void namesTheComponentsBehindTheScoreSoItCanBeExplained() {
        contribution(days(-30), "500", "500", instant(-30));
        contribution(days(-60), "500", "500", instant(-60));
        attendance(AttendanceStatus.ABSENT, days(-10));
        attendance(AttendanceStatus.ABSENT, days(-20));
        attendance(AttendanceStatus.ABSENT, days(-30));
        attendance(AttendanceStatus.ABSENT, days(-40));

        CreditScoreDto result = creditScoreService.calculate(chamaId, memberId);

        assertTrue(result.strengths().stream().anyMatch(f -> f.code().equals("CONTRIBUTION_CONSISTENCY")));
        assertTrue(result.weaknesses().stream().anyMatch(f -> f.code().equals("MEETING_ATTENDANCE")));
        // Weights are reported as the share actually applied, after redistribution over the
        // components that had evidence, so they add up for the caller.
        assertTrue(result.strengths().stream().allMatch(f -> f.weight() > 0 && f.weight() <= 1));
    }

    @Test
    void theBatchAndSingleMemberPathsAgree() {
        contribution(days(-30), "500", "250", instant(-25));
        attendance(AttendanceStatus.PRESENT, days(-10));
        Long loanId = loan(LoanStatus.REPAYING);
        repayment(loanId, 1, days(-30), "900", "900", instant(-28));

        CreditScoreDto single = creditScoreService.calculate(chamaId, memberId);
        List<CreditScoreDto> all = creditScoreService.calculateAll(chamaId);

        assertEquals(1, all.size());
        assertEquals(single, all.get(0));
    }

    @Test
    void theBatchSkipsExitedMembersAndScoresEachRemainingMemberSeparately() {
        contribution(days(-30), "500", "500", instant(-30));
        Long second = extraMember("credit-score-member-2", "254700000502", MemberStatus.ACTIVE);
        Long exited = extraMember("credit-score-member-3", "254700000503", MemberStatus.EXITED);
        contributionFor(second, days(-30), "500", "0");
        contributionFor(exited, days(-30), "500", "0");

        List<CreditScoreDto> all = creditScoreService.calculateAll(chamaId);

        assertEquals(2, all.size());
        assertTrue(all.stream().noneMatch(s -> s.memberId().equals(exited)));
        CreditScoreDto payer = all.stream().filter(s -> s.memberId().equals(memberId)).findFirst().orElseThrow();
        CreditScoreDto defaulter = all.stream().filter(s -> s.memberId().equals(second)).findFirst().orElseThrow();
        assertTrue(defaulter.score() < payer.score());
    }

    private static LocalDate days(int offset) {
        return LocalDate.now(ZoneId.of("Africa/Nairobi")).plusDays(offset);
    }

    private static Instant instant(int daysOffset) {
        return days(daysOffset).atStartOfDay(ZoneId.of("Africa/Nairobi")).toInstant();
    }

    private void reseed() {
        seed();
    }

    private void contribution(LocalDate period, String due, String paid, Instant paidAt) {
        contributionFor(memberId, period, due, paid, paidAt);
    }

    private void contributionFor(Long member, LocalDate period, String due, String paid) {
        contributionFor(member, period, due, paid, null);
    }

    private void contributionFor(Long member, LocalDate period, String due, String paid, Instant paidAt) {
        QuarkusTransaction.requiringNew().run(() -> {
            Contribution contribution = new Contribution();
            contribution.chama = chamaRepository.findById(chamaId);
            contribution.member = memberRepository.findById(member);
            contribution.period = period;
            contribution.amountDue = new BigDecimal(due);
            contribution.amountPaid = new BigDecimal(paid);
            contribution.paidAt = paidAt;
            contribution.status = contribution.amountPaid.signum() == 0
                ? ContributionStatus.PENDING
                : contribution.amountPaid.compareTo(contribution.amountDue) >= 0
                    ? ContributionStatus.PAID
                    : ContributionStatus.PARTIAL;
            contributionRepository.persist(contribution);
        });
    }

    private void attendance(AttendanceStatus status, LocalDate meetingDate) {
        QuarkusTransaction.requiringNew().run(() -> {
            Meeting meeting = new Meeting();
            meeting.chama = chamaRepository.findById(chamaId);
            meeting.meetingDate = meetingDate;
            meeting.agenda = "Monthly meeting";
            meetingRepository.persist(meeting);

            MeetingAttendance record = new MeetingAttendance();
            record.meeting = meeting;
            record.member = memberRepository.findById(memberId);
            record.status = status;
            meetingAttendanceRepository.persist(record);
        });
    }

    private Long loan(LoanStatus status) {
        return QuarkusTransaction.requiringNew().call(() -> {
            Loan loan = new Loan();
            loan.chama = chamaRepository.findById(chamaId);
            loan.member = memberRepository.findById(memberId);
            loan.principal = new BigDecimal("5000");
            loan.interestRate = new BigDecimal("0");
            loan.interestMethod = InterestMethod.FLAT;
            loan.termMonths = 6;
            loan.status = status;
            loanRepository.persist(loan);
            return loan.id;
        });
    }

    private void repayment(Long loanId, int installmentNumber, LocalDate scheduledDate,
                           String due, String paid, Instant paidAt) {
        QuarkusTransaction.requiringNew().run(() -> {
            LoanRepayment repayment = new LoanRepayment();
            repayment.loan = loanRepository.findById(loanId);
            repayment.installmentNumber = installmentNumber;
            repayment.scheduledDate = scheduledDate;
            repayment.amountDue = new BigDecimal(due);
            repayment.amountPaid = new BigDecimal(paid);
            repayment.paidAt = paidAt;
            repayment.status = repayment.amountPaid.signum() == 0
                ? LoanRepaymentStatus.PENDING
                : repayment.amountPaid.compareTo(repayment.amountDue) >= 0
                    ? LoanRepaymentStatus.PAID
                    : LoanRepaymentStatus.PARTIAL;
            loanRepaymentRepository.persist(repayment);
        });
    }

    private void penalty(PenaltyStatus status) {
        QuarkusTransaction.requiringNew().run(() -> {
            Penalty penalty = new Penalty();
            penalty.chama = chamaRepository.findById(chamaId);
            penalty.member = memberRepository.findById(memberId);
            penalty.reason = PenaltyReason.LATE_CONTRIBUTION;
            penalty.amount = new BigDecimal("100");
            penalty.status = status;
            penaltyRepository.persist(penalty);
        });
    }

    private Long extraMember(String keycloakUserId, String phone, MemberStatus status) {
        return QuarkusTransaction.requiringNew().call(() -> {
            Member member = new Member();
            member.chama = chamaRepository.findById(chamaId);
            member.keycloakUserId = keycloakUserId;
            member.fullName = "Second Member";
            member.phone = phone;
            member.status = status;
            memberRepository.persist(member);
            return member.id;
        });
    }
}
