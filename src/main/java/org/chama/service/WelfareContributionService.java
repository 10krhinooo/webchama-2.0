package org.chama.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.NotFoundException;
import org.chama.domain.enums.ActivityEventType;
import org.chama.domain.enums.PaymentMethod;
import org.chama.domain.enums.WelfareContributionStatus;
import org.chama.domain.model.Member;
import org.chama.domain.model.WelfareContribution;
import org.chama.repository.MemberRepository;
import org.chama.repository.WelfareContributionRepository;
import org.chama.service.notification.PaymentReceiptEmailService;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;

/**
 * Manages welfare_contribution rows (issue #65). Unlike ContributionService there is no
 * amountDue/amountPaid split to reconcile, a welfare contribution is always for the amount the
 * member chose to pay, so it only ever moves PENDING -> PAID once its backing Payment clears.
 */
@ApplicationScoped
public class WelfareContributionService {

    private static final int MONEY_SCALE = 2;

    @Inject
    WelfareContributionRepository welfareContributionRepository;

    @Inject
    MemberRepository memberRepository;

    @Inject
    ChamaService chamaService;

    @Inject
    WelfareFundService welfareFundService;

    @Inject
    ActivityLogService activityLogService;

    @Inject
    PaymentReceiptEmailService paymentReceiptEmailService;

    public List<WelfareContribution> listForChama(Long chamaId) {
        return welfareContributionRepository.findByChama(chamaId);
    }

    public List<WelfareContribution> listForMember(Long chamaId, Long memberId) {
        return welfareContributionRepository.findByChamaAndMember(chamaId, memberId);
    }

    public WelfareContribution get(Long chamaId, Long id) {
        WelfareContribution contribution = welfareContributionRepository.findByIdOptional(id)
            .orElseThrow(NotFoundException::new);
        if (!contribution.chama.id.equals(chamaId)) {
            throw new NotFoundException();
        }
        return contribution;
    }

    /** Creates the PENDING record backing an M-Pesa STK push, before the push is even sent. */
    @Transactional
    public WelfareContribution createPending(Long chamaId, Member member, BigDecimal amount) {
        WelfareContribution contribution = new WelfareContribution();
        contribution.chama = chamaService.get(chamaId);
        contribution.member = member;
        contribution.amount = amount.setScale(MONEY_SCALE, RoundingMode.HALF_UP);
        welfareContributionRepository.persist(contribution);
        return contribution;
    }

    /** Treasurer/chairperson recording a contribution paid outside M-Pesa (cash/bank in hand), credited immediately. */
    @Transactional
    public WelfareContribution recordManual(Long chamaId, Long memberId, BigDecimal amount, PaymentMethod method) {
        Member member = memberRepository.findByIdOptional(memberId).orElseThrow(NotFoundException::new);
        if (!member.chama.id.equals(chamaId)) {
            throw new NotFoundException();
        }

        BigDecimal scaledAmount = amount.setScale(MONEY_SCALE, RoundingMode.HALF_UP);

        WelfareContribution contribution = new WelfareContribution();
        contribution.chama = chamaService.get(chamaId);
        contribution.member = member;
        contribution.amount = scaledAmount;
        contribution.paymentMethod = method;
        contribution.status = WelfareContributionStatus.PAID;
        contribution.paidAt = Instant.now();
        welfareContributionRepository.persist(contribution);

        welfareFundService.credit(chamaId, scaledAmount);
        activityLogService.log(contribution.chama, ActivityEventType.WELFARE_CONTRIBUTION_PAID,
            member.fullName + " contributed " + contribution.chama.currency + " " + scaledAmount + " to the welfare fund");

        paymentReceiptEmailService.sendWelfareReceipt(member.keycloakUserId, member.fullName,
            contribution.chama.name, contribution.chama.currency, scaledAmount, method, contribution.paidAt);
        return contribution;
    }

    /** Marks a pending M-Pesa-backed contribution paid and credits the fund, mirroring ContributionService.recordPayment. */
    @Transactional
    public WelfareContribution markPaid(Long chamaId, Long contributionId, PaymentMethod method) {
        WelfareContribution contribution = get(chamaId, contributionId);
        contribution.paymentMethod = method;
        contribution.status = WelfareContributionStatus.PAID;
        contribution.paidAt = Instant.now();

        welfareFundService.credit(chamaId, contribution.amount);
        activityLogService.log(contribution.chama, ActivityEventType.WELFARE_CONTRIBUTION_PAID,
            contribution.member.fullName + " contributed " + contribution.chama.currency + " " + contribution.amount + " to the welfare fund");

        paymentReceiptEmailService.sendWelfareReceipt(contribution.member.keycloakUserId, contribution.member.fullName,
            contribution.chama.name, contribution.chama.currency, contribution.amount, method, contribution.paidAt);
        return contribution;
    }
}
