# Payment provider stubs

WireMock mappings standing in for Safaricom Daraja and Flutterwave, mounted into the
`payments-stub` service in `docker-compose.e2e.yml`. The backend reaches them because
`MPESA_BASE_URL`, `MPESA_B2C_BASE_URL` and `FLUTTERWAVE_BASE_URL` are set to the stub in that
file, and environment variables outrank the `%prod` entries in `application.properties`.

Requests still leave the backend over real HTTP and come back through the same client code, so
`MpesaService`, `DarajaB2cClient` and `FlutterwaveService` are genuinely exercised. Only the
provider is fake.

## The amount coupling

`FlutterwaveService.verifyTransactionData` rejects a verification whose amount does not exactly
match what the payment expects, which is deliberate: it stops a caller paying a trivial sum and
having it accepted. A static stub cannot know the amount, so the two verify mappings hardcode
`"amount": 5000` and the fixture's card-payment contribution is seeded at exactly KES 5000.

Change one and you must change the other, or the card spec fails with a currency/amount mismatch
in the backend log rather than anything obvious in the browser.

## What is not stubbed

Callbacks. Daraja and Flutterwave push those, so the specs post them directly to
`/api/payments/mpesa-callback` and `/api/payments/card/callback`. That is what exercises the
server-to-server re-verification both webhook handlers perform before crediting anything.
