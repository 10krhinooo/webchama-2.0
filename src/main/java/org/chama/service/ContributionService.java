package org.chama.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.NotFoundException;
import org.chama.domain.enums.ContributionStatus;
import org.chama.domain.model.Contribution;
import org.chama.domain.model.Member;
import org.chama.dto.CreateContributionDto;
import org.chama.repository.ContributionRepository;
import org.chama.repository.MemberRepository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@ApplicationScoped
public class ContributionService {

    @Inject
    ContributionRepository contributionRepository;

    @Inject
    MemberRepository memberRepository;

    @Inject
    ChamaService chamaService;

    public List<Contribution> listForChama(Long chamaId) {
        return contributionRepository.findByChama(chamaId);
    }

    public List<Contribution> listForMember(Long chamaId, Long memberId) {
        return contributionRepository.findByChamaAndMember(chamaId, memberId);
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
        return contribution;
    }

    @Transactional
    public void delete(Long chamaId, Long contributionId) {
        Contribution contribution = get(chamaId, contributionId);
        contributionRepository.delete(contribution);
    }
}
