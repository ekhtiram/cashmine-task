import { router } from 'expo-router';

import { TokenForm } from '@/components/token-form';
import { Button, Card, Screen, T } from '@/components/ui';
import { useStore } from '@/lib/store';
import { setToken } from '@/lib/session';
import { tokenStore } from '@/lib/token';

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
          setToken(null);
          router.replace('/');
        }}
      />
    </Screen>
  );
}
