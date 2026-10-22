import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { Button, Card, colors, ErrorState, Loading, Notice, Row, Screen, T } from '@/components/ui';
import { getClaim } from '@/lib/api';

export default function ClaimStatus() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Same query key as ClaimWatcher, so both share one poll.
  const q = useQuery({
    queryKey: ['claim', id],
    queryFn: () => getClaim(id),
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 2000 : false),
  });

  if (q.isPending) return <Loading label="Loading claim…" />;
  if (!q.data) {
    return <ErrorState message={q.error?.message ?? 'Unknown error'} onRetry={() => q.refetch()} />;
  }
  const c = q.data;

  return (
    <Screen>
      {c.status === 'pending' ? (
        <Notice tone="info" title="Processing">
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <ActivityIndicator color={colors.info} />
            <T style={{ color: colors.info }}>Usually settles within about 20 seconds.</T>
          </View>
        </Notice>
      ) : c.status === 'completed' ? (
        <Notice tone="ok" title="Completed">
          <T style={{ color: colors.ok }}>
            {c.receiveAmount} {c.asset} was sent to your destination.
          </T>
        </Notice>
      ) : (
        <Notice tone="error" title="Failed">
          <T style={{ color: colors.danger }}>
            {c.failureReason ?? 'No reason given.'} {c.amount} {c.asset} was returned to your
            available balance.
          </T>
        </Notice>
      )}

      {q.isError ? (
        <Notice tone="warn" title="Couldn’t refresh the status">
          <T style={{ color: colors.warn }}>{q.error.message} Retrying automatically.</T>
        </Notice>
      ) : null}

      <Card>
        <Row label="Amount" value={`${c.amount} ${c.asset}`} />
        <Row label="Fee" value={`− ${c.fee} ${c.asset}`} />
        <Row label="You receive" value={`${c.receiveAmount} ${c.asset}`} strong />
        <Row label="Destination" value={c.destinationId} />
        <Row label="Created" value={new Date(c.createdAt).toLocaleString()} />
        <Row label="Updated" value={new Date(c.updatedAt).toLocaleString()} />
        <T muted size={12}>
          ID {c.id}
        </T>
      </Card>

      <Button title="Back to balances" variant="secondary" onPress={() => router.replace('/')} />
    </Screen>
  );
}
