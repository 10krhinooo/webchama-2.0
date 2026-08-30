package org.chama.rest;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import jakarta.inject.Inject;
import org.chama.domain.enums.ChamaStatus;
import org.chama.domain.enums.ChamaType;
import org.chama.domain.enums.ContributionFrequency;
import org.chama.domain.enums.ContributionStatus;
import org.chama.domain.enums.InterestMethod;
import org.chama.domain.enums.LoanRepaymentStatus;
import org.chama.domain.enums.LoanStatus;
import org.chama.domain.enums.MemberRoleType;
import org.chama.domain.enums.MemberStatus;
import org.chama.domain.enums.PayoutStatus;
import org.chama.domain.enums.PenaltyReason;
import org.chama.domain.enums.PenaltyStatus;
import org.chama.domain.model.Chama;
import org.chama.domain.model.Contribution;
import org.chama.domain.model.Loan;
import org.chama.domain.model.LoanRepayment;
import org.chama.domain.model.Member;
import org.chama.domain.model.MemberRole;
import org.chama.domain.model.Payout;
import org.chama.domain.model.Penalty;
import org.chama.TestDataCleaner;
import org.chama.repository.ActivityLogRepository;
import org.chama.repository.ApprovalRepository;
import org.chama.repository.ChamaRepository;
import org.chama.repository.DocumentDeliveryAttemptRepository;
import org.chama.repository.GeneratedDocumentRepository;
import org.chama.repository.LoanDisbursementRepository;
import org.chama.repository.MeetingAttendanceRepository;
import org.chama.repository.MeetingRepository;
import org.chama.repository.MemberRoleRepository;
import org.chama.repository.PaymentRepository;
import org.chama.repository.PayoutScheduleRepository;
import org.chama.repository.WelfareContributionRepository;
import org.chama.repository.WelfareFundRepository;
import org.chama.repository.WelfareWithdrawalRepository;
import org.chama.repository.ContributionRepository;
import org.chama.repository.LoanRepaymentRepository;
import org.chama.repository.LoanRepository;
import org.chama.repository.MemberRepository;
import org.chama.repository.PayoutRepository;
import org.chama.repository.PenaltyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.nullValue;

@QuarkusTest
class MemberSummaryResourceTest {

    private static final ZoneId NAIROBI = ZoneId.of("Africa/Nairobi");

    @Inject TestDataCleaner testDataCleaner;
    @Inject ChamaRepository chamaRepository;
    @Inject ActivityLogRepository activityLogRepository;
    @Inject ApprovalRepository approvalRepository;
    @Inject DocumentDeliveryAttemptRepository documentDeliveryAttemptRepository;
    @Inject GeneratedDocumentRepository generatedDocumentRepository;
    @Inject LoanDisbursementRepository loanDisbursementRepository;
    @Inject MeetingAttendanceRepository meetingAttendanceRepository;
    @Inject MeetingRepository meetingRepository;
    @Inject MemberRoleRepository memberRoleRepository;
    @Inject PaymentRepository paymentRepository;
    @Inject PayoutScheduleRepository payoutScheduleRepository;
    @Inject WelfareContributionRepository welfareContributionRepository;
    @Inject WelfareFundRepository welfareFundRepository;
    @Inject WelfareWithdrawalRepository welfareWithdrawalRepository;
    @Inject MemberRepository memberRepository;
    @Inject ContributionRepository contributionRepository;
    @Inject LoanRepository loanRepository;
    @Inject LoanRepaymentRepository loanRepaymentRepository;
    @Inject PenaltyRepository penaltyRepository;
    @Inject PayoutRepository payoutRepository;

    private Long chamaId;
    private Long memberId;
    private Long otherMemberId;

    @BeforeEach
    void seed() {
        QuarkusTransaction.requiringNew().run(() -> {
            testDataCleaner.deleteAll();

            Chama chama = new Chama();
            chama.name = "Portal Chama";
            chama.type = ChamaType.MERRY_GO_ROUND;
            chama.currency = "KES";
            chama.contributionFrequency = ContributionFrequency.MONTHLY;
            chama.contributionAmount = new BigDecimal("500");
            chama.status = ChamaStatus.ACTIVE;
            chamaRepository.persist(chama);
            chamaId = chama.id;

            memberId = member(chama, "portal-member", "Portal Member", "254700000901");
            otherMemberId = member(chama, "portal-other", "Other Member", "254700000902");
        });
    }

    private Long member(Chama chama, String userId, String name, String phone) {
        Member member = new Member();
        member.chama = chama;
        member.keycloakUserId = userId;
        member.fullName = name;
        member.phone = phone;
        member.status = MemberStatus.ACTIVE;
        memberRepository.persist(member);
        MemberRole role = new MemberRole();
        role.member = member;
        role.role = MemberRoleType.MEMBER;
        role.persist();
        return member.id;
    }

    @Test
    @TestSecurity(user = "portal-member")
    void aBrandNewMemberSeesZerosRatherThanNulls() {
        given()
            .when().get("/api/chamas/{chamaId}/members/mine/summary", chamaId)
            .then()
                .statusCode(200)
                .body("fullName", equalTo("Portal Member"))
                .body("currency", equalTo("KES"))
                .body("contributedTotal", equalTo(0.0f))
                .body("contributionsOutstanding", equalTo(0.0f))
                .body("activeLoanCount", equalTo(0))
                // Nothing scheduled is null rather than a zero date, which would read as a real one.
                .body("nextContributionDue", nullValue())
                .body("nextRepaymentDue", nullValue())
                .body("nextPayoutRound", nullValue())
                // Nothing recorded means no score, not a flattering one.
                .body("creditScore", nullValue())
                .body("creditScoreBand", equalTo("INSUFFICIENT_HISTORY"));
    }

    @Test
    @TestSecurity(user = "portal-member")
    void aMemberSeesTheirOwnCreditScoreOnceThereIsSomethingToJudge() {
        for (int month = 1; month <= 6; month++) {
            contribution(memberId, LocalDate.now(NAIROBI).minusMonths(month), "500", "500");
        }

        given()
            .when().get("/api/chamas/{chamaId}/members/mine/summary", chamaId)
            .then()
                .statusCode(200)
                // Their own score is theirs to see, unlike the chama-wide table.
                .body("creditScore", org.hamcrest.Matchers.greaterThan(0))
                .body("creditScoreBand", org.hamcrest.Matchers.not("INSUFFICIENT_HISTORY"));
    }

    @Test
    @TestSecurity(user = "portal-member")
    void contributionTotalsCountOnlyWhatHasComeDue() {
        contribution(memberId, LocalDate.now(NAIROBI).minusMonths(2), "500", "500");
        contribution(memberId, LocalDate.now(NAIROBI).minusMonths(1), "500", "200");
        contribution(memberId, LocalDate.now(NAIROBI).plusMonths(1), "500", "0");

        given()
            .when().get("/api/chamas/{chamaId}/members/mine/summary", chamaId)
            .then()
                .statusCode(200)
                .body("contributedTotal", equalTo(700.0f))
                // The future one is not owed yet, so only the 300 still due counts.
                .body("contributionsOutstanding", equalTo(300.0f))
                .body("overdueContributionCount", equalTo(1));
    }

    @Test
    @TestSecurity(user = "portal-member")
    void theNextContributionIsTheSoonestUnsettledOneEvenIfItIsAlreadyLate() {
        contribution(memberId, LocalDate.now(NAIROBI).minusMonths(1), "500", "100");
        contribution(memberId, LocalDate.now(NAIROBI).plusMonths(1), "500", "0");

        given()
            .when().get("/api/chamas/{chamaId}/members/mine/summary", chamaId)
            .then()
                .statusCode(200)
                // Showing only future obligations would hide the one most worth acting on.
                .body("nextContributionDue", equalTo(LocalDate.now(NAIROBI).minusMonths(1).toString()))
                .body("nextContributionAmount", equalTo(400.0f));
    }

    @Test
    @TestSecurity(user = "portal-member")
    void loanFiguresCountOnlyLiveLoans() {
        Long live = loan(LoanStatus.REPAYING);
        Long closed = loan(LoanStatus.CLOSED);
        repayment(live, 1, LocalDate.now(NAIROBI).minusDays(5), "900", "400");
        repayment(live, 2, LocalDate.now(NAIROBI).plusMonths(1), "900", "0");
        repayment(closed, 1, LocalDate.now(NAIROBI).minusMonths(6), "900", "900");

        given()
            .when().get("/api/chamas/{chamaId}/members/mine/summary", chamaId)
            .then()
                .statusCode(200)
                .body("activeLoanCount", equalTo(1))
                .body("loanOutstanding", equalTo(1400.0f))
                .body("nextRepaymentDue", equalTo(LocalDate.now(NAIROBI).minusDays(5).toString()))
                .body("nextRepaymentAmount", equalTo(500.0f));
    }

    @Test
    @TestSecurity(user = "portal-member")
    void onlyPenaltiesTheChamaHasActuallyUpheldAreShownAsOwed() {
        penalty(memberId, PenaltyStatus.APPROVED, "100");
        penalty(memberId, PenaltyStatus.PENDING, "200");
        penalty(memberId, PenaltyStatus.WAIVED, "300");
        penalty(memberId, PenaltyStatus.PAID, "400");

        given()
            .when().get("/api/chamas/{chamaId}/members/mine/summary", chamaId)
            .then()
                .statusCode(200)
                // A pending penalty has not been decided, and telling a member they owe money the
                // chama has not agreed they owe would pre-empt that decision.
                .body("outstandingPenaltyCount", equalTo(1))
                .body("outstandingPenaltyTotal", equalTo(100.0f));
    }

    @Test
    @TestSecurity(user = "portal-member")
    void payoutFiguresSeparateWhatWasReceivedFromWhatIsComing() {
        payout(memberId, 1, LocalDate.now(NAIROBI).minusMonths(2), PayoutStatus.DISBURSED);
        payout(memberId, 2, LocalDate.now(NAIROBI).plusMonths(1), PayoutStatus.SCHEDULED);

        given()
            .when().get("/api/chamas/{chamaId}/members/mine/summary", chamaId)
            .then()
                .statusCode(200)
                .body("payoutsReceived", equalTo(1))
                .body("nextPayoutRound", equalTo(2))
                .body("nextPayoutDate", equalTo(LocalDate.now(NAIROBI).plusMonths(1).toString()));
    }

    @Test
    @TestSecurity(user = "portal-member")
    void oneMembersSummaryNeverIncludesAnotherMembersMoney() {
        contribution(memberId, LocalDate.now(NAIROBI).minusMonths(1), "500", "500");
        contribution(otherMemberId, LocalDate.now(NAIROBI).minusMonths(1), "500", "500");
        penalty(otherMemberId, PenaltyStatus.APPROVED, "999");

        given()
            .when().get("/api/chamas/{chamaId}/members/mine/summary", chamaId)
            .then()
                .statusCode(200)
                .body("memberId", equalTo(memberId.intValue()))
                .body("contributedTotal", equalTo(500.0f))
                .body("outstandingPenaltyTotal", equalTo(0.0f));
    }

    @Test
    @TestSecurity(user = "not-a-member")
    void someoneWithNoMembershipHasNoSummary() {
        given()
            .when().get("/api/chamas/{chamaId}/members/mine/summary", chamaId)
            .then().statusCode(403);
    }

    private void contribution(Long member, LocalDate period, String due, String paid) {
        QuarkusTransaction.requiringNew().run(() -> {
            Contribution contribution = new Contribution();
            contribution.chama = chamaRepository.findById(chamaId);
            contribution.member = memberRepository.findById(member);
            contribution.period = period;
            contribution.amountDue = new BigDecimal(due);
            contribution.amountPaid = new BigDecimal(paid);
            contribution.status = contribution.amountPaid.compareTo(contribution.amountDue) >= 0
                ? ContributionStatus.PAID
                : contribution.amountPaid.signum() == 0 ? ContributionStatus.PENDING : ContributionStatus.PARTIAL;
            contributionRepository.persist(contribution);
        });
    }

    private Long loan(LoanStatus status) {
        return QuarkusTransaction.requiringNew().call(() -> {
            Loan loan = new Loan();
            loan.chama = chamaRepository.findById(chamaId);
            loan.member = memberRepository.findById(memberId);
            loan.principal = new BigDecimal("5000");
            loan.interestRate = BigDecimal.ZERO;
            loan.interestMethod = InterestMethod.FLAT;
            loan.termMonths = 6;
            loan.status = status;
            loanRepository.persist(loan);
            return loan.id;
        });
    }

    private void repayment(Long loanId, int number, LocalDate scheduled, String due, String paid) {
        QuarkusTransaction.requiringNew().run(() -> {
            LoanRepayment repayment = new LoanRepayment();
            repayment.loan = loanRepository.findById(loanId);
            repayment.installmentNumber = number;
            repayment.scheduledDate = scheduled;
            repayment.amountDue = new BigDecimal(due);
            repayment.amountPaid = new BigDecimal(paid);
            repayment.status = repayment.amountPaid.compareTo(repayment.amountDue) >= 0
                ? LoanRepaymentStatus.PAID
                : repayment.amountPaid.signum() == 0 ? LoanRepaymentStatus.PENDING : LoanRepaymentStatus.PARTIAL;
            loanRepaymentRepository.persist(repayment);
        });
    }

    private void penalty(Long member, PenaltyStatus status, String amount) {
        QuarkusTransaction.requiringNew().run(() -> {
            Penalty penalty = new Penalty();
            penalty.chama = chamaRepository.findById(chamaId);
            penalty.member = memberRepository.findById(member);
            penalty.reason = PenaltyReason.LATE_CONTRIBUTION;
            penalty.amount = new BigDecimal(amount);
            penalty.status = status;
            penaltyRepository.persist(penalty);
        });
    }

    private void payout(Long member, int round, LocalDate scheduled, PayoutStatus status) {
        QuarkusTransaction.requiringNew().run(() -> {
            Payout payout = new Payout();
            payout.chama = chamaRepository.findById(chamaId);
            payout.member = memberRepository.findById(member);
            payout.roundNumber = round;
            payout.scheduledDate = scheduled;
            payout.amount = new BigDecimal("5000");
            payout.status = status;
            payoutRepository.persist(payout);
        });
    }
}
