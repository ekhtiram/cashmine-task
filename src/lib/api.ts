import { tokenStore } from './token';

export const API_BASE_URL = 'https://task-api.cashmine.io';

const REQUEST_TIMEOUT_MS = 15_000;

export type BalanceItem = {
  asset: string;
  decimals: number;
  available: string;
  pending: string;
  claiming: string;
  usdPrice: string;
};
export type Balances = { asOf: string; items: BalanceItem[] };

export type ClaimOptions = {
  asset: string;
  minAmount: string;
  fee: string;
  destinations: { id: string; label: string }[];
};

export type ClaimBody = { asset: string; amount: string; destinationId: string };

export type Claim = {
  id: string;
  asset: string;
  amount: string;
  fee: string;
  receiveAmount: string;
  destinationId: string;
  status: 'pending' | 'completed' | 'failed';
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export class ApiError extends Error {
  constructor(
    /** HTTP status, or 0 when no response arrived (network error / client timeout). */
    public status: number,
    public code: string,
    message: string,
    public field?: string | null,
    public retryAfterMs?: number,
  ) {
    super(message);
  }
}

/** True when a write may or may not have happened on the server. */
export function isOutcomeUnknown(e: unknown): boolean {
  if (!(e instanceof ApiError)) return true;
  return e.status === 0 || e.status >= 500 || e.code === 'BAD_RESPONSE';
}

async function request<T>(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  const { token } = tokenStore.get();
  if (!token) throw new ApiError(401, 'UNAUTHORIZED', 'No API token set');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(API_BASE_URL + path, {
      method: init.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw controller.signal.aborted
      ? new ApiError(0, 'CLIENT_TIMEOUT', 'The server took too long to respond')
      : new ApiError(0, 'NETWORK', 'Network error. Check your connection.');
  } finally {
    clearTimeout(timer);
  }

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // handled below
  }

  if (!res.ok) {
    const err = json?.error;
    let retryAfterMs: number | undefined = err?.retryAfterMs;
    if (retryAfterMs == null) {
      const header = Number(res.headers.get('Retry-After'));
      if (header > 0) retryAfterMs = header * 1000;
    }
    if (res.status === 401) tokenStore.set((s) => ({ ...s, rejected: true }));
    throw new ApiError(
      res.status,
      err?.code ?? `HTTP_${res.status}`,
      err?.message ?? `Request failed (${res.status})`,
      err?.field,
      retryAfterMs,
    );
  }
  if (json == null) {
    throw new ApiError(res.status, 'BAD_RESPONSE', 'Unexpected response from the server');
  }
  return json as T;
}

export const getBalances = () => request<Balances>('/v1/balances');

export const getClaimOptions = (asset: string) =>
  request<ClaimOptions>(`/v1/claim-options?asset=${encodeURIComponent(asset)}`);

export const createClaim = (idempotencyKey: string, body: ClaimBody) =>
  request<Claim>('/v1/claims', {
    method: 'POST',
    body,
    headers: { 'Idempotency-Key': idempotencyKey },
  });

export const getClaim = (id: string) => request<Claim>(`/v1/claims/${encodeURIComponent(id)}`);
