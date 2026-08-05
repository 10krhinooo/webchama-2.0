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
import org.chama.domain.enums.LoanStatus;
import org.chama.domain.enums.MemberStatus;
import org.chama.domain.enums.PaymentMethod;
import org.chama.domain.enums.PaymentPurpose;
import org.chama.domain.enums.PaymentStatus;
import org.chama.domain.model.Chama;
import org.chama.domain.model.Contribution;
import org.chama.domain.model.Loan;
import org.chama.domain.model.Member;
import org.chama.domain.model.Payment;
import org.chama.repository.ChamaRepository;
import org.chama.repository.ContributionRepository;
import org.chama.repository.LoanRepository;
import org.chama.repository.MemberRepository;
import org.chama.repository.PaymentRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;

/**
 * Asserts against the increase this test's own fixture causes, not absolute totals, since the
 * platform overview aggregates across every chama in the database and other test classes leave
 * their own rows behind (same convention other cross-tenant resources like SecurityEventResource
 * already accept, this endpoint is deliberately not tenant-scoped).
 */
@QuarkusTest
class PlatformOverviewResourceTest {

    @Inject
    ChamaRepository chamaRepository;

    @Inject
    MemberRepository memberRepository;

    @Inject
    ContributionRepository contributionRepository;

    @Inject
    LoanRepository loanRepository;

    @Inject
    PaymentRepository paymentRepository;

    @Test
    @TestSecurity(user = "super-admin-overview-1", roles = "SUPER_ADMIN")
    void superAdminSeesPlatformWideAggregatesIncreaseByTheFixtureSeeded() {
        var before = given()
            .when().get("/api/admin/overview")
            .then().statusCode(200)
            .extract().body().jsonPath();

        QuarkusTransaction.requiringNew().run(() -> {
            Chama chama = new Chama();
            chama.name = "Overview Test Chama";
            chama.type = ChamaType.TABLE_BANKING;
            chama.currency = "KES";
            chama.contributionFrequency = ContributionFrequency.MONTHLY;
            chama.contributionAmount = new BigDecimal("1000");
            chama.status = ChamaStatus.ACTIVE;
            chamaRepository.persist(chama);

            Member member = new Member();
            member.chama = chama;
            member.keycloakUserId = "overview-member-1";
            member.fullName = "Overview Member";
            member.phone = "254700000900";
            member.status = MemberStatus.ACTIVE;
            memberRepository.persist(member);

            Contribution overdue = new Contribution();
            overdue.chama = chama;
            overdue.member = member;
            overdue.period = LocalDate.now();
            overdue.amountDue = new BigDecimal("1000");
            overdue.amountPaid = BigDecimal.ZERO;
            overdue.status = ContributionStatus.OVERDUE;
            contributionRepository.persist(overdue);

            Contribution paid = new Contribution();
            paid.chama = chama;
            paid.member = member;
            paid.period = LocalDate.now().minusMonths(1);
            paid.amountDue = new BigDecimal("1000");
            paid.amountPaid = new BigDecimal("1000");
            paid.status = ContributionStatus.PAID;
            paid.paidAt = Instant.now();
            contributionRepository.persist(paid);

            Loan loan = new Loan();
            loan.chama = chama;
            loan.member = member;
            loan.principal = new BigDecimal("5000");
            loan.interestRate = new BigDecimal("0.1");
            loan.interestMethod = InterestMethod.FLAT;
            loan.termMonths = 6;
            loan.status = LoanStatus.DISBURSED;
            loan.disbursedAt = Instant.now();
            loanRepository.persist(loan);

            Payment mpesaSuccess = new Payment();
            mpesaSuccess.chama = chama;
            mpesaSuccess.member = member;
            mpesaSuccess.contribution = paid;
            mpesaSuccess.purpose = PaymentPurpose.CONTRIBUTION;
            mpesaSuccess.amount = new BigDecimal("1000");
            mpesaSuccess.method = PaymentMethod.MPESA;
            mpesaSuccess.status = PaymentStatus.SUCCESS;
            mpesaSuccess.providerReference = "overview-mpesa-" + java.util.UUID.randomUUID();
            paymentRepository.persist(mpesaSuccess);

            Payment cardFailed = new Payment();
            cardFailed.chama = chama;
            cardFailed.member = member;
            cardFailed.purpose = PaymentPurpose.CONTRIBUTION;
            cardFailed.amount = new BigDecimal("1000");
            cardFailed.method = PaymentMethod.CARD;
            cardFailed.status = PaymentStatus.FAILED;
            cardFailed.providerReference = "overview-card-" + java.util.UUID.randomUUID();
            paymentRepository.persist(cardFailed);
        });

        given()
            .when().get("/api/admin/overview")
            .then().statusCode(200)
            .body("totalChamas", equalTo(before.getInt("totalChamas") + 1))
            .body("activeChamas", equalTo(before.getInt("activeChamas") + 1))
            .body("newChamasThisMonth", equalTo(before.getInt("newChamasThisMonth") + 1))
            .body("totalMemberships", equalTo(before.getInt("totalMemberships") + 1))
            .body("activeMemberships", equalTo(before.getInt("activeMemberships") + 1))
            .body("overdueContributions", equalTo(before.getInt("overdueContributions") + 1))
            .body("outstandingLoans", equalTo(before.getInt("outstandingLoans") + 1))
            .body("mpesaPaymentsSucceeded", equalTo(before.getInt("mpesaPaymentsSucceeded") + 1))
            .body("cardPaymentsFailed", equalTo(before.getInt("cardPaymentsFailed") + 1))
            .body("totalContributionsCollected", greaterThanOrEqualTo(before.getFloat("totalContributionsCollected") + 1000f));
    }

    @Test
    @TestSecurity(user = "plain-member-overview-1", roles = "MEMBER")
    void nonSuperAdminIsForbidden() {
        given()
            .when().get("/api/admin/overview")
            .then().statusCode(403);
    }
}
