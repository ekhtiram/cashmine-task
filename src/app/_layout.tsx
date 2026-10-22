import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ClaimWatcher } from '@/components/claim-watcher';
import { ErrorFallback } from '@/components/error-fallback';
import { TokenForm } from '@/components/token-form';
import { colors } from '@/components/ui';
import { queryClient } from '@/lib/query';
import { useStore } from '@/lib/store';
import { tokenStore } from '@/lib/token';

// Root-level boundary: a crash anywhere shows its message instead of a white page.
export { ErrorFallback as ErrorBoundary };

export default function RootLayout() {
  const { token, rejected } = useStore(tokenStore);
  const needsToken = !token || rejected;
  return (
    <QueryClientProvider client={queryClient}>
      <View style={styles.page}>
        <View style={styles.app}>
          <Stack screenOptions={{ contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="index" options={{ title: 'Payback' }} />
            <Stack.Screen name="claim" options={{ title: 'Claim' }} />
            <Stack.Screen name="claims/[id]" options={{ title: 'Claim status' }} />
            <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          </Stack>
          {token && !rejected ? <ClaimWatcher /> : null}
          {needsToken ? (
            <View style={[StyleSheet.absoluteFill, styles.gate]}>
              <TokenForm rejected={rejected} />
            </View>
          ) : null}
        </View>
      </View>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#E5E7EB', alignItems: 'center' },
  app: { flex: 1, width: '100%', maxWidth: 480, backgroundColor: colors.bg },
  gate: { backgroundColor: colors.bg, padding: 16, justifyContent: 'center' },
});
