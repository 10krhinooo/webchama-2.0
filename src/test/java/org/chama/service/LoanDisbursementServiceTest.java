package org.chama.service;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;
import org.chama.domain.enums.ApprovalTargetType;
import org.chama.domain.enums.ChamaStatus;
import org.chama.domain.enums.ChamaType;
import org.chama.domain.enums.ContributionFrequency;
import org.chama.domain.enums.InterestMethod;
import org.chama.domain.enums.LoanDisbursementStatus;
import org.chama.domain.enums.LoanStatus;
import org.chama.domain.enums.MemberRoleType;
import org.chama.domain.enums.MemberStatus;
import org.chama.domain.model.Approval;
import org.chama.domain.model.Chama;
import org.chama.domain.model.Loan;
import org.chama.domain.model.LoanDisbursement;
import org.chama.domain.model.Member;
import org.chama.domain.model.MemberRole;
import org.chama.dto.B2cResultCallbackDto;
import org.chama.repository.ApprovalRepository;
import org.chama.repository.ChamaRepository;
import org.chama.repository.ContributionRepository;
import org.chama.repository.DocumentDeliveryAttemptRepository;
import org.chama.repository.GeneratedDocumentRepository;
import org.chama.repository.LoanDisbursementRepository;
import org.chama.repository.LoanRepaymentRepository;
import org.chama.repository.LoanRepository;
import org.chama.repository.MemberRepository;
import org.chama.repository.MemberRoleRepository;
import org.chama.repository.PaymentRepository;
import org.chama.repository.PayoutRepository;
import org.chama.repository.PenaltyRepository;
import org.chama.repository.ActivityLogRepository;
import org.chama.repository.WelfareContributionRepository;
import org.chama.repository.WelfareFundRepository;
import org.chama.repository.WelfareWithdrawalRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;

@QuarkusTest
class LoanDisbursementServiceTest {

    @Inject
    ActivityLogRepository activityLogRepository;

    @Inject
    LoanDisbursementService loanDisbursementService;

    @Inject
    ApprovalRepository approvalRepository;

    @Inject
    ChamaRepository chamaRepository;

    @Inject
    GeneratedDocumentRepository generatedDocumentRepository;

    @Inject
    DocumentDeliveryAttemptRepository documentDeliveryAttemptRepository;

    @Inject
    MemberRepository memberRepository;

    @Inject
    MemberRoleRepository memberRoleRepository;

    @Inject
    ContributionRepository contributionRepository;

    @Inject
    PayoutRepository payoutRepository;

    @Inject
    PenaltyRepository penaltyRepository;

    @Inject
    LoanRepository loanRepository;

    @Inject
    LoanRepaymentRepository loanRepaymentRepository;

    @Inject
    LoanDisbursementRepository loanDisbursementRepository;

    @Inject
    WelfareWithdrawalRepository welfareWithdrawalRepository;

    @Inject
    WelfareContributionRepository welfareContributionRepository;

    @Inject
    WelfareFundRepository welfareFundRepository;

    @Inject
    PaymentRepository paymentRepository;

    @InjectMock
    DarajaB2cClient b2cClient;

    private Long chamaId;
    private Long otherChamaId;
    private Long memberId;

    @BeforeEach
    void seed() {
        QuarkusTransaction.requiringNew().run(() -> {
            documentDeliveryAttemptRepository.deleteAll();
            generatedDocumentRepository.deleteAll();
            loanDisbursementRepository.deleteAll();
            loanRepaymentRepository.deleteAll();
            loanRepository.deleteAll();
            approvalRepository.deleteAll();
            memberRoleRepository.deleteAll();
            // Other test classes (e.g. AgmStatementServiceTest, ContributionAutoPushServiceTest) may
            // leave Payment/Contribution/Payout/Penalty rows tied to a Member that this class's own
            // memberRepository.deleteAll() below would otherwise violate a foreign key on, since this
            // class never creates any of those itself.
            paymentRepository.deleteAll();
            contributionRepository.deleteAll();
            payoutRepository.deleteAll();
            penaltyRepository.deleteAll();
            welfareWithdrawalRepository.deleteAll();
            welfareContributionRepository.deleteAll();
            welfareFundRepository.deleteAll();
            memberRepository.deleteAll();
            activityLogRepository.deleteAll();
            chamaRepository.deleteAll();

            Chama chama = newChama("B2C Test Chama");
            chamaRepository.persist(chama);
            chamaId = chama.id;

            Chama otherChama = newChama("Other Chama");
            chamaRepository.persist(otherChama);
            otherChamaId = otherChama.id;

            Member member = new Member();
            member.chama = chama;
            member.keycloakUserId = "b2c-borrower-1";
            member.fullName = "Borrower One";
            member.phone = "254700000201";
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

    private Long persistLoan(LoanStatus status) {
        return persistLoan(status, new BigDecimal("5000"));
    }

    // Above ApprovalService's default threshold (100000), so the maker-checker gate applies.
    private Long persistLoanAboveThreshold(LoanStatus status) {
        return persistLoan(status, new BigDecimal("150000"));
    }

    private Long persistLoan(LoanStatus status, BigDecimal principal) {
        return QuarkusTransaction.requiringNew().call(() -> {
            Loan loan = new Loan();
            loan.chama = chamaRepository.findById(chamaId);
            loan.member = memberRepository.findById(memberId);
            loan.principal = principal;
            loan.interestRate = new BigDecimal("0");
            loan.interestMethod = InterestMethod.FLAT;
            loan.termMonths = 6;
            loan.status = status;
            loanRepository.persist(loan);
            return loan.id;
        });
    }

    /** Seeds an Approval for the loan's disbursement, optionally clearing both signatories. */
    private void seedApproval(Long loanId, boolean bothSignatoriesCleared) {
        QuarkusTransaction.requiringNew().run(() -> {
            Member signerOne = new Member();
            signerOne.chama = chamaRepository.findById(chamaId);
            signerOne.keycloakUserId = "b2c-signer-1-" + loanId;
            signerOne.fullName = "Signer One";
            signerOne.phone = "254700000301";
            signerOne.status = MemberStatus.ACTIVE;
            memberRepository.persist(signerOne);
            MemberRole signerOneRole = new MemberRole();
            signerOneRole.member = signerOne;
            signerOneRole.role = MemberRoleType.TREASURER;
            signerOneRole.persist();

            Approval approval = new Approval();
            approval.chama = chamaRepository.findById(chamaId);
            approval.targetType = ApprovalTargetType.LOAN_DISBURSEMENT;
            approval.targetId = loanId;
            approval.member = memberRepository.findById(memberId);
            approval.amount = new BigDecimal("150000");
            approval.reason = "Loan disbursement";
            approval.requestedBy = signerOne;
            approval.firstApprover = signerOne;
            approval.firstApprovedAt = Instant.now();

            if (bothSignatoriesCleared) {
                Member signerTwo = new Member();
                signerTwo.chama = chamaRepository.findById(chamaId);
                signerTwo.keycloakUserId = "b2c-signer-2-" + loanId;
                signerTwo.fullName = "Signer Two";
                signerTwo.phone = "254700000302";
                signerTwo.status = MemberStatus.ACTIVE;
                memberRepository.persist(signerTwo);
                MemberRole signerTwoRole = new MemberRole();
                signerTwoRole.member = signerTwo;
                signerTwoRole.role = MemberRoleType.CHAIRPERSON;
                signerTwoRole.persist();

                approval.secondApprover = signerTwo;
                approval.secondApprovedAt = Instant.now();
                approval.status = org.chama.domain.enums.ApprovalStatus.APPROVED;
            }

            approvalRepository.persist(approval);
        });
    }

    @Test
    void initiatePersistsPendingDisbursementAndCallsClient() {
        Long loanId = persistLoan(LoanStatus.APPROVED);
        Mockito.when(b2cClient.requestPayout(eq("254700000201"), any(BigDecimal.class), anyString()))
            .thenReturn(new DarajaB2cClient.B2cAckResult("AG_1", "16740-1"));

        LoanDisbursement disbursement = loanDisbursementService.initiate(chamaId, loanId);

        assertEquals("AG_1", disbursement.conversationId);
        assertEquals(LoanDisbursementStatus.PENDING, disbursement.status);
        assertEquals(0, new BigDecimal("5000").compareTo(disbursement.amount));
    }

    @Test
    void initiateRejectsALoanThatIsNotApproved() {
        Long loanId = persistLoan(LoanStatus.REQUESTED);

        assertThrows(BadRequestException.class, () -> loanDisbursementService.initiate(chamaId, loanId));
    }

    @Test
    void initiateRejectsALoanFromAnotherChama() {
        Long loanId = persistLoan(LoanStatus.APPROVED);

        assertThrows(NotFoundException.class, () -> loanDisbursementService.initiate(otherChamaId, loanId));
    }

    @Test
    void initiateRejectsAnAboveThresholdLoanWithoutAClearedApproval() {
        Long loanId = persistLoanAboveThreshold(LoanStatus.APPROVED);

        assertThrows(BadRequestException.class, () -> loanDisbursementService.initiate(chamaId, loanId));
        Mockito.verifyNoInteractions(b2cClient);
    }

    @Test
    void initiateRejectsAnAboveThresholdLoanWhenApprovalHasOnlyOneSignatory() {
        Long loanId = persistLoanAboveThreshold(LoanStatus.APPROVED);
        seedApproval(loanId, false);

        assertThrows(BadRequestException.class, () -> loanDisbursementService.initiate(chamaId, loanId));
    }

    @Test
    void initiateProceedsForAnAboveThresholdLoanOnceApprovalHasClearedBothSignatories() {
        Long loanId = persistLoanAboveThreshold(LoanStatus.APPROVED);
        seedApproval(loanId, true);
        Mockito.when(b2cClient.requestPayout(eq("254700000201"), any(BigDecimal.class), anyString()))
            .thenReturn(new DarajaB2cClient.B2cAckResult("AG_2", "16740-9"));

        LoanDisbursement disbursement = loanDisbursementService.initiate(chamaId, loanId);

        assertEquals(LoanDisbursementStatus.PENDING, disbursement.status);
    }

    @Test
    void applyResultCallbackMarksDisbursementCompletedAndLoanDisbursedOnSuccess() {
        Long loanId = persistLoan(LoanStatus.APPROVED);
        Long disbursementId = seedDisbursement(loanId, "AG_SUCCESS");

        loanDisbursementService.applyResultCallback(
            new B2cResultCallbackDto.Result(0, "Success", "16740-1", "AG_SUCCESS", "NLJ41HAY6Q", null));

        QuarkusTransaction.requiringNew().run(() -> {
            LoanDisbursement disbursement = loanDisbursementRepository.findById(disbursementId);
            assertEquals(LoanDisbursementStatus.COMPLETED, disbursement.status);
            assertEquals("NLJ41HAY6Q", disbursement.transactionId);
            assertNotNull(disbursement.disbursedAt);

            Loan loan = loanRepository.findById(loanId);
            assertEquals(LoanStatus.DISBURSED, loan.status);
            assertNotNull(loan.disbursedAt);
        });
    }

    @Test
    void applyResultCallbackMarksDisbursementFailedAndLeavesLoanApprovedOnFailure() {
        Long loanId = persistLoan(LoanStatus.APPROVED);
        Long disbursementId = seedDisbursement(loanId, "AG_FAIL");

        loanDisbursementService.applyResultCallback(
            new B2cResultCallbackDto.Result(1, "Insufficient funds", "16740-2", "AG_FAIL", null, null));

        QuarkusTransaction.requiringNew().run(() -> {
            LoanDisbursement disbursement = loanDisbursementRepository.findById(disbursementId);
            assertEquals(LoanDisbursementStatus.FAILED, disbursement.status);

            Loan loan = loanRepository.findById(loanId);
            assertEquals(LoanStatus.APPROVED, loan.status);
        });
    }

    @Test
    void applyResultCallbackIgnoresAnUnknownConversationId() {
        loanDisbursementService.applyResultCallback(
            new B2cResultCallbackDto.Result(0, "Success", "x", "NOT_A_REAL_CONVERSATION", "TX1", null));
        // No exception, no row created, nothing to assert beyond "did not throw".
    }

    @Test
    void applyResultCallbackIsIdempotentOnAReplayedCallback() {
        Long loanId = persistLoan(LoanStatus.APPROVED);
        Long disbursementId = seedDisbursement(loanId, "AG_REPLAY");

        loanDisbursementService.applyResultCallback(
            new B2cResultCallbackDto.Result(0, "Success", "16740-3", "AG_REPLAY", "TX_FIRST", null));
        // A replayed callback with a different transaction id must not overwrite the first result.
        loanDisbursementService.applyResultCallback(
            new B2cResultCallbackDto.Result(0, "Success", "16740-3", "AG_REPLAY", "TX_REPLAYED", null));

        QuarkusTransaction.requiringNew().run(() -> {
            LoanDisbursement disbursement = loanDisbursementRepository.findById(disbursementId);
            assertEquals("TX_FIRST", disbursement.transactionId);
        });
    }

    @Test
    void reconcileStalePendingQueriesOnlyDisbursementsPastTheTimeout() {
        Long loanId = persistLoan(LoanStatus.APPROVED);
        Long staleId = seedDisbursement(loanId, "AG_STALE");
        Long freshId = seedDisbursement(loanId, "AG_FRESH");

        // requestedAt is @Column(updatable = false), a normal entity-field assignment inside a
        // transaction would be silently ignored by Hibernate's flush; a bulk HQL update bypasses
        // that and actually backdates the row so this test can simulate staleness.
        QuarkusTransaction.requiringNew().run(() ->
            loanDisbursementRepository.update("requestedAt = ?1 where id = ?2",
                Instant.now().minus(10, ChronoUnit.MINUTES), staleId));

        loanDisbursementService.reconcileStalePending();

        Mockito.verify(b2cClient).queryTransactionStatus(
            loanDisbursementRepository.findById(staleId).originatorConversationId);
        Mockito.verify(b2cClient, Mockito.never()).queryTransactionStatus(
            loanDisbursementRepository.findById(freshId).originatorConversationId);
    }

    private Long seedDisbursement(Long loanId, String conversationId) {
        return QuarkusTransaction.requiringNew().call(() -> {
            LoanDisbursement disbursement = new LoanDisbursement();
            disbursement.loan = loanRepository.findById(loanId);
            disbursement.conversationId = conversationId;
            disbursement.originatorConversationId = "orig-" + conversationId;
            disbursement.targetPhone = "254700000201";
            disbursement.amount = new BigDecimal("5000");
            disbursement.status = LoanDisbursementStatus.PENDING;
            loanDisbursementRepository.persist(disbursement);
            return disbursement.id;
        });
    }

    @Test
    void initiateClaimsTheLoanSoASecondCallCannotDoubleDisburse() {
        Long loanId = persistLoan(LoanStatus.APPROVED);
        Mockito.when(b2cClient.requestPayout(eq("254700000201"), any(BigDecimal.class), anyString()))
            .thenReturn(new DarajaB2cClient.B2cAckResult("AG_ONCE", "16740-1"));

        loanDisbursementService.initiate(chamaId, loanId);

        // The loan is no longer APPROVED (claimed into DISBURSEMENT_PENDING), so a second call,
        // whether a genuine double-click or a client retry, is rejected before any second B2C call.
        assertThrows(BadRequestException.class, () -> loanDisbursementService.initiate(chamaId, loanId));
        Mockito.verify(b2cClient, Mockito.times(1)).requestPayout(anyString(), any(BigDecimal.class), anyString());
    }

    @Test
    void initiateReleasesTheClaimAndReopensTheLoanWhenTheB2cCallFails() {
        Long loanId = persistLoan(LoanStatus.APPROVED);
        Mockito.when(b2cClient.requestPayout(eq("254700000201"), any(BigDecimal.class), anyString()))
            .thenThrow(new RuntimeException("B2C request rejected: insufficient utility balance"));

        assertThrows(RuntimeException.class, () -> loanDisbursementService.initiate(chamaId, loanId));

        QuarkusTransaction.requiringNew().run(() -> {
            Loan loan = loanRepository.findById(loanId);
            assertEquals(LoanStatus.APPROVED, loan.status);
        });
        // The claimed row persisted before the failed call is not silently lost, it is marked FAILED.
        assertEquals(1, loanDisbursementRepository.findByLoan(loanId).size());
        assertEquals(LoanDisbursementStatus.FAILED, loanDisbursementRepository.findByLoan(loanId).get(0).status);

        // And the loan can now be retried.
        Mockito.reset(b2cClient);
        Mockito.when(b2cClient.requestPayout(eq("254700000201"), any(BigDecimal.class), anyString()))
            .thenReturn(new DarajaB2cClient.B2cAckResult("AG_RETRY", "16740-2"));
        LoanDisbursement retried = loanDisbursementService.initiate(chamaId, loanId);
        assertEquals(LoanDisbursementStatus.PENDING, retried.status);
    }
}
