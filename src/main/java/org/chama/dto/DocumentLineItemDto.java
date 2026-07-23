package org.chama.dto;

import java.math.BigDecimal;

/** One row of a generated document's line-items table, JSON-serialized onto GeneratedDocument.lineItemsJson. */
public record DocumentLineItemDto(String description, BigDecimal amount) {
}
