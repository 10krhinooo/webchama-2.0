package org.chama.dto;

import org.chama.domain.enums.DocumentType;

import java.util.List;

/**
 * Body for POST /documents/generate (issue #106), the freeform counterpart to the three
 * record-derived generators. The recipient is always an existing member of the chama, never an
 * arbitrary typed name/email, so tenant isolation and document attribution hold the same as every
 * other document type.
 */
public record GenerateCustomDocumentRequest(
    DocumentType documentType,
    Long memberId,
    String billingPeriod,
    String notes,
    List<CustomDocumentLineItemRequest> lineItems) {
}
