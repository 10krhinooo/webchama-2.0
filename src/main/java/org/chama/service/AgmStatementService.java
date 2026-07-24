package org.chama.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.BadRequestException;
import org.chama.domain.model.Chama;
import org.chama.dto.AgmStatementDto;
import org.chama.repository.ContributionRepository;
import org.chama.repository.LoanRepaymentRepository;
import org.chama.repository.LoanRepository;
import org.chama.repository.PayoutRepository;
import org.chama.repository.PenaltyRepository;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.function.Function;

/**
 * Aggregates a chama's existing contribution/loan/payout/penalty records into the numbers behind
 * a one-click AGM/auditor annual financial statement (issue #66), a pure read across existing
 * data, no new persisted entity. Mirrors PdfDocumentService's established pattern of summing
 * Panache entities in Java rather than a raw SQL SUM(), matching how the other statement types
 * already compute their amounts.
 *
 * <p>Inflows are contributions received, loan repayments collected, and penalties approved
 * (the point a penalty becomes a confirmed, collectible amount, not merely imposed). Outflows are
 * loan principal disbursed and member payouts disbursed. The opening balance is every such
 * movement strictly before periodStart; the closing balance carries that forward through the
 * period's own movements, so it in turn becomes the next period's opening balance.
 */
@ApplicationScoped
public class AgmStatementService {

    @Inject
    ContributionRepository contributionRepository;

    @Inject
    LoanRepository loanRepository;

    @Inject
    LoanRepaymentRepository loanRepaymentRepository;

    @Inject
    PayoutRepository payoutRepository;

    @Inject
    PenaltyRepository penaltyRepository;

    @Inject
    ChamaService chamaService;

    public AgmStatementDto aggregate(Long chamaId, LocalDate periodStart, LocalDate periodEnd) {
        if (periodStart == null || periodEnd == null) {
            throw new BadRequestException("Both a period start and end date are required");
        }
        if (periodEnd.isBefore(periodStart)) {
            throw new BadRequestException("Period end must not be before period start");
        }
        Chama chama = chamaService.get(chamaId);

        Instant periodStartInstant = periodStart.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant periodEndExclusive = periodEnd.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();

        BigDecimal openingBalance = openingBalance(chamaId, periodStart, periodStartInstant);

        BigDecimal contributions = sum(
            contributionRepository.findByChamaAndPeriodBetween(chamaId, periodStart, periodEnd), c -> c.amountPaid);
        BigDecimal loanRepayments = sum(
            loanRepaymentRepository.findByChamaAndScheduledBetween(chamaId, periodStart, periodEnd), r -> r.amountPaid);
        BigDecimal penalties = sum(
            penaltyRepository.findApprovedByChamaBetween(chamaId, periodStartInstant, periodEndExclusive), p -> p.amount);
        BigDecimal loansDisbursed = sum(
            loanRepository.findDisbursedByChamaBetween(chamaId, periodStartInstant, periodEndExclusive), l -> l.principal);
        BigDecimal payoutsDisbursed = sum(
            payoutRepository.findDisbursedByChamaBetween(chamaId, periodStartInstant, periodEndExclusive), p -> p.amount);

        BigDecimal closingBalance = openingBalance
            .add(contributions).add(loanRepayments).add(penalties)
            .subtract(loansDisbursed).subtract(payoutsDisbursed);

        return new AgmStatementDto(chamaId, chama.name, chama.currency, periodStart, periodEnd,
            openingBalance, contributions, loanRepayments, penalties, loansDisbursed, payoutsDisbursed, closingBalance);
    }

    private BigDecimal openingBalance(Long chamaId, LocalDate periodStart, Instant periodStartInstant) {
        BigDecimal contributions = sum(
            contributionRepository.findByChamaAndPeriodBefore(chamaId, periodStart), c -> c.amountPaid);
        BigDecimal loanRepayments = sum(
            loanRepaymentRepository.findByChamaAndScheduledBefore(chamaId, periodStart), r -> r.amountPaid);
        BigDecimal penalties = sum(
            penaltyRepository.findApprovedByChamaBefore(chamaId, periodStartInstant), p -> p.amount);
        BigDecimal loansDisbursed = sum(
            loanRepository.findDisbursedByChamaBefore(chamaId, periodStartInstant), l -> l.principal);
        BigDecimal payoutsDisbursed = sum(
            payoutRepository.findDisbursedByChamaBefore(chamaId, periodStartInstant), p -> p.amount);

        return contributions.add(loanRepayments).add(penalties).subtract(loansDisbursed).subtract(payoutsDisbursed);
    }

    private <T> BigDecimal sum(List<T> items, Function<T, BigDecimal> amountOf) {
        return items.stream().map(amountOf).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
