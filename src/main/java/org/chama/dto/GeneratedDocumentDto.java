package org.chama.dto;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.chama.domain.enums.DeliveryStatus;
import org.chama.domain.enums.DocumentType;
import org.chama.domain.model.GeneratedDocument;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Base64;
import java.util.List;

public record GeneratedDocumentDto(
    Long id,
    Long chamaId,
    Long memberId,
    DocumentType documentType,
    String documentNumber,
    String memberName,
    String memberEmail,
    String memberPhone,
    List<DocumentLineItemDto> lineItems,
    BigDecimal totalAmount,
    String billingPeriod,
    String notes,
    DeliveryStatus emailStatus,
    DeliveryStatus whatsappStatus,
    Instant createdAt,
    String pdfBase64) {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static GeneratedDocumentDto from(GeneratedDocument doc, boolean includePdf) {
        List<DocumentLineItemDto> lineItems;
        try {
            lineItems = MAPPER.readValue(doc.lineItemsJson, new TypeReference<List<DocumentLineItemDto>>() {});
        } catch (JsonProcessingException e) {
            lineItems = List.of();
        }
        return new GeneratedDocumentDto(
            doc.id,
            doc.chama.id,
            doc.member.id,
            doc.documentType,
            doc.documentNumber,
            doc.memberName,
            doc.memberEmail,
            doc.memberPhone,
            lineItems,
            doc.totalAmount,
            doc.billingPeriod,
            doc.notes,
            doc.emailStatus,
            doc.whatsappStatus,
            doc.createdAt,
            includePdf && doc.pdfBytes != null ? Base64.getEncoder().encodeToString(doc.pdfBytes) : null);
    }
}
