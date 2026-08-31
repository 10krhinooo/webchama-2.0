package org.chama.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import org.chama.domain.enums.ActivityEventType;
import org.chama.domain.enums.DocumentType;
import org.chama.domain.enums.LoanStatus;
import org.chama.domain.enums.PayoutStatus;
import org.chama.domain.model.Chama;
import org.chama.domain.model.Contribution;
import org.chama.domain.model.GeneratedDocument;
import org.chama.domain.model.Loan;
import org.chama.domain.model.Member;
import org.chama.domain.model.Payout;
import org.chama.dto.AgmStatementDto;
import org.chama.dto.CustomDocumentLineItemRequest;
import org.chama.dto.DocumentLineItemDto;
import org.chama.dto.GenerateCustomDocumentRequest;
import org.chama.repository.GeneratedDocumentRepository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * Generates the three record-derived document types (contribution receipt, loan statement, payout
 * receipt) by reading their line items straight off the existing domain entity, plus a freeform
 * generator (issue #106, generateCustomDocument) for an ad-hoc invoice/receipt against any existing
 * chama member, rather than accepting an arbitrary packet. Persists a
 * placeholder document_number first (NOT NULL, but the id isn't known until the identity insert
 * happens), then rebuilds the real number once the id is assigned, then renders the PDF so the
 * number can appear on it.
 */
@ApplicationScoped
public class DocumentGenerationService {

    private static final DateTimeFormatter DOC_NUMBER_MONTH = DateTimeFormatter.ofPattern("yyyy-MM");
    private static final DateTimeFormatter BILLING_PERIOD_FORMAT = DateTimeFormatter.ofPattern("MMMM yyyy");
    private static final DateTimeFormatter STATEMENT_DATE_FORMAT = DateTimeFormatter.ofPattern("d MMM yyyy");

    @Inject
    GeneratedDocumentRepository generatedDocumentRepository;

    @Inject
    ContributionService contributionService;

    @Inject
    LoanService loanService;

    @Inject
    PayoutService payoutService;

    @Inject
    MemberService memberService;

    @Inject
    AgmStatementService agmStatementService;

    @Inject
    PdfDocumentService pdfDocumentService;

    @Inject
    ObjectMapper objectMapper;

    @Inject
    ActivityLogService activityLogService;

    /** The issuing chama's own identity, so a receipt says who it came from. */
    private static PdfDocumentService.Letterhead letterheadFor(org.chama.domain.model.Chama chama) {
        return new PdfDocumentService.Letterhead(
            chama.name,
            chama.postalAddress,
            chama.physicalAddress,
            chama.contactPhone,
            chama.contactEmail,
            chama.registrationNumber,
            chama.logoBytes);
    }

    @Transactional
    public GeneratedDocument generateContributionReceipt(Long chamaId, Long contributionId) {
        Contribution contribution = contributionService.get(chamaId, contributionId);
        if (contribution.amountPaid == null || contribution.amountPaid.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BadRequestException("Contribution has no recorded payment to receipt");
        }

        String billingPeriod = contribution.period.format(BILLING_PERIOD_FORMAT);
        List<DocumentLineItemDto> lineItems = List.of(
            new DocumentLineItemDto("Contribution for " + billingPeriod, contribution.amountPaid));

        GeneratedDocument doc = newDocument(DocumentType.CONTRIBUTION_RECEIPT, contribution.chama, contribution.member);
        doc.contribution = contribution;
        doc.billingPeriod = billingPeriod;
        return generate(doc, lineItems, contribution.amountPaid);
    }

    @Transactional
    public GeneratedDocument generateLoanStatement(Long chamaId, Long loanId) {
        Loan loan = loanService.get(chamaId, loanId);
        if (loan.status == LoanStatus.REQUESTED) {
            throw new BadRequestException("Loan has not been approved yet, nothing to state");
        }

        List<DocumentLineItemDto> lineItems = List.of(
            new DocumentLineItemDto("Principal (" + loan.interestMethod + " interest, " + loan.termMonths + " months)", loan.principal),
            new DocumentLineItemDto("Interest rate", loan.interestRate));

        GeneratedDocument doc = newDocument(DocumentType.LOAN_STATEMENT, loan.chama, loan.member);
        doc.loan = loan;
        return generate(doc, lineItems, loan.principal);
    }

    @Transactional
    public GeneratedDocument generatePayoutReceipt(Long chamaId, Long payoutId) {
        Payout payout = payoutService.get(chamaId, payoutId);
        if (payout.status != PayoutStatus.DISBURSED) {
            throw new BadRequestException("Payout has not been disbursed yet, nothing to receipt");
        }

        List<DocumentLineItemDto> lineItems = List.of(
            new DocumentLineItemDto("Payout, round " + payout.roundNumber, payout.amount));

        GeneratedDocument doc = newDocument(DocumentType.PAYOUT_RECEIPT, payout.chama, payout.member);
        doc.payout = payout;
        return generate(doc, lineItems, payout.amount);
    }

    @Transactional
    public GeneratedDocument generateCustomDocument(Long chamaId, GenerateCustomDocumentRequest request) {
        if (request.documentType() != DocumentType.CUSTOM_INVOICE && request.documentType() != DocumentType.CUSTOM_RECEIPT) {
            throw new BadRequestException("documentType must be CUSTOM_INVOICE or CUSTOM_RECEIPT");
        }
        if (request.lineItems() == null || request.lineItems().isEmpty()) {
            throw new BadRequestException("At least one line item is required");
        }

        Member member = memberService.get(chamaId, request.memberId());

        List<DocumentLineItemDto> lineItems = new ArrayList<>();
        BigDecimal totalAmount = BigDecimal.ZERO;
        for (CustomDocumentLineItemRequest item : request.lineItems()) {
            if (item.description() == null || item.description().isBlank()) {
                throw new BadRequestException("Every line item needs a description");
            }
            if (item.quantity() <= 0) {
                throw new BadRequestException("Every line item needs a quantity greater than zero");
            }
            if (item.unitPrice() == null || item.unitPrice().compareTo(BigDecimal.ZERO) < 0) {
                throw new BadRequestException("Every line item needs a non-negative unit price");
            }
            BigDecimal amount = item.unitPrice().multiply(BigDecimal.valueOf(item.quantity()));
            String description = item.quantity() == 1
                ? item.description()
                : item.description() + " (x" + item.quantity() + " @ " + item.unitPrice() + ")";
            lineItems.add(new DocumentLineItemDto(description, amount));
            totalAmount = totalAmount.add(amount);
        }

        GeneratedDocument doc = newDocument(request.documentType(), member.chama, member);
        doc.billingPeriod = request.billingPeriod();
        doc.notes = request.notes();
        return generate(doc, lineItems, totalAmount);
    }

    /**
     * Generates a chama-wide AGM/auditor annual financial statement (issue #66) for an arbitrary
     * period (financial year or custom range). Unlike the record-derived types above, this isn't
     * issued to a single member, but GeneratedDocument.member is NOT NULL (see V13's schema), so it
     * is attributed to the requesting officer, same as how Loan/Payout approvals attribute a
     * claim-once transition to whichever TREASURER/CHAIRPERSON performed it.
     */
    @Transactional
    public GeneratedDocument generateAgmStatement(Long chamaId, Long generatedByMemberId, LocalDate periodStart, LocalDate periodEnd) {
        Member officer = memberService.get(chamaId, generatedByMemberId);
        AgmStatementDto statement = agmStatementService.aggregate(chamaId, periodStart, periodEnd);

        String period = periodStart.format(STATEMENT_DATE_FORMAT) + " to " + periodEnd.format(STATEMENT_DATE_FORMAT);
        List<DocumentLineItemDto> lineItems = List.of(
            new DocumentLineItemDto("Opening balance as at " + periodStart.format(STATEMENT_DATE_FORMAT), statement.openingBalance()),
            new DocumentLineItemDto("Total contributions received", statement.totalContributionsReceived()),
            new DocumentLineItemDto("Total loan repayments received", statement.totalLoanRepaymentsReceived()),
            new DocumentLineItemDto("Total penalties collected", statement.totalPenaltiesCollected()),
            new DocumentLineItemDto("Total loans disbursed", statement.totalLoansDisbursed().negate()),
            new DocumentLineItemDto("Total payouts disbursed", statement.totalPayoutsDisbursed().negate()));

        GeneratedDocument doc = new GeneratedDocument();
        doc.documentType = DocumentType.AGM_STATEMENT;
        doc.chama = officer.chama;
        doc.member = officer;
        doc.memberName = "Annual General Meeting";
        doc.memberPhone = officer.phone;
        doc.billingPeriod = period;
        doc.notes = "Prepared for AGM/auditor review by " + officer.fullName + ". Contributions, loan repayments, "
            + "and approved penalties are recorded as inflows; loan disbursements and member payouts are recorded "
            + "as outflows. The closing balance below carries forward as the next period's opening balance.";

        return generate(doc, lineItems, statement.closingBalance());
    }

    private GeneratedDocument newDocument(DocumentType type, Chama chama, org.chama.domain.model.Member member) {
        GeneratedDocument doc = new GeneratedDocument();
        doc.documentType = type;
        doc.chama = chama;
        doc.member = member;
        doc.memberName = member.fullName;
        // Member has no local email column (Keycloak owns it), left null here. The delivery
        // channels (issues #38/#39/#40) resolve the recipient address from Keycloak at send time.
        doc.memberPhone = member.phone;
        return doc;
    }

    private GeneratedDocument generate(GeneratedDocument doc, List<DocumentLineItemDto> lineItems, BigDecimal totalAmount) {
        doc.totalAmount = totalAmount;
        doc.lineItemsJson = writeLineItems(lineItems);
        // Placeholder, document_number is NOT NULL but the real id isn't known until this insert happens.
        doc.documentNumber = "PENDING";
        generatedDocumentRepository.persist(doc);
        generatedDocumentRepository.flush();

        LocalDate issueDate = LocalDate.now(ZoneOffset.UTC);
        doc.documentNumber = doc.documentType.prefix() + "-" + issueDate.format(DOC_NUMBER_MONTH) + "-" + String.format("%04d", doc.id);

        doc.pdfBytes = pdfDocumentService.render(
            doc.documentType, doc.documentNumber, letterheadFor(doc.chama), doc.memberName,
            issueDate, lineItems, totalAmount, doc.billingPeriod, doc.notes);

        if (doc.documentType == DocumentType.AGM_STATEMENT) {
            activityLogService.log(doc.chama, ActivityEventType.AGM_STATEMENT_GENERATED,
                doc.documentNumber + " (" + doc.billingPeriod + ") was generated");
        } else {
            activityLogService.log(doc.chama, ActivityEventType.DOCUMENT_GENERATED,
                doc.documentNumber + " was generated for " + doc.memberName);
        }
        return doc;
    }

    private String writeLineItems(List<DocumentLineItemDto> lineItems) {
        try {
            return objectMapper.writeValueAsString(lineItems);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to serialize document line items", e);
        }
    }
}
