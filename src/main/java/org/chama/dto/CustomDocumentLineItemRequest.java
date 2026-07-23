package org.chama.dto;

import java.math.BigDecimal;

/** One line item typed into the document generator wizard's freeform line-items step (issue #106). */
public record CustomDocumentLineItemRequest(String description, int quantity, BigDecimal unitPrice) {
}
