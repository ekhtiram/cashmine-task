# NOTES – decisions

## Scope
Done: token screen, Balances (Home), Claim (form → review → submit → status), unit tests.
Dropped on purpose: Activity (time).

## Token
- Entered at runtime, stored only in `localStorage` (`cashmine.token`). Never in code, env vars or the build.
- Settings screen to change/remove it. Any 401 brings back the token screen; pending claim work is kept.
- API base URL lives in one place: `src/lib/api.ts` (`API_BASE_URL`).

## Amounts (`src/lib/money.ts`)
- Every amount is a `bigint` in the asset's smallest unit (value × 10^decimals). No JS numbers, no `parseFloat`.
- Parsing follows the API format exactly (`^(0|[1-9]\d*)(\.\d+)?$`, max `decimals` places).
  API strings we can't represent exactly cause an error state rather than a guessed number.
- Fee / receive: `receive = amount − fee`, integer arithmetic.
- Validation: `minAmount ≤ amount ≤ available`, ≤ `decimals` places. Extra rule (not in docs):
  `receive > 0`. The server still checks `available` live; a 400 is shown next to the amount.
- Max = the displayed available balance, copied exactly.
- USD: `amount × usdPrice` computed exactly at combined scale, summed, rounded **once** (half-up) to
  cents and shown as "≈". The headline total is available + pending (claiming is already leaving).

## Balance right after a claim (option B: overlay)
- The API snapshot is never modified. Display = snapshot + per-claim adjustment
  (`src/lib/balances.ts`, pure and unit tested).
- The adjustment is derived from **server timestamps only** (`asOf` vs the claim's `createdAt` /
  `updatedAt`), so the device clock doesn't matter:
  - snapshot older than the claim (`asOf ≤ createdAt`): move the amount from available to claiming;
  - claim settled but snapshot older than the settlement (`asOf ≤ updatedAt`): take it out of
    claiming, and on **failure** put it back into available;
  - otherwise the snapshot already contains it: no adjustment.
- Result: the balance drops right after submit and stays dropped (no "didn't change, claimed again"),
  and it doesn't jump back up when the next snapshot arrives (no double count, no flicker).
- On failure the amount is restored and a card says why and how much was returned. It stays until
  dismissed.
- While a claim for an asset is unresolved (outcome unknown, pending, or not yet in the snapshot)
  that asset can't be claimed again. Rows that include an adjustment are labelled.
- Balances are polled every 15 s on Home, every 5 s while a claim is unresolved; claims every 2 s.
- **Assumption / risk:** this relies on "a snapshot reflects everything before its `asOf`"
  (per the docs: *"asOf is the time of the snapshot, so a claim you just created may not show up
  until the next one"*). If the server computed snapshots from data older than `asOf`, we'd briefly
  show too much; if it included claims created after `asOf`, we'd briefly double-deduct. Neither is
  suggested by the docs. A value-based check (compare `claiming`) was rejected: other claims and
  accruals change the same numbers.

## Unknown outcome / timeouts (`src/lib/claims.ts`)
- On Confirm we create an **intent**: a UUID idempotency key + the exact request body, saved to
  `localStorage` before the first request.
- 504 / 500 / 503 / network error / client timeout (15 s) / unreadable response = **outcome unknown**:
  the same key and body are re-sent automatically with backoff (429 waits `retryAfterMs`).
  The API guarantees this returns the original claim if it was created, never a second one.
- The intent is removed only on a definite answer: 201/200 (claim → status screen) or 400 (not
  created; user can edit and try again, which makes a new key).
- If retries run out (or 401/409), the user sees "We couldn't confirm your claim… it can never be
  created twice" with **Check again** (same key). There is no "submit again" button, and the asset is
  blocked meanwhile. A page reload resumes the intent with its original key.
- 409 (same key, different body) can't happen by construction since the body is frozen; if it did
  we keep the intent and don't retry blindly.

## Known limitations
- State (token, claims, intents) is per browser; changing to a different token keeps local claim
  state from the old one.
- Web only (localStorage); native would need secure storage.
- "Updated Xs ago" uses the device clock (display only, not used for any money logic).

## Testing
`npm test` – amount parsing, validation, fee, USD totals, and the balance overlay rules.
