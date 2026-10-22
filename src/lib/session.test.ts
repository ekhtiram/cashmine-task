import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Token switching with requests in flight. fetch is replaced by a controllable fake so each test
// decides when (and with what) a request returns.

type Call = { url: string; init: any; resolve: (r: unknown) => void };

let calls: Call[];
let mods: {
  claims: typeof import('./claims');
  session: typeof import('./session');
  token: typeof import('./token');
  query: typeof import('./query');
  api: typeof import('./api');
};

const flush = () => new Promise((r) => setTimeout(r, 0));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const response = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  headers: { get: () => null },
});
const header = (c: Call, name: string) => c.init.headers[name];

const body = { asset: 'ETH', amount: '0.5', destinationId: 'dest_wallet' };
const claimA = {
  id: 'clm_A',
  ...body,
  fee: '0.0012',
  receiveAmount: '0.4988',
  status: 'pending',
  failureReason: null,
  createdAt: '2026-10-20T08:00:10.000Z',
  updatedAt: '2026-10-20T08:00:10.000Z',
};

beforeEach(() => {
  const data = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
  calls = [];
  (globalThis as any).fetch = jest.fn(
    (url: string, init: any) => new Promise((resolve) => calls.push({ url, init, resolve })),
  );
  jest.resetModules();
  /* eslint-disable @typescript-eslint/no-require-imports -- fresh modules per test */
  mods = {
    claims: require('./claims'),
    session: require('./session'),
    token: require('./token'),
    query: require('./query'),
    api: require('./api'),
  /* eslint-enable @typescript-eslint/no-require-imports */
  };
});

describe('switching tokens', () => {
  it('drops an in-flight claim response for token A and resumes it later with the same key', async () => {
    const { claims, session, token } = mods;
    session.setToken('token-A');
    const pending = claims.startClaim(body, undefined);
    await flush();
    expect(calls).toHaveLength(1);
    expect(header(calls[0], 'Authorization')).toBe('Bearer token-A');
    const key = header(calls[0], 'Idempotency-Key');

    session.setToken('token-B');
    expect(claims.claimsStore.get()).toEqual({ intents: {}, claims: [] });

    // Token A's request now succeeds: nothing may land in token B's state.
    calls[0].resolve(response(201, claimA));
    await expect(pending).resolves.toBeNull();
    expect(claims.claimsStore.get()).toEqual({ intents: {}, claims: [] });
    expect(token.tokenStore.get()).toEqual({ token: 'token-B', rejected: false });
    expect(calls).toHaveLength(1);

    // Back on token A: the intent is still there, unknown, with the same key and body.
    session.setToken('token-A');
    const intent = claims.claimsStore.get().intents.ETH;
    expect(intent).toMatchObject({ key, body, phase: 'unknown' });

    const resumed = claims.sendIntent('ETH');
    await flush();
    expect(calls).toHaveLength(2);
    expect(header(calls[1], 'Authorization')).toBe('Bearer token-A');
    expect(header(calls[1], 'Idempotency-Key')).toBe(key);
    expect(JSON.parse(calls[1].init.body)).toEqual(body);
    calls[1].resolve(response(200, claimA)); // idempotent replay
    await expect(resumed).resolves.toMatchObject({ id: 'clm_A' });
    expect(claims.claimsStore.get().intents).toEqual({});
    expect(claims.claimsStore.get().claims.map((c) => c.id)).toEqual(['clm_A']);
  });

  it('never retries token A’s unknown claim with token B', async () => {
    const { claims, session } = mods;
    session.setToken('token-A');
    const pending = claims.startClaim(body, undefined);
    await flush();
    calls[0].resolve(response(504, { error: { code: 'TIMEOUT', message: 'Timed out' } }));
    await flush(); // now waiting before the retry
    session.setToken('token-B');
    await wait(1100); // past the first backoff
    await expect(pending).resolves.toBeNull();
    expect(calls).toHaveLength(1);
    expect(claims.claimsStore.get().intents).toEqual({});

    session.setToken('token-A');
    expect(claims.claimsStore.get().intents.ETH).toMatchObject({ phase: 'unknown' });
  });

  it('does not let a late 401 for token A reject token B', async () => {
    const { api, session, token } = mods;
    session.setToken('token-A');
    const request = api.getBalances();
    await flush();
    session.setToken('token-B');
    calls[0].resolve(response(401, { error: { code: 'UNAUTHORIZED', message: 'Expired' } }));
    await expect(request).rejects.toMatchObject({ code: 'TOKEN_CHANGED' });
    expect(token.tokenStore.get()).toEqual({ token: 'token-B', rejected: false });
  });

  it('clears cached server data', () => {
    const { query, session } = mods;
    session.setToken('token-A');
    query.queryClient.setQueryData(['balances', 'x'], { asOf: '', items: [] });
    session.setToken('token-B');
    expect(query.queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it('keeps claims when the same token is entered again (e.g. after a 401)', async () => {
    const { claims, session, token } = mods;
    session.setToken('token-A');
    const pending = claims.startClaim(body, undefined);
    await flush();
    token.tokenStore.set((s) => ({ ...s, rejected: true }));
    session.setToken(' token-A ');
    expect(claims.claimsStore.get().intents.ETH).toBeDefined();
    expect(token.tokenStore.get()).toEqual({ token: 'token-A', rejected: false });
    calls[0].resolve(response(201, claimA));
    await expect(pending).resolves.toMatchObject({ id: 'clm_A' });
  });
});
