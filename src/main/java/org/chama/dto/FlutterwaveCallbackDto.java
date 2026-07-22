package org.chama.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;

@JsonIgnoreProperties(ignoreUnknown = true)
public record FlutterwaveCallbackDto(
    String status,
    @JsonProperty("tx_ref") String txRef,
    Long id,
    BigDecimal amount,
    String currency
) {}
