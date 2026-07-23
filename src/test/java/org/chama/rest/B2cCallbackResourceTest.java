package org.chama.rest;

import jakarta.ws.rs.core.Response;
import org.chama.dto.B2cResultCallbackDto;
import org.chama.service.LoanDisbursementService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * Both callback endpoints always ack 200 (Safaricom retries indefinitely on anything else) and
 * simply forward the Result payload to LoanDisbursementService, which is what actually validates
 * the ConversationID against a known-PENDING row (issue #34).
 */
class B2cCallbackResourceTest {

    private B2cCallbackResource resource() {
        B2cCallbackResource resource = new B2cCallbackResource();
        resource.loanDisbursementService = mock(LoanDisbursementService.class);
        return resource;
    }

    private B2cResultCallbackDto.Result result() {
        return new B2cResultCallbackDto.Result(0, "Success", "16740-1", "AG_1", "NLJ41HAY6Q", null);
    }

    @Test
    void resultCallbackDelegatesToLoanDisbursementService() {
        B2cCallbackResource resource = resource();
        B2cResultCallbackDto.Result result = result();

        Response response = resource.resultCallback(new B2cResultCallbackDto(result));

        assertEquals(200, response.getStatus());
        verify(resource.loanDisbursementService, times(1)).applyResultCallback(eq(result));
    }

    @Test
    void timeoutCallbackDelegatesToLoanDisbursementService() {
        B2cCallbackResource resource = resource();
        B2cResultCallbackDto.Result result = result();

        Response response = resource.timeoutCallback(new B2cResultCallbackDto(result));

        assertEquals(200, response.getStatus());
        verify(resource.loanDisbursementService, times(1)).applyResultCallback(eq(result));
    }

    @Test
    void resultCallbackAcksWithoutDelegatingWhenBodyIsNull() {
        B2cCallbackResource resource = resource();

        Response response = resource.resultCallback(null);

        assertEquals(200, response.getStatus());
        verify(resource.loanDisbursementService, never()).applyResultCallback(null);
    }
}
