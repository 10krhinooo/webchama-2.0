package org.chama.rest;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import jakarta.inject.Inject;
import org.chama.domain.enums.AttendanceStatus;
import org.chama.domain.enums.ChamaStatus;
import org.chama.domain.enums.ChamaType;
import org.chama.domain.enums.ContributionFrequency;
import org.chama.domain.enums.ContributionStatus;
import org.chama.domain.enums.InterestMethod;
import org.chama.domain.enums.LoanRepaymentStatus;
import org.chama.domain.enums.LoanStatus;
import org.chama.domain.enums.MemberRoleType;
import org.chama.domain.enums.MemberStatus;
import org.chama.domain.model.Chama;
import org.chama.domain.model.Contribution;
import org.chama.domain.model.Loan;
import org.chama.domain.model.LoanRepayment;
import org.chama.domain.model.Meeting;
import org.chama.domain.model.MeetingAttendance;
import org.chama.domain.model.Member;
import org.chama.domain.model.MemberRole;
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
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.nullValue;

@QuarkusTest
class AnalyticsResourceTest {

    private static final ZoneId NAIROBI = ZoneId.of("Africa/Nairobi");

    @Inject ChamaRepository chamaRepository;
    @Inject MemberRepository memberRepository;
    @Inject MemberRoleRepository memberRoleRepository;
    @Inject ContributionRepository contributionRepository;
    @Inject LoanRepository loanRepository;
    @Inject LoanRepaymentRepository loanRepaymentRepository;
    @Inject MeetingRepository meetingRepository;
    @Inject MeetingAttendanceRepository meetingAttendanceRepository;
    @Inject ActivityLogRepository activityLogRepository;
    @Inject ApprovalRepository approvalRepository;
    @Inject DocumentDeliveryAttemptRepository documentDeliveryAttemptRepository;
    @Inject GeneratedDocumentRepository generatedDocumentRepository;
    @Inject LoanDisbursementRepository loanDisbursementRepository;
    @Inject PaymentRepository paymentRepository;
    @Inject PayoutRepository payoutRepository;
    @Inject PayoutScheduleRepository payoutScheduleRepository;
    @Inject PenaltyRepository penaltyRepository;
    @Inject WelfareContributionRepository welfareContributionRepository;
    @Inject WelfareFundRepository welfareFundRepository;
    @Inject WelfareWithdrawalRepository welfareWithdrawalRepository;

    private Long chamaId;
    private Long treasurerId;
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
            memberRoleRepository.deleteAll();
            memberRepository.deleteAll();
            activityLogRepository.deleteAll();
            chamaRepository.deleteAll();

            Chama chama = new Chama();
            chama.name = "Analytics Chama";
            chama.type = ChamaType.TABLE_BANKING;
            chama.currency = "KES";
            chama.contributionFrequency = ContributionFrequency.MONTHLY;
            chama.contributionAmount = new BigDecimal("500");
            chama.status = ChamaStatus.ACTIVE;
            chamaRepository.persist(chama);
            chamaId = chama.id;

            treasurerId = member(chama, "analytics-treasurer", "Treasurer", "254700000701",
                MemberRoleType.TREASURER, MemberStatus.ACTIVE);
            memberId = member(chama, "analytics-member", "Plain Member", "254700000702",
                MemberRoleType.MEMBER, MemberStatus.ACTIVE);
            member(chama, "analytics-secretary", "Secretary", "254700000703",
                MemberRoleType.SECRETARY, MemberStatus.ACTIVE);
        });
    }

    private Long member(Chama chama, String userId, String name, String phone,
                        MemberRoleType role, MemberStatus status) {
        Member member = new Member();
        member.chama = chama;
        member.keycloakUserId = userId;
        member.fullName = name;
        member.phone = phone;
        member.status = status;
        memberRepository.persist(member);
        MemberRole memberRole = new MemberRole();
        memberRole.member = member;
        memberRole.role = role;
        memberRole.persist();
        return member.id;
    }

    @Test
    @TestSecurity(user = "analytics-treasurer")
    void aChamaWithNothingRecordedGetsNoHealthScoreRatherThanAFlatteringOne() {
        given()
            .when().get("/api/chamas/{chamaId}/analytics/health", chamaId)
            .then()
                .statusCode(200)
                .body("score", nullValue())
                .body("band", equalTo("INSUFFICIENT_HISTORY"))
                .body("components.size()", equalTo(0));
    }

    @Test
    @TestSecurity(user = "analytics-treasurer")
    void componentsTheChamaRecordsNothingForAreDroppedRatherThanScoredAsAPass() {
        contribution(memberId, LocalDate.now(NAIROBI).minusMonths(1), "500", "500");

        given()
            .when().get("/api/chamas/{chamaId}/analytics/health", chamaId)
            .then()
                .statusCode(200)
                // Contributions, arrears and membership have evidence. Loans and attendance do
                // not, and must not hand the chama their weight for free.
                .body("components.code", hasItems("COLLECTION_RATE", "ARREARS_HEALTH", "MEMBERSHIP_STABILITY"))
                .body("components.findAll { it.code == 'LOAN_REPAYMENT' }.size()", equalTo(0))
                .body("components.findAll { it.code == 'MEETING_ATTENDANCE' }.size()", equalTo(0));
    }

    @Test
    @TestSecurity(user = "analytics-treasurer")
    void theReportedWeightsAlwaysAddUpToOne() {
        contribution(memberId, LocalDate.now(NAIROBI).minusMonths(1), "500", "500");

        float total = given()
            .when().get("/api/chamas/{chamaId}/analytics/health", chamaId)
            .then().statusCode(200)
            .extract().jsonPath().getList("components.weight", Float.class)
            .stream().reduce(0f, Float::sum);

        // Redistribution is only legible to a caller if the shares it receives are complete.
        org.junit.jupiter.api.Assertions.assertEquals(1.0f, total, 0.02f);
    }

    @Test
    @TestSecurity(user = "analytics-treasurer")
    void aChamaThatCollectsEverythingScoresBetterThanOneThatCollectsNothing() {
        contribution(memberId, LocalDate.now(NAIROBI).minusMonths(1), "500", "500");
        int paid = given().when().get("/api/chamas/{chamaId}/analytics/health", chamaId)
            .then().statusCode(200).extract().path("score");

        QuarkusTransaction.requiringNew().run(() -> contributionRepository.deleteAll());
        contribution(memberId, LocalDate.now(NAIROBI).minusMonths(1), "500", "0");
        int unpaid = given().when().get("/api/chamas/{chamaId}/analytics/health", chamaId)
            .then().statusCode(200).extract().path("score");

        org.junit.jupiter.api.Assertions.assertTrue(unpaid < paid,
            "unpaid must score below paid: " + unpaid + " vs " + paid);
    }

    @Test
    @TestSecurity(user = "analytics-treasurer")
    void headlineFiguresCountMembersInArrearsAndWhatIsOwed() {
        contribution(memberId, LocalDate.now(NAIROBI).minusMonths(2), "500", "100");

        given()
            .when().get("/api/chamas/{chamaId}/analytics/health", chamaId)
            .then()
                .statusCode(200)
                .body("activeMembers", equalTo(3))
                .body("membersInArrears", equalTo(1))
                .body("totalOutstandingArrears", equalTo(400.0f));
    }

    @Test
    @TestSecurity(user = "analytics-treasurer")
    void theTrendReturnsEveryMonthInTheWindowIncludingEmptyOnes() {
        contribution(memberId, LocalDate.now(NAIROBI).withDayOfMonth(1), "500", "300");

        given()
            .queryParam("months", 6)
            .when().get("/api/chamas/{chamaId}/analytics/contribution-trend", chamaId)
            .then()
                .statusCode(200)
                // A chart that silently drops its empty months reads as a different shape.
                .body("size()", equalTo(6))
                .body("[5].month", equalTo(YearMonth.now(NAIROBI).toString()))
                .body("[5].expected", equalTo(500.0f))
                .body("[5].collected", equalTo(300.0f))
                .body("[0].expected", equalTo(0.0f));
    }

    @Test
    @TestSecurity(user = "analytics-treasurer")
    void theTrendWindowIsBounded() {
        given()
            .queryParam("months", 500)
            .when().get("/api/chamas/{chamaId}/analytics/contribution-trend", chamaId)
            .then().statusCode(200).body("size()", equalTo(36));

        given()
            .queryParam("months", 0)
            .when().get("/api/chamas/{chamaId}/analytics/contribution-trend", chamaId)
            .then().statusCode(200).body("size()", equalTo(1));
    }

    @Test
    @TestSecurity(user = "analytics-treasurer")
    void arrearsAlwaysReturnAllFourBucketsAndAgeDebtIntoTheRightOne() {
        contribution(memberId, LocalDate.now(NAIROBI).minusDays(10), "500", "0");
        contribution(treasurerId, LocalDate.now(NAIROBI).minusDays(100), "800", "300");

        given()
            .when().get("/api/chamas/{chamaId}/analytics/arrears", chamaId)
            .then()
                .statusCode(200)
                .body("size()", equalTo(4))
                .body("bucket", equalTo(java.util.List.of("1-30", "31-60", "61-90", "90+")))
                .body("[0].amount", equalTo(500.0f))
                .body("[1].amount", equalTo(0.0f))
                .body("[3].amount", equalTo(500.0f));
    }

    @Test
    @TestSecurity(user = "analytics-treasurer")
    void theLoanPortfolioBreaksDownByStatusWithWhatIsStillOwed() {
        Long loanId = loan(LoanStatus.REPAYING, "5000");
        repayment(loanId, 1, LocalDate.now(NAIROBI).minusMonths(1), "900", "900");
        repayment(loanId, 2, LocalDate.now(NAIROBI).plusMonths(1), "900", "0");

        given()
            .when().get("/api/chamas/{chamaId}/analytics/loan-portfolio", chamaId)
            .then()
                .statusCode(200)
                .body("size()", equalTo(1))
                .body("[0].status", equalTo("REPAYING"))
                .body("[0].loans", equalTo(1))
                .body("[0].outstanding", equalTo(900.0f));
    }

    @Test
    @TestSecurity(user = "analytics-treasurer")
    void attendanceCountsTowardHealthOnceMeetingsExist() {
        contribution(memberId, LocalDate.now(NAIROBI).minusMonths(1), "500", "500");
        attendance(AttendanceStatus.PRESENT);
        attendance(AttendanceStatus.ABSENT);

        given()
            .when().get("/api/chamas/{chamaId}/analytics/health", chamaId)
            .then()
                .statusCode(200)
                .body("components.code", hasItems("MEETING_ATTENDANCE"))
                .body("components.find { it.code == 'MEETING_ATTENDANCE' }.rate", equalTo(0.5f));
    }

    @Test
    @TestSecurity(user = "analytics-secretary")
    void aSecretaryCanPresentTheTrendButNotReadArrearsOrTheLoanBook() {
        given()
            .when().get("/api/chamas/{chamaId}/analytics/contribution-trend", chamaId)
            .then().statusCode(200);

        // Arrears and the loan book are per-member debt however they are aggregated.
        given().when().get("/api/chamas/{chamaId}/analytics/arrears", chamaId).then().statusCode(403);
        given().when().get("/api/chamas/{chamaId}/analytics/loan-portfolio", chamaId).then().statusCode(403);
        given().when().get("/api/chamas/{chamaId}/analytics/health", chamaId).then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "analytics-member")
    void aPlainMemberCannotReadAnyAnalytics() {
        given().when().get("/api/chamas/{chamaId}/analytics/health", chamaId).then().statusCode(403);
        given().when().get("/api/chamas/{chamaId}/analytics/contribution-trend", chamaId).then().statusCode(403);
        given().when().get("/api/chamas/{chamaId}/analytics/arrears", chamaId).then().statusCode(403);
        given().when().get("/api/chamas/{chamaId}/analytics/loan-portfolio", chamaId).then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "outsider")
    void someoneWithNoMembershipCannotReadAnalytics() {
        given().when().get("/api/chamas/{chamaId}/analytics/health", chamaId).then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "analytics-treasurer")
    void aHealthyChamaScoresWell() {
        for (int month = 1; month <= 6; month++) {
            contribution(memberId, LocalDate.now(NAIROBI).minusMonths(month), "500", "500");
            contribution(treasurerId, LocalDate.now(NAIROBI).minusMonths(month), "500", "500");
        }
        attendance(AttendanceStatus.PRESENT);

        int score = given().when().get("/api/chamas/{chamaId}/analytics/health", chamaId)
            .then().statusCode(200).extract().path("score");

        org.junit.jupiter.api.Assertions.assertTrue(score > 80, "expected a strong score, got " + score);
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

    private Long loan(LoanStatus status, String principal) {
        return QuarkusTransaction.requiringNew().call(() -> {
            Loan loan = new Loan();
            loan.chama = chamaRepository.findById(chamaId);
            loan.member = memberRepository.findById(memberId);
            loan.principal = new BigDecimal(principal);
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
                ? LoanRepaymentStatus.PAID : LoanRepaymentStatus.PENDING;
            loanRepaymentRepository.persist(repayment);
        });
    }

    private void attendance(AttendanceStatus status) {
        QuarkusTransaction.requiringNew().run(() -> {
            Meeting meeting = new Meeting();
            meeting.chama = chamaRepository.findById(chamaId);
            meeting.meetingDate = LocalDate.now(NAIROBI).minusDays(7);
            meeting.agenda = "Monthly meeting";
            meetingRepository.persist(meeting);

            MeetingAttendance record = new MeetingAttendance();
            record.meeting = meeting;
            record.member = memberRepository.findById(memberId);
            record.status = status;
            meetingAttendanceRepository.persist(record);
        });
    }
}
