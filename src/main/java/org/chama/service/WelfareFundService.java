package org.chama.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;
import org.chama.domain.enums.ActivityEventType;
import org.chama.domain.enums.ApprovalTargetType;
import org.chama.domain.enums.MemberStatus;
import org.chama.domain.enums.WelfareWithdrawalStatus;
import org.chama.domain.enums.NotificationEventFamily;
import org.chama.domain.model.Member;
import org.chama.domain.model.WelfareFund;
import org.chama.domain.model.WelfareWithdrawal;
import org.chama.repository.MemberRepository;
import org.chama.repository.WelfareFundRepository;
import org.chama.repository.WelfareWithdrawalRepository;
import org.chama.service.notification.WelfareWithdrawalEmailService;

import java.math.BigDecimal;
import java.time.Instant;
import java.math.RoundingMode;
import java.util.List;

/**
 * Owns the welfare fund's running balance (issue #65). The fund row is lazily created on first
 * access rather than at chama-creation time, a chama that never uses the welfare feature never
 * gets one.
 */
@ApplicationScoped
public class WelfareFundService {

    private static final int MONEY_SCALE = 2;

    @Inject
    WelfareFundRepository welfareFundRepository;

    @Inject
    NotificationService notificationService;

    @Inject
    WelfareWithdrawalRepository welfareWithdrawalRepository;

    @Inject
    ChamaService chamaService;

    @Inject
    MemberRepository memberRepository;

    @Inject
    ActivityLogService activityLogService;

    @Inject
    WelfareWithdrawalEmailService welfareWithdrawalEmailService;

    @Inject
    ApprovalService approvalService;

    @Transactional
    public WelfareFund getOrCreate(Long chamaId) {
        return welfareFundRepository.findByChama(chamaId).orElseGet(() -> {
            WelfareFund fund = new WelfareFund();
            fund.chama = chamaService.get(chamaId);
            // Scale explicitly to match the NUMERIC(12,2) column: a plain BigDecimal.ZERO has
            // scale 0 and would serialize as "0" instead of "0.00" for a fund that hasn't been
            // reloaded from the database yet within the same request.
            fund.balance = BigDecimal.ZERO.setScale(MONEY_SCALE, RoundingMode.UNNECESSARY);
            welfareFundRepository.persist(fund);
            return fund;
        });
    }

    /** Chairperson-set goal amount for the fund, mirroring ChamaService.update's savingsTarget. */
    @Transactional
    public WelfareFund updateTarget(Long chamaId, BigDecimal target) {
        WelfareFund fund = getOrCreate(chamaId);
        fund.target = target;
        return fund;
    }

    @Transactional
    public void credit(Long chamaId, BigDecimal amount) {
        WelfareFund fund = getOrCreate(chamaId);
        fund.balance = fund.balance.add(amount);
    }

    public List<WelfareWithdrawal> listWithdrawals(Long chamaId) {
        return welfareWithdrawalRepository.findByChama(chamaId);
    }

    /**
     * Opens a withdrawal.
     *
     * <p>Below the chama's approval threshold this is the whole story: the fund is debited and the
     * withdrawal is DISBURSED in one step, as it always was. At or above it, the withdrawal is
     * recorded PENDING_APPROVAL, a dual sign-off request is opened against it, and no money moves
     * until {@link #markDisbursed} is called. This was the last path in the application that could
     * move real money on one person's say-so.
     */
    @Transactional
    public WelfareWithdrawal request(Long chamaId, BigDecimal amount, String reason, Member requestedBy) {
        BigDecimal scaledAmount = amount.setScale(MONEY_SCALE, RoundingMode.HALF_UP);
        WelfareFund fund = getOrCreate(chamaId);
        // Checked here as well as at disbursement, so an impossible request is refused up front
        // rather than after someone has been asked to sign off on it.
        requireSufficientBalance(fund, scaledAmount);

        WelfareWithdrawal withdrawal = new WelfareWithdrawal();
        withdrawal.chama = fund.chama;
        withdrawal.amount = scaledAmount;
        withdrawal.reason = reason;
        withdrawal.requestedBy = requestedBy;
        withdrawal.status = WelfareWithdrawalStatus.PENDING_APPROVAL;
        welfareWithdrawalRepository.persist(withdrawal);

        if (!approvalService.requiresApproval(fund.chama, scaledAmount)) {
            return disburse(fund, withdrawal, requestedBy);
        }

        // The requester stands in as the approval's member. A welfare withdrawal has a reason
        // rather than a beneficiary member: the money may go to a member's family, a funeral fund
        // or a hospital, none of which is a member row. Approval.member is not nullable and the
        // requester is the one person the signatories genuinely need to see, since the maker being
        // named is what makes the maker-checker rule legible.
        approvalService.request(chamaId, ApprovalTargetType.WELFARE_WITHDRAWAL, withdrawal.id,
            requestedBy.id, scaledAmount, reason, requestedBy.id);
        activityLogService.log(fund.chama, ActivityEventType.WELFARE_FUND_WITHDRAWAL_REQUESTED,
            requestedBy.fullName + " requested " + fund.chama.currency + " " + scaledAmount
                + " from the welfare fund: " + reason);
        return withdrawal;
    }

    /**
     * Releases a withdrawal that was held for sign-off.
     *
     * <p>The balance is re-checked here, which PayoutService does not need to do: a payout is
     * scheduled against a fixed round amount, whereas the welfare fund is a single draining pot
     * that another withdrawal may have emptied while this one waited for a signature.
     */
    @Transactional
    public WelfareWithdrawal markDisbursed(Long chamaId, Long withdrawalId, Member disbursedBy) {
        WelfareWithdrawal withdrawal = welfareWithdrawalRepository.findByIdOptional(withdrawalId)
            .filter(w -> w.chama.id.equals(chamaId))
            .orElseThrow(NotFoundException::new);
        if (withdrawal.status != WelfareWithdrawalStatus.PENDING_APPROVAL) {
            throw new BadRequestException("This withdrawal has already been disbursed");
        }
        approvalService.requireApproved(chamaId, ApprovalTargetType.WELFARE_WITHDRAWAL, withdrawalId);

        WelfareFund fund = getOrCreate(chamaId);
        requireSufficientBalance(fund, withdrawal.amount);
        return disburse(fund, withdrawal, disbursedBy);
    }

    /** The money actually leaving the fund, shared by both routes in so it cannot drift apart. */
    private WelfareWithdrawal disburse(WelfareFund fund, WelfareWithdrawal withdrawal, Member disbursedBy) {
        fund.balance = fund.balance.subtract(withdrawal.amount);
        withdrawal.status = WelfareWithdrawalStatus.DISBURSED;
        withdrawal.disbursedBy = disbursedBy;
        withdrawal.disbursedAt = Instant.now();

        activityLogService.log(fund.chama, ActivityEventType.WELFARE_FUND_WITHDRAWN,
            disbursedBy.fullName + " disbursed " + fund.chama.currency + " " + withdrawal.amount
                + " from the welfare fund: " + withdrawal.reason);

        List<WelfareWithdrawalEmailService.Recipient> recipients =
            memberRepository.findByChama(fund.chama.id).stream()
                .filter(m -> m.status == MemberStatus.ACTIVE)
                .map(m -> new WelfareWithdrawalEmailService.Recipient(m.keycloakUserId, m.fullName))
                .toList();
        welfareWithdrawalEmailService.sendWithdrawn(recipients, fund.chama.name, fund.chama.currency,
            withdrawal.amount, withdrawal.reason, disbursedBy.fullName);
        return withdrawal;
    }

    private void requireSufficientBalance(WelfareFund fund, BigDecimal amount) {
        if (amount.compareTo(fund.balance) > 0) {
            throw new BadRequestException("Withdrawal amount exceeds the welfare fund balance");
        }
    }
}
