import { router } from 'expo-router';

import { TokenForm } from '@/components/token-form';
import { Button, Card, Screen, T } from '@/components/ui';
import { queryClient } from '@/lib/query';
import { useStore } from '@/lib/store';
import { clearToken, tokenStore } from '@/lib/token';

export default function Settings() {
  const { token } = useStore(tokenStore);
  return (
    <Screen>
      <Card>
        <T bold>Current token</T>
        <T muted>{token ? `••••${token.slice(-4)}` : 'Not set'}</T>
      </Card>
      <TokenForm />
      <Button
        title="Remove token"
        variant="secondary"
        onPress={() => {
          clearToken();
          queryClient.clear();
          router.replace('/');
        }}
      />
    </Screen>
  );
}
