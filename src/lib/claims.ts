import { ApiError, createClaim, isOutcomeUnknown, type Claim, type ClaimBody } from './api';
import { claimResolved } from './balances';
import { queryClient } from './query';
import { createPersistedStore } from './store';
import { tokenScope, tokenStore } from './token';

// An intent is a claim request whose result we don't know yet. Its idempotency key and exact
// body are saved BEFORE the first request and reused for every retry, so the server can create
// at most one claim for it. It is removed only on a definite answer (2xx or 400).
export type Intent = {
  key: string;
  body: ClaimBody;
  phase: 'sending' | 'unknown';
  error?: string;
};

export type TrackedClaim = Claim & { dismissed?: boolean };

type ClaimsState = { intents: Record<string, Intent>; claims: TrackedClaim[] };

/** Claims and intents are stored per token, so one token's claims are never shown or retried with another. */
export const claimsKey = (token: string | null) => `cashmine.claims.${tokenScope(token)}`;

// Loaded state comes from an earlier session (reload or token switch): any request that was in
// flight then has an unknown result.
const markInterrupted = (s: ClaimsState): ClaimsState => ({
  ...s,
  intents: Object.fromEntries(
    Object.entries(s.intents).map(([asset, i]) => [asset, { ...i, phase: 'unknown' as const }]),
  ),
});

const LEGACY_KEY = 'cashmine.claims.v1';
const EMPTY: ClaimsState = { intents: {}, claims: [] };

// One-off migration: the first build stored claims unscoped; they belong to the token in use then.
try {
  const legacy = globalThis.localStorage?.getItem(LEGACY_KEY);
  const scoped = claimsKey(tokenStore.get().token);
  if (legacy && tokenStore.get().token && !globalThis.localStorage.getItem(scoped)) {
    globalThis.localStorage.setItem(scoped, legacy);
  }
  if (legacy) globalThis.localStorage.removeItem(LEGACY_KEY);
} catch {}

export const claimsStore = createPersistedStore<ClaimsState>(
  claimsKey(tokenStore.get().token),
  EMPTY,
  markInterrupted,
);

const MAX_ATTEMPTS = 4;
const inFlight = new Set<string>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One unresolved claim per asset: an open intent or a claim not yet settled in the snapshot. */
export function isAssetBlocked(asset: string, asOf: string | undefined) {
  const { intents, claims } = claimsStore.get();
  return !!intents[asset] || claims.some((c) => c.asset === asset && !claimResolved(c, asOf));
}

function setIntent(asset: string, intent: Intent | null) {
  claimsStore.set((s) => {
    const intents = { ...s.intents };
    if (intent) intents[asset] = intent;
    else delete intents[asset];
    return { ...s, intents };
  });
}

/** Starts a new claim. Returns the claim, or null if the outcome is still unknown. */
export function startClaim(body: ClaimBody, asOf: string | undefined): Promise<Claim | null> {
  if (isAssetBlocked(body.asset, asOf)) {
    return Promise.reject(new Error(`A ${body.asset} claim is still in progress`));
  }
  setIntent(body.asset, { key: newIdempotencyKey(), body, phase: 'sending' });
  return sendIntent(body.asset);
}

/**
 * Sends (or re-sends) the saved intent for an asset with its original key and body.
 * Resolves with the claim, null if still unknown; rejects with ApiError on a 400 (not created).
 */
export async function sendIntent(asset: string): Promise<Claim | null> {
  const scope = claimsStore.key();
  const flightKey = `${scope}:${asset}`;
  if (inFlight.has(flightKey)) return null;
  inFlight.add(flightKey);
  // If the token changes while we wait, stop. The intent stays saved under its own token and is
  // resumed with the same key and body when that token is used again; never sent with another.
  const switched = () => claimsStore.key() !== scope;
  try {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (switched()) return null;
      const intent = claimsStore.get().intents[asset];
      if (!intent) return null;
      setIntent(asset, { ...intent, phase: 'sending', error: undefined });
      try {
        const claim = await createClaim(intent.key, intent.body);
        if (switched()) return null;
        claimsStore.set((s) => {
          const intents = { ...s.intents };
          delete intents[asset];
          return { intents, claims: [...s.claims.filter((c) => c.id !== claim.id), claim] };
        });
        queryClient.invalidateQueries({ queryKey: ['balances'] });
        return claim;
      } catch (e) {
        if (switched()) return null;
        const err = e instanceof ApiError ? e : null;
        if (err?.status === 400) {
          // Rejected by validation: definitely not created. Safe to forget the key.
          setIntent(asset, null);
          throw err;
        }
        const retryable = isOutcomeUnknown(e) || err?.status === 429;
        if (!retryable || attempt === MAX_ATTEMPTS - 1) {
          // 401 / 409 / retries exhausted: keep the intent, user can "Check again" later.
          setIntent(asset, {
            ...intent,
            phase: 'unknown',
            error: e instanceof Error ? e.message : 'Unknown error',
          });
          return null;
        }
        await sleep(err?.status === 429 ? (err.retryAfterMs ?? 2000) : 1000 * 2 ** attempt);
      }
    }
    return null;
  } finally {
    inFlight.delete(flightKey);
  }
}

/** Records a status update from GET /v1/claims/{id}. */
export function updateClaim(claim: Claim) {
  const current = claimsStore.get().claims.find((c) => c.id === claim.id);
  if (!current || (current.status === claim.status && current.updatedAt === claim.updatedAt)) {
    return;
  }
  claimsStore.set((s) => ({
    ...s,
    claims: s.claims.map((c) => (c.id === claim.id ? { ...c, ...claim } : c)),
  }));
  if (claim.status !== 'pending') queryClient.invalidateQueries({ queryKey: ['balances'] });
}

export function dismissClaim(id: string) {
  claimsStore.set((s) => ({
    ...s,
    claims: s.claims.map((c) => (c.id === id ? { ...c, dismissed: true } : c)),
  }));
}

/** Drops claims that need no adjustment and no message any more. */
export function pruneClaims(asOf: string) {
  const { claims } = claimsStore.get();
  const keep = claims.filter(
    (c) => !(claimResolved(c, asOf) && (c.status === 'completed' || c.dismissed)),
  );
  if (keep.length !== claims.length) claimsStore.set((s) => ({ ...s, claims: keep }));
}

function newIdempotencyKey(): string {
  // Available in all modern browsers on https and localhost.
  return crypto.randomUUID();
}
