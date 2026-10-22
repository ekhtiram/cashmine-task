import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { setToken } from '@/lib/session';

import { Button, Card, colors, Notice, T } from './ui';

export function TokenForm({ rejected }: { rejected?: boolean }) {
  const [value, setValue] = useState('');
  const submit = () => {
    if (!value.trim()) return;
    setToken(value);
    setValue('');
  };
  return (
    <Card>
      <T bold size={18}>
        API token
      </T>
      <T muted>Paste the token from your task email. It is stored only in this browser.</T>
      {rejected ? (
        <Notice tone="error" title="The server rejected the token">
          <T style={{ color: colors.danger }}>It may be wrong or expired. Enter it again.</T>
        </Notice>
      ) : null}
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder="Token"
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        onSubmitEditing={submit}
        style={styles.input}
      />
      <Button title="Save token" onPress={submit} disabled={!value.trim()} />
    </Card>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#fff',
  },
});
