package org.chama.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;
import org.chama.domain.enums.ActivityEventType;
import org.chama.domain.enums.ApprovalStatus;
import org.chama.domain.enums.ApprovalTargetType;
import org.chama.domain.model.Approval;
import org.chama.domain.model.Chama;
import org.chama.domain.model.Member;
import org.chama.repository.ApprovalRepository;
import org.chama.repository.ChamaRepository;
import org.chama.repository.MemberRepository;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Maker-checker dual sign-off for loan disbursements and payouts above a chama's configurable
 * approval threshold (MIGRATION_PLAN.md section 9, issues #52/#54/#36). {@link #requiresApproval}
 * decides whether an amount needs this gate at all; {@link #requireApproved} is what
 * LoanDisbursementService/PayoutService call before actually moving money.
 */
@ApplicationScoped
public class ApprovalService {

    @ConfigProperty(name = "chama.approval.default-threshold", defaultValue = "100000")
    BigDecimal defaultThreshold;

    @Inject
    ApprovalRepository approvalRepository;

    @Inject
    ChamaRepository chamaRepository;

    @Inject
    MemberRepository memberRepository;

    @Inject
    ActivityLogService activityLogService;

    /** Whether this amount requires dual sign-off before it can be disbursed, for this chama. */
    public boolean requiresApproval(Chama chama, BigDecimal amount) {
        BigDecimal threshold = chama.approvalThreshold != null ? chama.approvalThreshold : defaultThreshold;
        return amount.compareTo(threshold) >= 0;
    }

    /** Throws unless the given target's most recent approval request has cleared both sign-offs. */
    public void requireApproved(Long chamaId, ApprovalTargetType targetType, Long targetId) {
        Approval approval = approvalRepository.findLatestByTarget(targetType, targetId)
            .filter(a -> a.chama.id.equals(chamaId))
            .orElseThrow(() -> new BadRequestException(
                "Dual sign-off approval is required before this amount can be disbursed"));
        if (approval.status != ApprovalStatus.APPROVED) {
            throw new BadRequestException("Dual sign-off approval has not cleared yet");
        }
    }

    public List<Approval> listForChama(Long chamaId) {
        return approvalRepository.findByChama(chamaId);
    }

    public List<Approval> listPendingForChama(Long chamaId) {
        return approvalRepository.findPendingByChama(chamaId);
    }

    public Approval get(Long chamaId, Long approvalId) {
        Approval approval = approvalRepository.findByIdOptional(approvalId).orElseThrow(NotFoundException::new);
        if (!approval.chama.id.equals(chamaId)) {
            throw new NotFoundException();
        }
        return approval;
    }

    /** The "maker" step: opens a dual sign-off request against a loan disbursement or payout. */
    @Transactional
    public Approval request(Long chamaId, ApprovalTargetType targetType, Long targetId, Long memberId,
                             BigDecimal amount, String reason, Long requestedByMemberId) {
        approvalRepository.findLatestByTarget(targetType, targetId)
            .filter(a -> a.chama.id.equals(chamaId) && a.status == ApprovalStatus.PENDING)
            .ifPresent(a -> {
                throw new BadRequestException("An approval request is already pending for this item");
            });

        Chama chama = chamaRepository.findByIdOptional(chamaId).orElseThrow(NotFoundException::new);
        Member beneficiary = memberRepository.findByIdOptional(memberId).orElseThrow(NotFoundException::new);
        Member requestedBy = memberRepository.findByIdOptional(requestedByMemberId).orElseThrow(NotFoundException::new);

        Approval approval = new Approval();
        approval.chama = chama;
        approval.targetType = targetType;
        approval.targetId = targetId;
        approval.member = beneficiary;
        approval.amount = amount;
        approval.reason = reason;
        approval.requestedBy = requestedBy;
        approvalRepository.persist(approval);

        activityLogService.log(chama, ActivityEventType.APPROVAL_REQUESTED,
            "Dual sign-off requested for " + chama.currency + " " + amount + " (" + beneficiary.fullName + ")");
        return approval;
    }

    /**
     * The "checker" step. The first call records the first signatory and leaves the request
     * PENDING; the second call must come from a different member and flips it to APPROVED. A
     * single signatory can never satisfy both slots.
     */
    @Transactional
    public Approval approve(Long chamaId, Long approvalId, Long signerMemberId) {
        Approval approval = get(chamaId, approvalId);
        if (approval.status != ApprovalStatus.PENDING) {
            throw new BadRequestException("Only a pending approval can be signed off");
        }
        Member signer = memberRepository.findByIdOptional(signerMemberId).orElseThrow(NotFoundException::new);

        if (approval.firstApprover == null) {
            approval.firstApprover = signer;
            approval.firstApprovedAt = Instant.now();
            return approval;
        }

        if (approval.firstApprover.id.equals(signer.id)) {
            throw new BadRequestException("A different signatory must provide the second sign-off");
        }

        approval.secondApprover = signer;
        approval.secondApprovedAt = Instant.now();
        approval.status = ApprovalStatus.APPROVED;
        activityLogService.log(approval.chama, ActivityEventType.APPROVAL_APPROVED,
            "Dual sign-off cleared for " + approval.chama.currency + " " + approval.amount
                + " (" + approval.member.fullName + ") by " + approval.firstApprover.fullName
                + " and " + signer.fullName);
        return approval;
    }

    /** Either signatory can reject a pending request outright, no second sign-off needed to veto. */
    @Transactional
    public Approval reject(Long chamaId, Long approvalId, Long signerMemberId) {
        Approval approval = get(chamaId, approvalId);
        if (approval.status != ApprovalStatus.PENDING) {
            throw new BadRequestException("Only a pending approval can be rejected");
        }
        Member signer = memberRepository.findByIdOptional(signerMemberId).orElseThrow(NotFoundException::new);

        if (approval.firstApprover == null) {
            approval.firstApprover = signer;
            approval.firstApprovedAt = Instant.now();
        } else {
            approval.secondApprover = signer;
            approval.secondApprovedAt = Instant.now();
        }
        approval.status = ApprovalStatus.REJECTED;
        activityLogService.log(approval.chama, ActivityEventType.APPROVAL_REJECTED,
            "Dual sign-off request for " + approval.chama.currency + " " + approval.amount
                + " (" + approval.member.fullName + ") was rejected by " + signer.fullName);
        return approval;
    }
}
