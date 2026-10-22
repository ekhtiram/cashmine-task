import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

export const colors = {
  bg: '#F4F5F7',
  card: '#FFFFFF',
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  primary: '#0F766E',
  danger: '#B91C1C',
  dangerBg: '#FEF2F2',
  warnBg: '#FFFBEB',
  warn: '#92400E',
  infoBg: '#EFF6FF',
  info: '#1E40AF',
  okBg: '#ECFDF5',
  ok: '#065F46',
};

export function Screen({ children, ...props }: ScrollViewProps & { children: ReactNode }) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
      {...props}>
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function T({
  children,
  style,
  muted,
  bold,
  size,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  muted?: boolean;
  bold?: boolean;
  size?: number;
}) {
  return (
    <Text
      style={[
        { color: muted ? colors.muted : colors.text, fontSize: size ?? 15 },
        bold && { fontWeight: '600' },
        style,
      ]}>
      {children}
    </Text>
  );
}

export function Button({
  title,
  onPress,
  disabled,
  loading,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
}) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        primary ? { backgroundColor: colors.primary } : styles.secondary,
        (disabled || loading) && { opacity: 0.45 },
        pressed && { opacity: 0.8 },
      ]}>
      {loading ? (
        <ActivityIndicator color={primary ? '#fff' : colors.primary} />
      ) : (
        <Text style={{ color: primary ? '#fff' : colors.primary, fontWeight: '600', fontSize: 15 }}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const tones = {
  error: { bg: colors.dangerBg, fg: colors.danger },
  warn: { bg: colors.warnBg, fg: colors.warn },
  info: { bg: colors.infoBg, fg: colors.info },
  ok: { bg: colors.okBg, fg: colors.ok },
};

export function Notice({
  tone,
  title,
  children,
}: {
  tone: keyof typeof tones;
  title: string;
  children?: ReactNode;
}) {
  const t = tones[tone];
  return (
    <View style={[styles.notice, { backgroundColor: t.bg }]}>
      <Text style={{ color: t.fg, fontWeight: '600', fontSize: 15 }}>{title}</Text>
      {children}
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} />
      {label ? <T muted>{label}</T> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.center}>
      <Notice tone="error" title="Something went wrong">
        <T style={{ color: colors.danger }}>{message}</T>
      </Notice>
      <Button title="Try again" onPress={onRetry} />
    </View>
  );
}

export function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <T muted>{label}</T>
      <T bold={strong} style={{ flexShrink: 1, textAlign: 'right' }}>
        {value}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 12, paddingBottom: 40 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  button: {
    minHeight: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.primary },
  notice: { borderRadius: 10, padding: 12, gap: 6 },
  center: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
});
