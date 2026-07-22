package org.chama.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;
import org.chama.domain.enums.LoanRepaymentStatus;
import org.chama.domain.model.Loan;
import org.chama.domain.model.LoanRepayment;
import org.chama.domain.model.Member;
import org.chama.dto.CreateLoanDto;
import org.chama.repository.LoanRepaymentRepository;
import org.chama.repository.LoanRepository;
import org.chama.repository.MemberRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@ApplicationScoped
public class LoanService {

    private static final int MONEY_SCALE = 2;
    private static final int CALC_SCALE = 10;

    @Inject
    LoanRepository loanRepository;

    @Inject
    LoanRepaymentRepository loanRepaymentRepository;

    @Inject
    MemberRepository memberRepository;

    @Inject
    ChamaService chamaService;

    public List<Loan> listForChama(Long chamaId) {
        return loanRepository.findByChama(chamaId);
    }

    public List<Loan> listForMember(Long chamaId, Long memberId) {
        return loanRepository.findByChamaAndMember(chamaId, memberId);
    }

    public Loan get(Long chamaId, Long loanId) {
        Loan loan = loanRepository.findByIdOptional(loanId).orElseThrow(NotFoundException::new);
        if (!loan.chama.id.equals(chamaId)) {
            throw new NotFoundException();
        }
        return loan;
    }

    public List<LoanRepayment> getRepayments(Long chamaId, Long loanId) {
        get(chamaId, loanId);
        return loanRepaymentRepository.findByLoan(loanId);
    }

    @Transactional
    public Loan create(Long chamaId, CreateLoanDto dto) {
        Member member = memberRepository.findByIdOptional(dto.memberId()).orElseThrow(NotFoundException::new);
        if (!member.chama.id.equals(chamaId)) {
            throw new NotFoundException();
        }

        Loan loan = new Loan();
        loan.chama = chamaService.get(chamaId);
        loan.member = member;
        loan.principal = dto.principal();
        loan.interestRate = dto.interestRate();
        loan.interestMethod = dto.interestMethod();
        loan.termMonths = dto.termMonths();
        loanRepository.persist(loan);

        for (LoanRepayment repayment : buildSchedule(loan)) {
            loanRepaymentRepository.persist(repayment);
        }
        return loan;
    }

    @Transactional
    public LoanRepayment recordRepayment(Long chamaId, Long loanId, Long repaymentId, BigDecimal amount) {
        get(chamaId, loanId);
        LoanRepayment repayment = loanRepaymentRepository.findByIdOptional(repaymentId).orElseThrow(NotFoundException::new);
        if (!repayment.loan.id.equals(loanId)) {
            throw new NotFoundException();
        }
        if (repayment.status == LoanRepaymentStatus.PAID) {
            throw new BadRequestException("Installment is already fully paid");
        }

        repayment.amountPaid = repayment.amountPaid.add(amount);
        repayment.status = repayment.amountPaid.compareTo(repayment.amountDue) >= 0
            ? LoanRepaymentStatus.PAID
            : LoanRepaymentStatus.PARTIAL;
        return repayment;
    }

    // Equal-installment schedule: FLAT spreads a fixed total interest evenly over the term, while
    // REDUCING_BALANCE amortizes so each installment is the same size but its principal/interest
    // split shifts over time (schema doesn't track that split, only the due/paid totals per
    // installment). The last installment absorbs the rounding remainder so the sum of amountDue
    // across installments always equals the schedule's own total, never drifting by a cent.
    private List<LoanRepayment> buildSchedule(Loan loan) {
        int n = loan.termMonths;
        BigDecimal installment = switch (loan.interestMethod) {
            case FLAT -> flatInstallment(loan.principal, loan.interestRate, n);
            case REDUCING_BALANCE -> reducingBalanceInstallment(loan.principal, loan.interestRate, n);
        };
        BigDecimal roundedInstallment = installment.setScale(MONEY_SCALE, RoundingMode.HALF_UP);
        BigDecimal total = roundedInstallment.multiply(BigDecimal.valueOf(n));

        List<LoanRepayment> schedule = new ArrayList<>();
        BigDecimal allocated = BigDecimal.ZERO;
        LocalDate dueDate = LocalDate.now();
        for (int i = 1; i <= n; i++) {
            dueDate = dueDate.plusMonths(1);
            LoanRepayment repayment = new LoanRepayment();
            repayment.loan = loan;
            repayment.installmentNumber = i;
            repayment.scheduledDate = dueDate;
            repayment.amountDue = i < n ? roundedInstallment : total.subtract(allocated);
            allocated = allocated.add(repayment.amountDue);
            schedule.add(repayment);
        }
        return schedule;
    }

    private BigDecimal flatInstallment(BigDecimal principal, BigDecimal annualRatePercent, int termMonths) {
        BigDecimal totalInterest = principal
            .multiply(annualRatePercent)
            .divide(BigDecimal.valueOf(100), CALC_SCALE, RoundingMode.HALF_UP)
            .multiply(BigDecimal.valueOf(termMonths))
            .divide(BigDecimal.valueOf(12), CALC_SCALE, RoundingMode.HALF_UP);
        return principal.add(totalInterest).divide(BigDecimal.valueOf(termMonths), CALC_SCALE, RoundingMode.HALF_UP);
    }

    private BigDecimal reducingBalanceInstallment(BigDecimal principal, BigDecimal annualRatePercent, int termMonths) {
        BigDecimal monthlyRate = annualRatePercent
            .divide(BigDecimal.valueOf(100), CALC_SCALE, RoundingMode.HALF_UP)
            .divide(BigDecimal.valueOf(12), CALC_SCALE, RoundingMode.HALF_UP);
        if (monthlyRate.compareTo(BigDecimal.ZERO) == 0) {
            return principal.divide(BigDecimal.valueOf(termMonths), CALC_SCALE, RoundingMode.HALF_UP);
        }
        double p = principal.doubleValue();
        double r = monthlyRate.doubleValue();
        double factor = Math.pow(1 + r, termMonths);
        double payment = p * r * factor / (factor - 1);
        return BigDecimal.valueOf(payment);
    }
}
