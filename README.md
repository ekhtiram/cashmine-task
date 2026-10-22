# CashMine – payback balances & claims

React Native (Expo, TypeScript) app for the CashMine practical task, shipped as a web build for
phone screens (~390 px).

- **Balances:** each asset's available, pending and claiming amounts, total in USD, snapshot time,
  refresh, and error/retry states.
- **Claim:** pick an asset, enter an amount or tap Max, see the fee and the amount received, review,
  confirm, then follow the claim until it completes or fails.

Decisions (amounts, the balance after a claim, unknown results) are explained in [NOTES.md](NOTES.md).

## Run

```bash
npm install
npx expo start --web     # dev server
npm test                 # unit tests (Jest)
npx tsc --noEmit         # typecheck
npx expo lint            # lint
npx expo export -p web   # production build in dist/
```

On first open the app asks for the API token. The token is kept only in the browser's
`localStorage` and can be changed or removed in Settings. It is never part of the code or the build.
The API base URL is set in one place: `src/lib/api.ts`.

## Structure

```
src/app/            screens (Expo Router): index (balances), claim, claims/[id], settings
src/components/     UI pieces, token form, claim notices, ClaimWatcher (polling and resume)
src/lib/money.ts    bigint amount parsing, validation, fee, USD
src/lib/balances.ts snapshot + claim overlay
src/lib/claims.ts   idempotent claim submission, intents, per-token storage
src/lib/session.ts  token switching
```

## Limitations

- Web only: storage uses `localStorage`. A native build would need secure storage.
- Activity history is not implemented.
