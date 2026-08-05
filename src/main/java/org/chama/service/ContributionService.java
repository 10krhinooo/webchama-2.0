package org.chama.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.NotFoundException;
import org.chama.domain.enums.ActivityEventType;
import org.chama.domain.enums.ContributionStatus;
import org.chama.domain.model.Contribution;
import org.chama.domain.model.Member;
import org.chama.dto.CreateContributionDto;
import org.chama.repository.ContributionRepository;
import org.chama.repository.MemberRepository;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

@ApplicationScoped
public class ContributionService {

    // Every chama and member is Kenya-based (single currency KES, M-Pesa-only payments), so "today"
    // for due-date/streak purposes is always the Nairobi calendar day, never the server's own
    // timezone or UTC, both of which disagree with Nairobi for part of every day.
    private static final ZoneId CHAMA_ZONE = ZoneId.of("Africa/Nairobi");

    @Inject
    ContributionRepository contributionRepository;

    @Inject
    MemberRepository memberRepository;

    @Inject
    ChamaService chamaService;

    @Inject
    ActivityLogService activityLogService;

    public List<Contribution> listForChama(Long chamaId) {
        return contributionRepository.findByChama(chamaId);
    }

    public List<Contribution> listForMember(Long chamaId, Long memberId) {
        return contributionRepository.findByChamaAndMember(chamaId, memberId);
    }

    /**
     * Consecutive count of contribution periods paid on or before their due date, most recent
     * period first (issue #61). A period whose due date has not arrived yet is skipped rather
     * than counted or treated as a break, only periods actually due count towards the streak.
     * The first due period encountered (scanning from most recent) that is not fully paid on
     * time, whether unpaid, partially paid, or paid late, ends the streak; nothing before it
     * counts. Computed on read rather than persisted as a denormalized counter: one member's
     * contribution history is small, so recomputing on every view is cheap and this can never
     * drift out of sync with the underlying payment records the way a cached counter could.
     */
    public int currentStreak(Long chamaId, Long memberId) {
        LocalDate today = LocalDate.now(CHAMA_ZONE);
        int streak = 0;
        for (Contribution contribution : contributionRepository.findByChamaAndMemberOrderByPeriodDesc(chamaId, memberId)) {
            if (contribution.period.isAfter(today)) {
                continue;
            }
            if (!isPaidOnTime(contribution)) {
                break;
            }
            streak++;
        }
        return streak;
    }

    private boolean isPaidOnTime(Contribution contribution) {
        return contribution.status == ContributionStatus.PAID
            && contribution.paidAt != null
            && !LocalDate.ofInstant(contribution.paidAt, CHAMA_ZONE).isAfter(contribution.period);
    }

    public Contribution get(Long chamaId, Long contributionId) {
        Contribution contribution = contributionRepository.findByIdOptional(contributionId)
            .orElseThrow(NotFoundException::new);
        if (!contribution.chama.id.equals(chamaId)) {
            throw new NotFoundException();
        }
        return contribution;
    }

    @Transactional
    public Contribution create(Long chamaId, CreateContributionDto dto) {
        Member member = memberRepository.findByIdOptional(dto.memberId()).orElseThrow(NotFoundException::new);
        if (!member.chama.id.equals(chamaId)) {
            throw new NotFoundException();
        }

        Contribution contribution = new Contribution();
        contribution.chama = chamaService.get(chamaId);
        contribution.member = member;
        contribution.period = dto.period();
        contribution.amountDue = dto.amountDue();
        contributionRepository.persist(contribution);
        return contribution;
    }

    @Transactional
    public Contribution recordPayment(Long chamaId, Long contributionId, BigDecimal amount, org.chama.domain.enums.PaymentMethod method) {
        Contribution contribution = get(chamaId, contributionId);
        contribution.amountPaid = contribution.amountPaid.add(amount);
        contribution.paymentMethod = method;
        contribution.paidAt = Instant.now();
        contribution.status = contribution.amountPaid.compareTo(contribution.amountDue) >= 0
            ? ContributionStatus.PAID
            : ContributionStatus.PARTIAL;
        activityLogService.log(contribution.chama, ActivityEventType.CONTRIBUTION_PAID,
            contribution.member.fullName + " paid " + contribution.chama.currency + " " + amount + " towards their contribution");
        return contribution;
    }

    @Transactional
    public void delete(Long chamaId, Long contributionId) {
        Contribution contribution = get(chamaId, contributionId);
        contributionRepository.delete(contribution);
    }
}
