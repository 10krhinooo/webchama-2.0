package org.chama.config;

import io.smallrye.config.ConfigMapping;

@ConfigMapping(prefix = "mpesa")
public interface MpesaConfig {
    String consumerKey();
    String consumerSecret();
    // BusinessShortCode: used for password encoding and the BusinessShortCode field.
    String shortcode();
    // PartyB: the paybill/till number. Equal to shortcode for CustomerPayBillOnline/sandbox.
    String tillNumber();
    String passkey();
    String baseUrl();
    // CustomerPayBillOnline (Paybill / sandbox) or CustomerBuyGoodsOnline (Till)
    String transactionType();
    String callbackUrl();
}
