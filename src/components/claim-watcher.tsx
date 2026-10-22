import { useQueries } from '@tanstack/react-query';
import { useEffect } from 'react';

import { getClaim } from '@/lib/api';
import { claimResolved } from '@/lib/balances';
import { claimsStore, pruneClaims, sendIntent, updateClaim } from '@/lib/claims';
import { useBalances } from '@/lib/query';
import { useStore } from '@/lib/store';

// Runs app-wide: polls pending claims, keeps balances fresh while a claim is unresolved,
// and resumes intents whose outcome was unknown when the page was closed.
export function ClaimWatcher() {
  const { claims, intents } = useStore(claimsStore);
  const pending = claims.filter((c) => c.status === 'pending');

  const results = useQueries({
    queries: pending.map((c) => ({
      queryKey: ['claim', c.id],
      queryFn: () => getClaim(c.id),
      refetchInterval: 2000,
    })),
  });
  // updateClaim is a no-op when nothing changed, so running after every render is safe.
  useEffect(() => {
    results.forEach((r) => r.data && updateClaim(r.data));
  });

  const balances = useBalances(false);
  const asOf = balances.data?.asOf;
  const unresolved =
    Object.keys(intents).length > 0 || claims.some((c) => !claimResolved(c, asOf));
  const { refetch } = balances;

  useEffect(() => {
    if (!unresolved) return;
    const id = setInterval(() => refetch(), 5000);
    return () => clearInterval(id);
  }, [unresolved, refetch]);

  useEffect(() => {
    if (asOf) pruneClaims(asOf);
  }, [asOf, claims]);

  useEffect(() => {
    for (const asset of Object.keys(claimsStore.get().intents)) {
      sendIntent(asset).catch(() => {
        // 400 on resume: the claim was never created; the intent is cleared.
      });
    }
  }, []);

  return null;
}
