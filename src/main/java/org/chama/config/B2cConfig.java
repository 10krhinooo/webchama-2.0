package org.chama.config;

import io.smallrye.config.ConfigMapping;

/**
 * M-Pesa B2C (loan disbursement) credentials, deliberately its own config namespace rather than
 * reusing MpesaConfig: the initiator name and security credential authorize moving money out of
 * the chama's account and must never share a secret value with the STK-push shortcode credentials.
 * baseUrl/consumerKey/consumerSecret are separate here too, since
 * Daraja typically issues B2C access under its own app registration, distinct from the STK-push
 * app.
 */
@ConfigMapping(prefix = "mpesa.b2c")
public interface B2cConfig {
    String consumerKey();
    String consumerSecret();
    String baseUrl();
    // PartyA: the B2C-enabled shortcode, distinct from the STK-push paybill/till.
    String shortcode();
    String initiatorName();
    // Pre-encrypted with Safaricom's public certificate, never the raw initiator password.
    String securityCredential();
    String resultUrl();
    String queueTimeoutUrl();
}
