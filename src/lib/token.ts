import { createPersistedStore } from './store';

// The token is entered by the user at runtime and kept only in this browser.
export const tokenStore = createPersistedStore<{ token: string | null; rejected: boolean }>(
  'cashmine.token',
  { token: null, rejected: false },
);

export function saveToken(token: string) {
  tokenStore.set({ token: token.trim(), rejected: false });
}

export function clearToken() {
  tokenStore.set({ token: null, rejected: false });
}
