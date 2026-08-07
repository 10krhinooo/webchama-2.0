package org.chama.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;
import org.chama.domain.enums.PaymentMethod;
import org.chama.domain.enums.PaymentPurpose;
import org.chama.domain.enums.PaymentStatus;
import org.chama.domain.enums.PenaltyStatus;
import org.chama.domain.model.Member;
import org.chama.domain.model.Payment;
import org.chama.domain.model.Penalty;
import org.chama.dto.CreatePenaltyDto;
import org.chama.repository.MemberRepository;
import org.chama.repository.PaymentRepository;
import org.chama.repository.PenaltyRepository;
import org.chama.service.notification.PenaltyStatusEmailService;

import java.time.Instant;
import java.util.List;

@ApplicationScoped
public class PenaltyService {

    @Inject
    PenaltyRepository penaltyRepository;

    @Inject
    PaymentRepository paymentRepository;

    @Inject
    MemberRepository memberRepository;

    @Inject
    ChamaService chamaService;

    @Inject
    PenaltyStatusEmailService penaltyStatusEmailService;

    public List<Penalty> listForChama(Long chamaId) {
        return penaltyRepository.findByChama(chamaId);
    }

    public List<Penalty> listForMember(Long chamaId, Long memberId) {
        return penaltyRepository.findByChamaAndMember(chamaId, memberId);
    }

    public Penalty get(Long chamaId, Long penaltyId) {
        Penalty penalty = penaltyRepository.findByIdOptional(penaltyId).orElseThrow(NotFoundException::new);
        if (!penalty.chama.id.equals(chamaId)) {
            throw new NotFoundException();
        }
        return penalty;
    }

    @Transactional
    public Penalty create(Long chamaId, CreatePenaltyDto dto) {
        Member member = memberRepository.findByIdOptional(dto.memberId()).orElseThrow(NotFoundException::new);
        if (!member.chama.id.equals(chamaId)) {
            throw new NotFoundException();
        }

        Penalty penalty = new Penalty();
        penalty.chama = chamaService.get(chamaId);
        penalty.member = member;
        penalty.reason = dto.reason();
        penalty.amount = dto.amount();
        penaltyRepository.persist(penalty);
        return penalty;
    }

    @Transactional
    public Penalty approve(Long chamaId, Long penaltyId, Long deciderMemberId) {
        Penalty penalty = get(chamaId, penaltyId);
        if (penalty.status != PenaltyStatus.PENDING) {
            throw new BadRequestException("Only a pending penalty can be approved");
        }
        penalty.status = PenaltyStatus.APPROVED;
        penalty.decidedBy = memberRepository.findByIdOptional(deciderMemberId).orElseThrow(NotFoundException::new);
        penalty.decidedAt = Instant.now();
        penaltyStatusEmailService.sendIssued(penalty.member.keycloakUserId, penalty.member.fullName,
            penalty.chama.name, penalty.chama.currency, penalty.amount, reasonLabel(penalty.reason));
        return penalty;
    }

    @Transactional
    public Penalty waive(Long chamaId, Long penaltyId, Long deciderMemberId, String waiverReason) {
        Penalty penalty = get(chamaId, penaltyId);
        if (penalty.status == PenaltyStatus.WAIVED) {
            throw new BadRequestException("Penalty is already waived");
        }
        penalty.status = PenaltyStatus.WAIVED;
        penalty.decidedBy = memberRepository.findByIdOptional(deciderMemberId).orElseThrow(NotFoundException::new);
        penalty.decidedAt = Instant.now();
        penalty.waiverReason = waiverReason;
        penaltyStatusEmailService.sendWaived(penalty.member.keycloakUserId, penalty.member.fullName,
            penalty.chama.name, penalty.chama.currency, penalty.amount, waiverReason);
        return penalty;
    }

    /**
     * Records a treasurer-confirmed settlement of an APPROVED penalty, creating a {@code Payment}
     * row (purpose PENALTY) so this channel gets the same ledger/audit trail as contributions and
     * welfare payments (AUDIT_PLAN.md P2-16), instead of the fine simply staying APPROVED forever
     * with no record of whether or how it was ever actually collected.
     */
    @Transactional
    public Penalty settle(Long chamaId, Long penaltyId, Long deciderMemberId, PaymentMethod method) {
        Penalty penalty = get(chamaId, penaltyId);
        if (penalty.status != PenaltyStatus.APPROVED) {
            throw new BadRequestException("Only an approved penalty can be settled");
        }
        penalty.status = PenaltyStatus.PAID;
        penalty.decidedBy = memberRepository.findByIdOptional(deciderMemberId).orElseThrow(NotFoundException::new);
        penalty.decidedAt = Instant.now();

        Payment payment = new Payment();
        payment.chama = penalty.chama;
        payment.member = penalty.member;
        payment.penalty = penalty;
        payment.purpose = PaymentPurpose.PENALTY;
        payment.amount = penalty.amount;
        payment.method = method;
        payment.status = PaymentStatus.SUCCESS;
        payment.paidAt = Instant.now();
        payment.providerReference = "CHAMA-" + chamaId + "-PN" + penaltyId + "-" + System.currentTimeMillis();
        paymentRepository.persist(payment);

        return penalty;
    }

    private static String reasonLabel(org.chama.domain.enums.PenaltyReason reason) {
        return switch (reason) {
            case LATE_CONTRIBUTION -> "Late contribution";
            case MISSED_MEETING -> "Missed meeting";
            case LOAN_DEFAULT -> "Loan default";
            case OTHER -> "Other";
        };
    }
}
