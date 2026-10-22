import type { ErrorBoundaryProps } from 'expo-router';
import { ScrollView, Text } from 'react-native';

import { Button, colors } from './ui';

/** Shows the actual error instead of a blank page (used as an Expo Router ErrorBoundary). */
export function ErrorFallback({ error, retry }: ErrorBoundaryProps) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ color: colors.danger, fontWeight: '600', fontSize: 17 }}>
        Something went wrong on this screen
      </Text>
      <Text selectable style={{ color: colors.text, fontSize: 14 }}>
        {error.name}: {error.message}
      </Text>
      <Text selectable style={{ color: colors.muted, fontSize: 11, fontFamily: 'monospace' }}>
        {error.stack}
      </Text>
      <Button title="Try again" onPress={retry} />
    </ScrollView>
  );
}
