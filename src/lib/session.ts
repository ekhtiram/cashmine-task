import { claimsKey, claimsStore } from './claims';
import { queryClient } from './query';
import { tokenStore } from './token';

/**
 * Sets (or clears) the API token. Switching to a different token drops all cached server data
 * and loads that token's own claims/intents; the old token's ones stay saved under its scope.
 * Requests still in flight for the old token are discarded by the API client when they return.
 */
export function setToken(next: string | null) {
  const token = next?.trim() || null;
  if (token === tokenStore.get().token) {
    tokenStore.set({ token, rejected: false });
    queryClient.invalidateQueries();
    return;
  }
  queryClient.cancelQueries();
  queryClient.clear();
  // Claims first, so nothing ever renders the new token with the old token's claims.
  claimsStore.load(claimsKey(token));
  tokenStore.set({ token, rejected: false });
}
