import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ClaimNotices } from '@/components/claim-notices';
import {
  Button,
  Card,
  colors,
  ErrorState,
  Loading,
  Notice,
  Row,
  Screen,
  T,
} from '@/components/ui';
import { ApiError, getClaimOptions } from '@/lib/api';
import { displayBalances } from '@/lib/balances';
import { claimsStore, isAssetBlocked, startClaim } from '@/lib/claims';
import { formatUnits, toUnits, validateClaim } from '@/lib/money';
import { useBalances } from '@/lib/query';
import { useStore } from '@/lib/store';
import { useTokenScope } from '@/lib/token';

export default function ClaimScreen() {
  const params = useLocalSearchParams<{ asset?: string }>();
  const balances = useBalances();
  const { claims } = useStore(claimsStore);
  const [asset, setAsset] = useState<string | null>(params.asset ?? null);
  const [input, setInput] = useState('');
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'review'>('form');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const scope = useTokenScope();
  const options = useQuery({
    queryKey: ['claim-options', scope, asset],
    queryFn: () => getClaimOptions(asset!),
    enabled: !!asset,
  });

  if (balances.isPending) return <Loading label="Loading balances…" />;
  if (!balances.data) {
    return (
      <ErrorState
        message={balances.error?.message ?? 'Unknown error'}
        onRetry={() => balances.refetch()}
      />
    );
  }
  const asOf = balances.data.asOf;
  let rows;
  try {
    rows = displayBalances(balances.data, claims);
  } catch (e) {
    return <ErrorState message={(e as Error).message} onRetry={() => balances.refetch()} />;
  }
  const row = rows.find((r) => r.asset === asset);

  const pickAsset = (a: string) => {
    setAsset(a);
    setInput('');
    setDestinationId(null);
    setStep('form');
    setServerError(null);
  };

  const assetPicker = (
    <Card>
      <T bold>Asset</T>
      <View style={styles.chips}>
        {rows.map((r) => {
          const selected = r.asset === asset;
          return (
            <Pressable
              key={r.asset}
              onPress={() => pickAsset(r.asset)}
              style={[styles.chip, selected && styles.chipSelected]}>
              <T bold style={selected ? { color: '#fff' } : undefined}>
                {r.asset}
              </T>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );

  if (!asset || !row) {
    return (
      <Screen>
        {assetPicker}
        {asset && !row ? <Notice tone="error" title={`Unknown asset ${asset}`} /> : null}
      </Screen>
    );
  }

  const fmt = (u: bigint) => `${formatUnits(u, row.decimals)} ${row.asset}`;

  if (isAssetBlocked(asset, asOf)) {
    return (
      <Screen>
        {assetPicker}
        <ClaimNotices asOf={asOf} asset={asset} />
        <Notice tone="info" title={`A ${asset} claim is still in progress`}>
          <T style={{ color: colors.info }}>
            You can start a new {asset} claim once it is resolved and your balance is updated.
          </T>
        </Notice>
      </Screen>
    );
  }

  if (options.isPending) {
    return (
      <Screen>
        {assetPicker}
        <Loading label="Loading claim options…" />
      </Screen>
    );
  }
  if (!options.data) {
    return (
      <Screen>
        {assetPicker}
        <ErrorState
          message={options.error?.message ?? 'Unknown error'}
          onRetry={() => options.refetch()}
        />
      </Screen>
    );
  }

  let minAmount: bigint;
  let fee: bigint;
  try {
    minAmount = toUnits(options.data.minAmount, row.decimals);
    fee = toUnits(options.data.fee, row.decimals);
  } catch (e) {
    return <ErrorState message={(e as Error).message} onRetry={() => options.refetch()} />;
  }
  const destinations = options.data.destinations;
  const destination = destinations.find((d) => d.id === destinationId) ?? destinations[0];
  const check = validateClaim({
    input,
    decimals: row.decimals,
    minAmount,
    fee,
    available: row.availableUnits,
  });
  const showError = input.trim() !== '' && !check.ok;

  const confirm = async () => {
    if (!check.ok || !destination) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const claim = await startClaim(
        {
          asset: row.asset,
          amount: formatUnits(check.units, row.decimals),
          destinationId: destination.id,
        },
        asOf,
      );
      if (claim) router.replace(`/claims/${claim.id}`);
      // null = outcome unknown: the screen re-renders as "blocked" with the intent notice.
    } catch (e) {
      setServerError(
        e instanceof ApiError || e instanceof Error ? e.message : 'The claim was rejected',
      );
      setStep('form');
      balances.refetch();
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'review' && check.ok && destination) {
    return (
      <Screen>
        <Card>
          <T bold size={18}>
            Review claim
          </T>
          <Row label="Amount" value={fmt(check.units)} />
          <Row label="Fee" value={`− ${fmt(fee)}`} />
          <Row label="You receive" value={fmt(check.receive)} strong />
          <Row label="To" value={destination.label} />
        </Card>
        <Button title="Confirm claim" onPress={confirm} loading={submitting} />
        <Button
          title="Back"
          variant="secondary"
          onPress={() => setStep('form')}
          disabled={submitting}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      {assetPicker}
      <Card>
        <Row label="Available" value={fmt(row.availableUnits)} strong />
        <Row label="Minimum" value={fmt(minAmount)} />
        <Row label="Fee" value={fmt(fee)} />
        {row.availableUnits < minAmount ? (
          <Notice tone="warn" title="Not enough to claim yet">
            <T style={{ color: colors.warn }}>
              You need at least {fmt(minAmount)} available.
            </T>
          </Notice>
        ) : null}
      </Card>

      <Card>
        <T bold>Amount</T>
        <View style={styles.amountRow}>
          <TextInput
            value={input}
            onChangeText={(v) => {
              setInput(v);
              setServerError(null);
            }}
            placeholder="0.00"
            keyboardType="decimal-pad"
            inputMode="decimal"
            autoCorrect={false}
            style={[styles.input, showError && { borderColor: colors.danger }]}
          />
          <Pressable
            onPress={() => setInput(formatUnits(row.availableUnits, row.decimals))}
            style={styles.max}
            accessibilityRole="button">
            <T bold style={{ color: colors.primary }}>
              Max
            </T>
          </Pressable>
        </View>
        {showError ? <T style={{ color: colors.danger }}>{check.error}</T> : null}
        {serverError ? <T style={{ color: colors.danger }}>{serverError}</T> : null}
        {check.ok ? (
          <View style={{ gap: 4, marginTop: 4 }}>
            <Row label="Fee" value={`− ${fmt(fee)}`} />
            <Row label="You receive" value={fmt(check.receive)} strong />
          </View>
        ) : null}
      </Card>

      {destinations.length > 1 ? (
        <Card>
          <T bold>Destination</T>
          {destinations.map((d) => (
            <Pressable
              key={d.id}
              onPress={() => setDestinationId(d.id)}
              style={[styles.dest, d.id === destination?.id && styles.destSelected]}>
              <T>{d.label}</T>
            </Pressable>
          ))}
        </Card>
      ) : destination ? (
        <Card>
          <Row label="To" value={destination.label} />
        </Card>
      ) : (
        <Notice tone="error" title="No destination available for this asset" />
      )}

      <Button
        title="Review"
        onPress={() => setStep('review')}
        disabled={!check.ok || !destination}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  amountRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 18,
    backgroundColor: '#fff',
  },
  max: {
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  dest: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  destSelected: { borderColor: colors.primary, backgroundColor: colors.okBg },
});
