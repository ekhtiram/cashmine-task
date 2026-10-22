import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';

import { ClaimStatusCard } from '@/components/claim-status-card';
import { ErrorFallback } from '@/components/error-fallback';
import { Button, colors, ErrorState, Loading, Notice, Screen, T } from '@/components/ui';
import { getClaim } from '@/lib/api';
import { useTokenScope } from '@/lib/token';

export { ErrorFallback as ErrorBoundary };

export default function ClaimStatus() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Same query key as ClaimWatcher, so both share one poll.
  const scope = useTokenScope();
  const q = useQuery({
    queryKey: ['claim', scope, id],
    queryFn: () => getClaim(id),
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 2000 : false),
  });

  if (q.isPending) return <Loading label="Loading claim…" />;
  if (!q.data) {
    return <ErrorState message={q.error?.message ?? 'Unknown error'} onRetry={() => q.refetch()} />;
  }

  return (
    <Screen>
      <ClaimStatusCard claim={q.data} />
      {q.isError ? (
        <Notice tone="warn" title="Couldn’t refresh the status">
          <T style={{ color: colors.warn }}>{q.error.message} Retrying automatically.</T>
        </Notice>
      ) : null}
      <Button title="Back to balances" variant="secondary" onPress={() => router.replace('/')} />
    </Screen>
  );
}
