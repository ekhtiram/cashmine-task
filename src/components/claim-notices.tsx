import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { claimResolved } from '@/lib/balances';
import { claimsStore, dismissClaim, sendIntent, type Intent } from '@/lib/claims';
import { useStore } from '@/lib/store';

import { Button, colors, Notice, T } from './ui';

/** Cards for every claim the user should know about: unknown results, processing, failed. */
export function ClaimNotices({ asOf, asset }: { asOf?: string; asset?: string }) {
  const { intents, claims } = useStore(claimsStore);
  const intentList = Object.values(intents).filter((i) => !asset || i.body.asset === asset);
  const claimList = claims.filter((c) => !c.dismissed && (!asset || c.asset === asset));
  return (
    <>
      {intentList.map((i) => (
        <IntentNotice key={i.key} intent={i} />
      ))}
      {claimList.map((c) => {
        const what = `${c.amount} ${c.asset}`;
        if (c.status === 'pending') {
          return (
            <Notice key={c.id} tone="info" title={`Claim of ${what} is processing`}>
              <T style={{ color: colors.info }}>
                It has already been deducted from your available balance. This usually takes
                about 20 seconds.
              </T>
              <Button
                title="View status"
                variant="secondary"
                onPress={() => router.push(`/claims/${c.id}`)}
              />
            </Notice>
          );
        }
        if (c.status === 'completed') {
          return (
            <Notice key={c.id} tone="ok" title={`Claim of ${what} completed`}>
              <T style={{ color: colors.ok }}>
                You received {c.receiveAmount} {c.asset} (fee {c.fee}).
                {claimResolved(c, asOf) ? '' : ' Balances are updating.'}
              </T>
            </Notice>
          );
        }
        return (
          <Notice key={c.id} tone="error" title={`Claim of ${what} failed`}>
            <T style={{ color: colors.danger }}>
              {c.failureReason ?? 'No reason given.'} {what} was returned to your available
              balance.
            </T>
            <Button title="Dismiss" variant="secondary" onPress={() => dismissClaim(c.id)} />
          </Notice>
        );
      })}
    </>
  );
}

function IntentNotice({ intent }: { intent: Intent }) {
  const [error, setError] = useState<string | null>(null);
  const what = `${intent.body.amount} ${intent.body.asset}`;
  const check = async () => {
    setError(null);
    try {
      const claim = await sendIntent(intent.body.asset);
      if (claim) router.push(`/claims/${claim.id}`);
    } catch (e) {
      setError(
        `The claim was not created: ${e instanceof Error ? e.message : 'rejected'}. ` +
          'Your balance was not changed.',
      );
    }
  };
  if (error) {
    return (
      <Notice tone="error" title={`Claim of ${what} was not created`}>
        <T style={{ color: colors.danger }}>{error}</T>
      </Notice>
    );
  }
  if (intent.phase === 'sending') {
    return (
      <Notice tone="info" title={`Submitting claim of ${what}…`}>
        <T style={{ color: colors.info }}>Please wait. Don’t submit it again.</T>
      </Notice>
    );
  }
  return (
    <Notice tone="warn" title={`We couldn’t confirm your claim of ${what}`}>
      <T style={{ color: colors.warn }}>
        It may or may not have been created. We will check using the same request, so it can never
        be created twice. You can’t start another {intent.body.asset} claim until this is resolved.
      </T>
      {intent.error ? <T muted>Last error: {intent.error}</T> : null}
      <View>
        <Button title="Check again" onPress={check} />
      </View>
    </Notice>
  );
}
