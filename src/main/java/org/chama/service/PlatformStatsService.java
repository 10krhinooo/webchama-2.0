package org.chama.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.chama.domain.enums.ChamaStatus;
import org.chama.domain.enums.ContributionStatus;
import org.chama.domain.enums.MemberStatus;
import org.chama.domain.enums.PaymentMethod;
import org.chama.domain.enums.PaymentStatus;
import org.chama.dto.PlatformOverviewDto;
import org.chama.repository.ChamaRepository;
import org.chama.repository.ContributionRepository;
import org.chama.repository.LoanRepository;
import org.chama.repository.MemberRepository;
import org.chama.repository.PaymentRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

/** Backs the SUPER_ADMIN platform overview (MIGRATION_PLAN.md section 3), aggregating across every chama rather than one tenant. */
@ApplicationScoped
public class PlatformStatsService {

    @Inject
    ChamaRepository chamaRepository;

    @Inject
    MemberRepository memberRepository;

    @Inject
    ContributionRepository contributionRepository;

    @Inject
    LoanRepository loanRepository;

    @Inject
    PaymentRepository paymentRepository;

    public PlatformOverviewDto getOverview() {
        Instant startOfMonth = LocalDate.now().withDayOfMonth(1).atStartOfDay(ZoneOffset.UTC).toInstant();

        return new PlatformOverviewDto(
            chamaRepository.count(),
            chamaRepository.countByStatus(ChamaStatus.ACTIVE),
            chamaRepository.countCreatedSince(startOfMonth),
            memberRepository.count(),
            memberRepository.countByStatus(MemberStatus.ACTIVE),
            contributionRepository.sumAmountPaidAll(),
            contributionRepository.sumAmountPaidSince(startOfMonth),
            contributionRepository.countByStatus(ContributionStatus.OVERDUE),
            loanRepository.countOutstanding(),
            loanRepository.sumOutstandingPrincipal(),
            paymentRepository.countByMethodAndStatus(PaymentMethod.MPESA, PaymentStatus.SUCCESS),
            paymentRepository.countByMethodAndStatus(PaymentMethod.MPESA, PaymentStatus.FAILED),
            paymentRepository.countByMethodAndStatus(PaymentMethod.CARD, PaymentStatus.SUCCESS),
            paymentRepository.countByMethodAndStatus(PaymentMethod.CARD, PaymentStatus.FAILED));
    }
}
