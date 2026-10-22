import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { ClaimNotices } from '@/components/claim-notices';
import { Button, Card, colors, ErrorState, Loading, Notice, Row, Screen, T } from '@/components/ui';
import { displayBalances, type DisplayBalance } from '@/lib/balances';
import { blockReason, claimsStore } from '@/lib/claims';
import { formatUnits, formatUsd, usdCents } from '@/lib/money';
import { useBalances } from '@/lib/query';
import { useStore } from '@/lib/store';

const STALE_AFTER_MS = 60_000;

export default function Home() {
  const balances = useBalances(15_000);
  const { claims } = useStore(claimsStore);
  const now = useNow(5_000);
  const [manualRefresh, setManualRefresh] = useState(false);

  const refresh = async () => {
    setManualRefresh(true);
    await balances.refetch();
    setManualRefresh(false);
  };

  if (balances.isPending) return <Loading label="Loading balances…" />;
  if (!balances.data) {
    return <ErrorState message={balances.error?.message ?? 'Unknown error'} onRetry={refresh} />;
  }

  const { asOf } = balances.data;
  let rows: DisplayBalance[];
  try {
    rows = displayBalances(balances.data, claims);
  } catch (e) {
    // Never show numbers we couldn't parse exactly.
    return <ErrorState message={(e as Error).message} onRetry={refresh} />;
  }
  const total = usdCents(
    rows.map((r) => ({
      units: r.availableUnits + r.pendingUnits,
      decimals: r.decimals,
      usdPrice: r.usdPrice,
    })),
  );
  const ageMs = now - Date.parse(asOf);

  return (
    <Screen refreshControl={<RefreshControl refreshing={manualRefresh} onRefresh={refresh} />}>
      <Card>
        <T muted>Total balance (available + pending)</T>
        <T bold size={30}>
          ≈ {formatUsd(total)}
        </T>
        <T muted size={13}>
          Snapshot from {new Date(asOf).toLocaleTimeString()} ({formatAge(ageMs)})
          {balances.isFetching ? ' · refreshing…' : ''}
        </T>
        <View style={styles.actions}>
          <View style={{ flex: 1 }}>
            <Button title="Refresh" variant="secondary" onPress={refresh} loading={manualRefresh} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Claim" onPress={() => router.push('/claim')} />
          </View>
        </View>
      </Card>

      {balances.isError ? (
        <Notice tone="warn" title="Couldn't refresh balances">
          <T style={{ color: colors.warn }}>
            {balances.error.message} Showing the last snapshot.
          </T>
        </Notice>
      ) : ageMs > STALE_AFTER_MS ? (
        <Notice tone="warn" title="Balances may be out of date" />
      ) : null}

      <ClaimNotices asOf={asOf} />

      {rows.map((r) => (
        <AssetCard key={r.asset} b={r} blocked={blockReason(r.asset, asOf)} />
      ))}

      <Link href="/settings" style={styles.link}>
        Settings (API token)
      </Link>
    </Screen>
  );
}

function AssetCard({ b, blocked }: { b: DisplayBalance; blocked: string | null }) {
  const fmt = (u: bigint) => `${formatUnits(u, b.decimals)} ${b.asset}`;
  const usd = usdCents([{ units: b.availableUnits, decimals: b.decimals, usdPrice: b.usdPrice }]);
  return (
    <Card>
      <View style={styles.assetHeader}>
        <T bold size={18}>
          {b.asset}
        </T>
        <T muted>≈ {formatUsd(usd)} available</T>
      </View>
      <Row label="Available" value={fmt(b.availableUnits)} strong />
      <Row label="Pending" value={fmt(b.pendingUnits)} />
      <Row label="Claiming" value={fmt(b.claimingUnits)} />
      {b.adjusted ? (
        <T size={13} style={{ color: colors.info }}>
          Includes your recent claim; the server snapshot hasn’t caught up yet.
        </T>
      ) : null}
      {blocked ? (
        <T size={13} muted>
          {blocked}
        </T>
      ) : (
        <Button
          title={`Claim ${b.asset}`}
          variant="secondary"
          disabled={b.availableUnits <= 0n}
          onPress={() => router.push({ pathname: '/claim', params: { asset: b.asset } })}
        />
      )}
    </Card>
  );
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function formatAge(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return `${m} min ago`;
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  assetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  link: { color: colors.primary, textAlign: 'center', padding: 12, fontSize: 15 },
});
