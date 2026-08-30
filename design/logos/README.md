# Webchama logo concepts

Five directions, each drawn as a square mark and a horizontal lockup. Nothing here is wired into
the product yet: pick one and it replaces `keycloak/themes/chama/login/resources/img/logo.svg`
and the `WeaveMark` component.

| Concept | Idea | Files |
|---|---|---|
| 1. Kiondo Weave | The woven basket the money goes into. Refines the mark already in use. | `01-kiondo-weave-*.svg` |
| 2. Zamu Wheel | The payout rotation, with this round's turn picked out in saffron. | `02-zamu-wheel-*.svg` |
| 3. Contribution Pot | The kiondo seen side on, filling up. Closest to the product's own hero illustration. | `03-contribution-pot-*.svg` |
| 4. Two Signatures | The maker-checker rule the product is built on, as two ticks. | `04-two-signatures-*.svg` |
| 5. Ledger Monogram | A W built from ledger rules, for a wordmark-led identity. | `05-ledger-monogram-*.svg` |

## Palette

Taken from `frontend/tailwind.config.js`, so a chosen mark already matches the product.

| Token | Value |
|---|---|
| primary | `#1B4D45` |
| night | `#12302B` |
| accent | `#E0A233` |
| paper | `#F7F0E4` |

## Before using one in print

The lockups set the wordmark in Archivo as live text, which keeps them editable but depends on the
font being installed. Convert the text to outlines for anything that leaves the web.
