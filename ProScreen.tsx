import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FREE_HISTORY_DAYS, FREE_ROUTINE_LIMIT, PRO_HISTORY_DAYS, PRO_PRICE_LABEL, TEST_MODE, usePro } from '../pro';
import { F, usePalette } from '../theme';

export type ProReason = 'routines' | 'history' | 'browse';

const HEADLINE: Record<ProReason, string> = {
  routines: `Free includes ${FREE_ROUTINE_LIMIT} routines`,
  history: `See all ${PRO_HISTORY_DAYS} days of workouts`,
  browse: 'HIIT Timer Pro',
};

const BENEFITS: [string, string][] = [
  ['Unlimited routines', `Save as many routines as you like. Free keeps ${FREE_ROUTINE_LIMIT}.`],
  [`${PRO_HISTORY_DAYS}-day history`, `Every workout from the last ${PRO_HISTORY_DAYS} days. Free shows ${FREE_HISTORY_DAYS}.`],
  ['Future Pro features', 'New Pro features are included as they arrive.'],
];

export default function ProScreen({ visible, reason, onClose }: { visible: boolean; reason: ProReason; onClose: () => void }) {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const { isPro, purchase, restore } = usePro();
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [msg, setMsg] = useState('');

  const doBuy = async () => {
    setBusy('buy');
    setMsg('');
    const ok = await purchase();
    setBusy(null);
    if (ok) onClose();
    else setMsg('The purchase didn’t go through. You haven’t been charged. Try again in a moment.');
  };
  const doRestore = async () => {
    setBusy('restore');
    setMsg('');
    const ok = await restore();
    setBusy(null);
    if (ok) onClose();
    else setMsg('No earlier Pro purchase was found for this Apple ID.');
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={{ flex: 1, backgroundColor: c.bg }}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 30, gap: 18, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
        <Pressable onPress={onClose} hitSlop={10} style={{ alignSelf: 'flex-end' }}>
          <Text style={{ color: c.accent, fontFamily: F.bodyBold, fontSize: 16 }}>Not now</Text>
        </Pressable>

        <View style={{ gap: 6 }}>
          <Text style={[s.eyebrow, { color: c.accent }]}>HIIT Timer Pro</Text>
          <Text style={[s.h1, { color: c.ink }]}>{HEADLINE[reason]}</Text>
          <Text style={{ color: c.muted, fontFamily: F.body, fontSize: 16 }}>One payment. No subscription.</Text>
        </View>

        <View style={[s.card, { backgroundColor: c.surface, borderColor: c.line }]}>
          {BENEFITS.map(([t, d]) => (
            <View key={t} style={s.benefit}>
              <View style={[s.check, { backgroundColor: c.accent }]}>
                <Text style={{ color: c.accentInk, fontFamily: F.bodyBold, fontSize: 14 }}>✓</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.ink, fontFamily: F.bodyBold, fontSize: 16 }}>{t}</Text>
                <Text style={{ color: c.muted, fontFamily: F.body, fontSize: 14 }}>{d}</Text>
              </View>
            </View>
          ))}
        </View>

        {isPro ? (
          <Text style={{ color: c.good, fontFamily: F.bodyBold, fontSize: 16, textAlign: 'center' }}>Pro is unlocked on this phone.</Text>
        ) : (
          <>
            <Pressable onPress={doBuy} disabled={!!busy} style={[s.btn, { backgroundColor: c.accent, opacity: busy ? 0.7 : 1 }]}>
              {busy === 'buy' ? <ActivityIndicator color={c.accentInk} /> :
                <Text style={{ color: c.accentInk, fontFamily: F.bodyBold, fontSize: 18 }}>Unlock Pro · {PRO_PRICE_LABEL}</Text>}
            </Pressable>
            <Pressable onPress={doRestore} disabled={!!busy} style={[s.btn, { borderWidth: 1.5, borderColor: c.line }]}>
              {busy === 'restore' ? <ActivityIndicator color={c.ink} /> :
                <Text style={{ color: c.ink, fontFamily: F.bodyBold, fontSize: 16 }}>Restore purchase</Text>}
            </Pressable>
          </>
        )}
        {msg ? <Text style={{ color: c.danger, fontFamily: F.bodySemi, fontSize: 15, textAlign: 'center' }}>{msg}</Text> : null}

        {TEST_MODE ? (
          <View style={[s.test, { borderColor: c.line }]}>
            <Text style={{ color: c.muted, fontFamily: F.bodySemi, fontSize: 13, textAlign: 'center' }}>
              Test mode: Unlock turns on Pro without charging. Real purchases start when the app is on the App Store.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </Modal>
  );
}

const s = StyleSheet.create({
  eyebrow: { fontFamily: F.bodyBold, fontSize: 13, letterSpacing: 1.4, textTransform: 'uppercase' },
  h1: { fontFamily: F.displayHeavy, fontSize: 38, lineHeight: 40, textTransform: 'uppercase' },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 14 },
  benefit: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  check: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  btn: { minHeight: 54, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  test: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, padding: 10 },
});
