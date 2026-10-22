import { ActivityIndicator, View } from 'react-native';

import type { Claim } from '@/lib/api';

import { Card, colors, Notice, Row, T } from './ui';

export function ClaimStatusCard({ claim: c }: { claim: Claim }) {
  return (
    <>
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
    </>
  );
}
