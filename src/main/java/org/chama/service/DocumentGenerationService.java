package org.chama.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import org.chama.domain.enums.DocumentType;
import org.chama.domain.enums.LoanStatus;
import org.chama.domain.enums.PayoutStatus;
import org.chama.domain.model.Chama;
import org.chama.domain.model.Contribution;
import org.chama.domain.model.GeneratedDocument;
import org.chama.domain.model.Loan;
import org.chama.domain.model.Payout;
import org.chama.dto.DocumentLineItemDto;
import org.chama.repository.GeneratedDocumentRepository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Generates the three document types (contribution receipt, loan statement, payout receipt) by
 * reading their line items straight off the existing domain entity, unlike DondooHomes'
 * DocumentService which accepts an arbitrary packet, webchama's three document types map 1:1 to
 * entities that already exist, there is no free-form invoicing use case here. Ported orchestration
 * shape from DondooHomes' DocumentService.generate(): persist a placeholder document_number first
 * (NOT NULL, but the id isn't known until the identity insert happens), then rebuild the real
 * number once the id is assigned, then render the PDF so the number can appear on it.
 */
@ApplicationScoped
public class DocumentGenerationService {

    private static final DateTimeFormatter DOC_NUMBER_MONTH = DateTimeFormatter.ofPattern("yyyy-MM");
    private static final DateTimeFormatter BILLING_PERIOD_FORMAT = DateTimeFormatter.ofPattern("MMMM yyyy");

    @Inject
    GeneratedDocumentRepository generatedDocumentRepository;

    @Inject
    ContributionService contributionService;

    @Inject
    LoanService loanService;

    @Inject
    PayoutService payoutService;

    @Inject
    PdfDocumentService pdfDocumentService;

    @Inject
    ObjectMapper objectMapper;

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
            doc.documentType, doc.documentNumber, doc.chama.name, doc.memberName,
            issueDate, lineItems, totalAmount, doc.billingPeriod, doc.notes);

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
