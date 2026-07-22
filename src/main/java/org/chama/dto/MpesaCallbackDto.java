package org.chama.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record MpesaCallbackDto(
    @JsonProperty("Body") Body body
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Body(@JsonProperty("stkCallback") StkCallback stkCallback) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record StkCallback(
        @JsonProperty("CheckoutRequestID") String checkoutRequestId,
        @JsonProperty("ResultCode") int resultCode,
        @JsonProperty("ResultDesc") String resultDesc,
        @JsonProperty("CallbackMetadata") CallbackMetadata callbackMetadata
    ) {
        /** Only present on a successful (ResultCode 0) callback. */
        public String mpesaReceiptNumber() {
            return callbackMetadata != null ? callbackMetadata.value("MpesaReceiptNumber") : null;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CallbackMetadata(@JsonProperty("Item") List<Item> item) {
        String value(String name) {
            if (item == null) return null;
            return item.stream()
                .filter(i -> name.equals(i.name()) && i.value() != null)
                .map(i -> String.valueOf(i.value()))
                .findFirst().orElse(null);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Item(@JsonProperty("Name") String name, @JsonProperty("Value") Object value) {}
}
