package org.chama.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import org.chama.domain.enums.ActivityEventType;
import org.chama.domain.model.Member;
import org.chama.domain.model.WelfareFund;
import org.chama.domain.model.WelfareWithdrawal;
import org.chama.repository.WelfareFundRepository;
import org.chama.repository.WelfareWithdrawalRepository;

import java.math.BigDecimal;
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
    WelfareWithdrawalRepository welfareWithdrawalRepository;

    @Inject
    ChamaService chamaService;

    @Inject
    ActivityLogService activityLogService;

    @Transactional
    public WelfareFund getOrCreate(Long chamaId) {
        return welfareFundRepository.findByChama(chamaId).orElseGet(() -> {
            WelfareFund fund = new WelfareFund();
            fund.chama = chamaService.get(chamaId);
            // Scale explicitly to match the NUMERIC(12,2) column: a plain BigDecimal.ZERO has
            // scale 0 and would serialize as "0" instead of "0.00" for a fund that hasn't been
            // reloaded from the database yet within the same request.
            fund.balance = BigDecimal.ZERO.setScale(2);
            welfareFundRepository.persist(fund);
            return fund;
        });
    }

    @Transactional
    public void credit(Long chamaId, BigDecimal amount) {
        WelfareFund fund = getOrCreate(chamaId);
        fund.balance = fund.balance.add(amount);
    }

    public List<WelfareWithdrawal> listWithdrawals(Long chamaId) {
        return welfareWithdrawalRepository.findByChama(chamaId);
    }

    @Transactional
    public WelfareWithdrawal withdraw(Long chamaId, BigDecimal amount, String reason, Member disbursedBy) {
        BigDecimal scaledAmount = amount.setScale(MONEY_SCALE, RoundingMode.HALF_UP);
        WelfareFund fund = getOrCreate(chamaId);
        if (scaledAmount.compareTo(fund.balance) > 0) {
            throw new BadRequestException("Withdrawal amount exceeds the welfare fund balance");
        }
        fund.balance = fund.balance.subtract(scaledAmount);

        WelfareWithdrawal withdrawal = new WelfareWithdrawal();
        withdrawal.chama = fund.chama;
        withdrawal.amount = scaledAmount;
        withdrawal.reason = reason;
        withdrawal.disbursedBy = disbursedBy;
        welfareWithdrawalRepository.persist(withdrawal);

        activityLogService.log(fund.chama, ActivityEventType.WELFARE_FUND_WITHDRAWN,
            disbursedBy.fullName + " disbursed " + fund.chama.currency + " " + scaledAmount + " from the welfare fund: " + reason);
        return withdrawal;
    }
}
