package org.chama.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;
import org.chama.domain.enums.ActivityEventType;
import org.chama.domain.enums.ApprovalTargetType;
import org.chama.domain.enums.MemberStatus;
import org.chama.domain.enums.PayoutScheduleEntryStatus;
import org.chama.domain.enums.PayoutStatus;
import org.chama.domain.enums.RotationOrderType;
import org.chama.domain.model.Member;
import org.chama.domain.model.Payout;
import org.chama.domain.model.PayoutSchedule;
import org.chama.dto.CreatePayoutDto;
import org.chama.dto.GeneratePayoutScheduleDto;
import org.chama.repository.MemberRepository;
import org.chama.repository.PayoutRepository;
import org.chama.repository.PayoutScheduleRepository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@ApplicationScoped
public class PayoutService {

    @Inject
    PayoutRepository payoutRepository;

    @Inject
    PayoutScheduleRepository payoutScheduleRepository;

    @Inject
    MemberRepository memberRepository;

    @Inject
    ChamaService chamaService;

    @Inject
    ActivityLogService activityLogService;

    @Inject
    ApprovalService approvalService;

    public List<PayoutSchedule> listSchedule(Long chamaId) {
        return payoutScheduleRepository.findByChama(chamaId);
    }

    public List<Payout> listForChama(Long chamaId) {
        return payoutRepository.findByChama(chamaId);
    }

    public List<Payout> listForMember(Long chamaId, Long memberId) {
        return payoutRepository.findByChamaAndMember(chamaId, memberId);
    }

    public Payout get(Long chamaId, Long payoutId) {
        Payout payout = payoutRepository.findByIdOptional(payoutId).orElseThrow(NotFoundException::new);
        if (!payout.chama.id.equals(chamaId)) {
            throw new NotFoundException();
        }
        return payout;
    }

    /**
     * (Re)generates the rotation order for a chama from its currently ACTIVE
     * members, replacing any previous schedule. RANDOM shuffles, SENIORITY
     * orders by join date, AGREED takes the caller-supplied order verbatim
     * (it must name exactly the chama's active members, no more, no fewer).
     */
    @Transactional
    public List<PayoutSchedule> generateSchedule(Long chamaId, GeneratePayoutScheduleDto dto) {
        List<Member> activeMembers = memberRepository.findByChama(chamaId).stream()
            .filter(m -> m.status == MemberStatus.ACTIVE)
            .toList();
        if (activeMembers.isEmpty()) {
            throw new BadRequestException("Chama has no active members to schedule");
        }

        List<Member> ordered = orderMembers(activeMembers, dto);

        payoutScheduleRepository.deleteByChamaId(chamaId);
        var chama = chamaService.get(chamaId);

        List<PayoutSchedule> entries = new ArrayList<>();
        int position = 1;
        for (Member member : ordered) {
            PayoutSchedule entry = new PayoutSchedule();
            entry.chama = chama;
            entry.member = member;
            entry.rotationOrderType = dto.rotationOrderType();
            entry.sequencePosition = position++;
            payoutScheduleRepository.persist(entry);
            entries.add(entry);
        }
        return entries;
    }

    private List<Member> orderMembers(List<Member> activeMembers, GeneratePayoutScheduleDto dto) {
        if (dto.rotationOrderType() == RotationOrderType.SENIORITY) {
            return activeMembers.stream()
                .sorted(Comparator.comparing((Member m) -> m.joinDate).thenComparing(m -> m.id))
                .toList();
        }
        if (dto.rotationOrderType() == RotationOrderType.RANDOM) {
            List<Member> shuffled = new ArrayList<>(activeMembers);
            Collections.shuffle(shuffled);
            return shuffled;
        }
        return agreedOrder(activeMembers, dto.agreedMemberIds());
    }

    private List<Member> agreedOrder(List<Member> activeMembers, List<Long> agreedMemberIds) {
        if (agreedMemberIds == null || agreedMemberIds.isEmpty()) {
            throw new BadRequestException("agreedMemberIds is required for an AGREED rotation order");
        }
        Set<Long> activeIds = activeMembers.stream().map(m -> m.id).collect(Collectors.toSet());
        Set<Long> agreedIds = new HashSet<>(agreedMemberIds);
        if (agreedMemberIds.size() != activeMembers.size() || !agreedIds.equals(activeIds)) {
            throw new BadRequestException("agreedMemberIds must name exactly the chama's active members");
        }
        Map<Long, Member> byId = activeMembers.stream().collect(Collectors.toMap(m -> m.id, m -> m));
        return agreedMemberIds.stream().map(byId::get).toList();
    }

    /**
     * Creates the payout for the next round, resolving whose turn it is from
     * the ACTIVE schedule entries and the count of rounds already created,
     * wrapping back to the start of the rotation once every active member
     * has had a turn.
     */
    @Transactional
    public Payout createNextPayout(Long chamaId, CreatePayoutDto dto) {
        List<PayoutSchedule> active = payoutScheduleRepository.findActiveByChamaOrderedByPosition(chamaId);
        if (active.isEmpty()) {
            throw new BadRequestException("No payout schedule generated for this chama");
        }
        int nextRound = payoutRepository.findLatestForChama(chamaId).map(p -> p.roundNumber + 1).orElse(1);
        PayoutSchedule turn = active.get((nextRound - 1) % active.size());

        var chama = chamaService.get(chamaId);
        Payout payout = new Payout();
        payout.chama = chama;
        payout.member = turn.member;
        payout.roundNumber = nextRound;
        payout.scheduledDate = dto.scheduledDate();
        payout.amount = chama.contributionAmount.multiply(BigDecimal.valueOf(active.size()));
        payoutRepository.persist(payout);
        return payout;
    }

    /**
     * CHAIRPERSON/TREASURER-only claim-once transition: SCHEDULED to DISBURSED. A payout at or
     * above the chama's approval threshold additionally requires a cleared maker-checker dual
     * sign-off (issues #52/#54/#36) before this transition is allowed.
     */
    @Transactional
    public Payout markDisbursed(Long chamaId, Long payoutId) {
        Payout payout = get(chamaId, payoutId);
        if (payout.status != PayoutStatus.SCHEDULED) {
            throw new BadRequestException("Only a scheduled payout can be marked disbursed");
        }
        if (approvalService.requiresApproval(payout.chama, payout.amount)) {
            approvalService.requireApproved(chamaId, ApprovalTargetType.PAYOUT_DISBURSEMENT, payoutId);
        }
        payout.status = PayoutStatus.DISBURSED;
        payout.disbursedAt = Instant.now();
        activityLogService.log(payout.chama, ActivityEventType.PAYOUT_DISBURSED,
            payout.member.fullName + " received their round " + payout.roundNumber + " payout of " + payout.chama.currency + " " + payout.amount);
        return payout;
    }

    /**
     * Called when a member's status transitions to EXITED (see
     * MemberService.updateStatus). Skips their rotation slot and closes the
     * gap by shifting every later ACTIVE member's position down by one, so
     * the rotation stays contiguous starting at 1 without the exited
     * member's slot ever being reused.
     */
    @Transactional
    public void handleMemberExit(Long chamaId, Long memberId) {
        var entryOpt = payoutScheduleRepository.findByChamaAndMember(chamaId, memberId);
        if (entryOpt.isEmpty() || entryOpt.get().status != PayoutScheduleEntryStatus.ACTIVE) {
            return;
        }
        PayoutSchedule exited = entryOpt.get();
        int vacatedPosition = exited.sequencePosition;
        exited.status = PayoutScheduleEntryStatus.SKIPPED;

        for (PayoutSchedule entry : payoutScheduleRepository.findActiveByChamaOrderedByPosition(chamaId)) {
            if (entry.sequencePosition > vacatedPosition) {
                entry.sequencePosition -= 1;
            }
        }
    }
}
