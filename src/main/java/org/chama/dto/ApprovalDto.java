package org.chama.dto;

import org.chama.domain.enums.ApprovalStatus;
import org.chama.domain.enums.ApprovalTargetType;
import org.chama.domain.model.Approval;

import java.math.BigDecimal;
import java.time.Instant;

public record ApprovalDto(
    Long id,
    Long chamaId,
    ApprovalTargetType targetType,
    Long targetId,
    Long memberId,
    String memberName,
    BigDecimal amount,
    String reason,
    ApprovalStatus status,
    Long requestedByMemberId,
    String requestedByName,
    Instant requestedAt,
    Long firstApproverMemberId,
    String firstApproverName,
    Instant firstApprovedAt,
    Long secondApproverMemberId,
    String secondApproverName,
    Instant secondApprovedAt) {

    public static ApprovalDto from(Approval a) {
        return new ApprovalDto(
            a.id,
            a.chama.id,
            a.targetType,
            a.targetId,
            a.member.id,
            a.member.fullName,
            a.amount,
            a.reason,
            a.status,
            a.requestedBy.id,
            a.requestedBy.fullName,
            a.requestedAt,
            a.firstApprover != null ? a.firstApprover.id : null,
            a.firstApprover != null ? a.firstApprover.fullName : null,
            a.firstApprovedAt,
            a.secondApprover != null ? a.secondApprover.id : null,
            a.secondApprover != null ? a.secondApprover.fullName : null,
            a.secondApprovedAt);
    }
}
