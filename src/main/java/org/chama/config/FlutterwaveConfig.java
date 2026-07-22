package org.chama.config;

import io.smallrye.config.ConfigMapping;

@ConfigMapping(prefix = "flutterwave")
public interface FlutterwaveConfig {
    String secretKey();
    String baseUrl();
    String callbackUrl();
    String redirectUrl();
    // Webhook signature secret, verif-hash header. Fail closed if unset, see PaymentCallbackResource.
    String secretHash();
}
