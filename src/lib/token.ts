import { createPersistedStore, useStore } from './store';

// The token is entered by the user at runtime and kept only in this browser.
// Change it through setToken() in session.ts, which also switches the per-token state.
export const tokenStore = createPersistedStore<{ token: string | null; rejected: boolean }>(
  'cashmine.token',
  { token: null, rejected: false },
);

/**
 * Short id for a token, used to keep claims and cached data of different tokens apart.
 * A non-cryptographic hash (cyrb53) is enough: it only names keys in this browser.
 */
export function tokenScope(token: string | null): string {
  if (!token) return 'none';
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < token.length; i++) {
    const ch = token.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Current token scope; use it in every query key so data never crosses tokens. */
export function useTokenScope() {
  return tokenScope(useStore(tokenStore).token);
}
