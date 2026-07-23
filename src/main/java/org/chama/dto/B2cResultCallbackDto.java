package org.chama.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/** Shape shared by Daraja's B2C ResultURL and QueueTimeOutURL callbacks. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record B2cResultCallbackDto(
    @JsonProperty("Result") Result result
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Result(
        @JsonProperty("ResultCode") int resultCode,
        @JsonProperty("ResultDesc") String resultDesc,
        @JsonProperty("OriginatorConversationID") String originatorConversationId,
        @JsonProperty("ConversationID") String conversationId,
        @JsonProperty("TransactionID") String transactionId,
        @JsonProperty("ResultParameters") ResultParameters resultParameters
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ResultParameters(@JsonProperty("ResultParameter") List<Item> item) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Item(@JsonProperty("Key") String key, @JsonProperty("Value") Object value) {}
}
