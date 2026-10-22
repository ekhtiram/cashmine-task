# Notes

## Decisions

### How amounts are represented and calculated

- Every amount is a `bigint` in the asset's smallest unit (value × 10^`decimals`). No JS numbers or
  `parseFloat` anywhere in money code (`src/lib/money.ts`).
- Parsing follows the API format exactly: `^(0|[1-9]\d*)(\.\d+)?$`, at most `decimals` places.
  If the API sends an amount we can't represent exactly, we show an error, not a guessed number.
- Claim validation: `minAmount ≤ amount ≤ available`, at most `decimals` places, plus one rule of
  ours: the user must receive more than 0 (`amount > fee`). The server re-checks `available` live;
  its 400 message is shown next to the amount field.
- `receive = amount − fee` in integer units. Max copies the displayed available balance exactly.
- USD: `amount × usdPrice` is computed exactly at the combined scale, summed, and rounded **once**
  (half-up) to cents, shown as "≈". The headline total is available + pending.
- Unit tests: parsing, validation, fee, USD totals (`src/lib/money.test.ts`).

### What the balance shows right after a claim is submitted

We chose an **optimistic overlay that never touches the API data**.

- Displayed balance = latest snapshot + a per-claim adjustment (`src/lib/balances.ts`, unit tested).
  The adjustment is derived from server timestamps only (`asOf` vs the claim's `createdAt` /
  `updatedAt`), so the device clock plays no part:
  - snapshot older than the claim: the amount moves from available to claiming;
  - claim settled, snapshot older than the settlement: it leaves claiming, and on **failure** goes
    back to available;
  - once the snapshot contains the change, the adjustment is zero.
- So the balance drops as soon as the claim is accepted and doesn't jump back when the next snapshot
  arrives. Adjusted rows are labelled and a "processing" card is shown.
- While a claim is unresolved, that asset can't be claimed again.
- On failure the amount is restored and a card states the reason and the amount returned.
- **Assumption:** a snapshot includes every change before its `asOf`, based on the docs: "a claim you
  just created may not show up until the next one". If that's wrong, the display can be off for one
  snapshot (≤ 15 s).
- Checked on the live API (iPhone): we claimed 20 USDT (fee 1.5, receive 18.5). Available went from
  820.413207 to 800.413207 straight away and stayed there through the following snapshots, with no
  double deduction and no jump back. Later the 50.12 pending became available (850.533207); the
  overlay doesn't interfere with that.

### What happens when the result of a claim request is unknown

- On Confirm we save an **intent**: a UUID `Idempotency-Key` plus the exact request body. It goes to
  `localStorage` before the first request is sent.
- A 504, 500 or 503, a network error, our 15 s client timeout or an unreadable response all mean the
  outcome is unknown. The app re-sends the **same key and body** automatically with backoff; on 429
  it waits `retryAfterMs`. The API returns the original claim if one was created, never a second.
- The intent is cleared only on a definite answer: 200/201 (show the claim and follow its status) or
  400 (not created; the user can fix the amount, which creates a new key).
- If retries run out, the user sees "We couldn't confirm your claim… it can never be created twice"
  and a **Check again** button that reuses the same key. There is no "submit again" option, and the
  asset stays blocked. A page reload resumes the intent with its original key.
- Claims and intents are stored per token. Responses that arrive after a token switch are discarded,
  and an intent is only ever retried with the token it was created under.

## Working with AI

All conversations: `ai-logs/claude-code-session.jsonl`.

### A prompt that didn't work

First I told Claude about the blank claim status page, but it couldn't reproduce it in Chrome. I tried again on my iPhone and same problem happened with USDT and BTC. So I sent more details and screenshots, asked to check the navigation and try ErrorBoundary. At the end we decided to keep claim status on the same screen instead of opening another page. (log ~15:00–15:28)

### An AI mistake or risky output I caught

Claude listed token switching as a known limitation in the first NOTES: claims were still stored in localStorage even when changing the token. This didn't look safe to me because we could show claims from another token or retry an old request with new token. I asked Claude to fix it and add tests for switching tokens while requests are still running. (log ~14:50)

### Where I disagreed with the AI

Claude mentioned clock skew as one of the risks with optimistic balance updates. I didn't agree because both timestamps are coming from the server, not the user's device. But I also had doubts about using just `asOf > createdAt` to know if a claim is already included in the balance. We kept the approach but I wanted to test it with real API. I tested completed and failed claims on my iPhone and balances looked correct in both cases. (log ~14:28)

## Not done / known issues

- I didn't implement Activity because of the time limit. I preferred to spend more time on balances, claim flow and tests instead of adding another screen.
- Claim status page was completely blank on my iPhone (twice). Claude couldn't reproduce it in Chrome and we didn't find the exact reason. We changed the flow to show claim status directly on the Claim screen and added error boundaries. I tested it again on iPhone and it worked.
- Claim status shows destination ID instead of the label.
- I didn't test every possible timeout or network error with the real API, even though the handling is implemented.
- If a claim whose result was unknown is resumed after a page reload and the server rejects it (400), the request is dropped and the balance is unchanged, but no message is shown.
- Web only: the token and claim state are kept in `localStorage`. A native build would need secure storage.
- "Updated Xs ago" uses the device clock. It's display only; no money logic depends on it.
