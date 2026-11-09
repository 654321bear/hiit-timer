import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CoachVoice, initAudio, listVoices, say } from '../audio';
import SpeakerIcon from '../components/SpeakerIcon';
import { FREE_HISTORY_DAYS, FREE_ROUTINE_LIMIT, PRO_HISTORY_DAYS, TEST_MODE } from '../pro';
import type { ProReason } from './ProScreen';
import { fmtLong, fmtTotal, HistoryEntry, Routine, totalOf } from '../plan';
import { F, Palette, usePalette } from '../theme';

const DAY = 86400000;

export default function HomeScreen(props: {
  routines: Routine[];
  history: HistoryEntry[];
  voiceId: string | null;
  onVoice: (id: string) => void;
  onNew: () => void;
  onEdit: (r: Routine) => void;
  onStart: (r: Routine) => void;
  onClearHistory: () => void;
  isPro: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onUpgrade: (reason: ProReason) => void;
  onResetPro: () => void;
}) {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'R' | 'H'>('R');
  const [menuOpen, setMenuOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40, paddingHorizontal: 16, gap: 20, maxWidth: 560, width: '100%', alignSelf: 'center' }}
    >
      <View style={s.header}>
        <View style={s.toolbar}>
          <Pressable onPress={props.onToggleMute} hitSlop={6} accessibilityRole="button"
            accessibilityLabel={props.muted ? 'Turn voice cues on' : 'Mute voice cues'}
            style={[s.more, { borderColor: c.line, backgroundColor: props.muted ? c.surface : 'transparent' }]}>
            <SpeakerIcon muted={props.muted} color={props.muted ? c.muted : c.ink} size={22} />
          </Pressable>
          <Pressable onPress={() => setMenuOpen(true)} accessibilityLabel="More options" hitSlop={6}
            style={[s.more, { borderColor: c.line }]}>
            <View style={s.moreDots}>
              {[0, 1, 2].map((i) => <View key={i} style={[s.moreDot, { backgroundColor: c.ink }]} />)}
            </View>
          </Pressable>
        </View>
        <Text style={[s.h1, { color: c.ink }]}>HIIT Interval Circuit Timer</Text>
        <View style={s.subRow}>
          <Text style={{ flex: 1, color: c.muted, fontFamily: F.body, fontSize: 15 }}>
            {props.muted ? 'Voice muted · ' : ''}{props.isPro ? 'Pro · ' : ''}{props.routines.length} {props.routines.length === 1 ? 'routine' : 'routines'} saved{props.isPro ? '' : ` of ${FREE_ROUTINE_LIMIT} free`}
          </Text>
          <Pressable onPress={props.onNew} style={[s.btn, { backgroundColor: c.accent }]}>
            <Text style={{ color: c.accentInk, fontFamily: F.bodyBold, fontSize: 16 }}>+ New</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setMenuOpen(false)}>
          <View style={[s.menu, { top: insets.top + 66, right: insets.right + 16, backgroundColor: c.surface, borderColor: c.line }]}>
            <MenuItem c={c} label="Coach voice" detail="Choose and test the voice" onPress={() => { setMenuOpen(false); setVoiceOpen(true); }} />
            <View style={{ height: 1, backgroundColor: c.line }} />
            <MenuItem c={c} label="HIIT Timer Pro" detail={props.isPro ? 'Unlocked' : 'Unlimited routines, 30-day history'}
              onPress={() => { setMenuOpen(false); props.onUpgrade('browse'); }} />
          </View>
        </Pressable>
      </Modal>

      <VoiceSheet c={c} visible={voiceOpen} onClose={() => setVoiceOpen(false)} voiceId={props.voiceId} onVoice={props.onVoice} />

      <View style={[s.tabs, { backgroundColor: c.surface, borderColor: c.line }]}>
        {(['R', 'H'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} accessibilityRole="tab" accessibilityState={{ selected: tab === t }}
            style={[s.tab, tab === t && { backgroundColor: c.accent }]}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: tab === t ? c.accentInk : c.muted }}>{t === 'R' ? 'Routines' : 'History'}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'R' ? (
        <>
          {props.routines.length === 0 ? (
            <Text style={[s.empty, { color: c.muted }]}>No routines yet. Tap + New to build one.</Text>
          ) : (
            props.routines.map((r) => <RoutineCard key={r.id} r={r} c={c} onStart={() => props.onStart(r)} onEdit={() => props.onEdit(r)} />)
          )}
          <ProCard c={c} isPro={props.isPro} onUpgrade={() => props.onUpgrade('browse')} onReset={props.onResetPro} />
        </>
      ) : (
        <History c={c} history={props.history} onClear={props.onClearHistory} isPro={props.isPro} onUpgrade={() => props.onUpgrade('history')} />
      )}
    </ScrollView>
  );
}

function RoutineCard({ r, c, onStart, onEdit }: { r: Routine; c: Palette; onStart: () => void; onEdit: () => void }) {
  const stats: [string, string][] = [
    ['Rounds', String(r.rounds)],
    ['Work', fmtLong(r.work)],
    ['Rest', fmtLong(r.rest)],
    ['Round rest', fmtLong(r.cycle)],
  ];
  return (
    <View style={[s.card, { backgroundColor: c.surface, borderColor: c.line }]}>
      {r.example ? (
        <Text style={[s.tag, { color: c.muted, borderColor: c.line }]}>EXAMPLE — EDIT OR DELETE IT</Text>
      ) : null}
      <View style={s.cardHead}>
        <Text style={[s.h2, { color: c.ink }]}>{r.name}</Text>
        <Text style={{ color: c.accent, fontFamily: F.display, fontSize: 21, fontVariant: ['tabular-nums'] }}>{fmtLong(totalOf(r))}</Text>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {stats.map(([k, v]) => (
          <View key={k} style={{ flex: 1 }}>
            <Text style={[s.dt, { color: c.muted }]}>{k}</Text>
            <Text style={{ color: c.ink, fontFamily: F.bodyBold, fontSize: 16, fontVariant: ['tabular-nums'] }}>{v}</Text>
          </View>
        ))}
      </View>
      <Text style={{ color: c.muted, fontFamily: F.body, fontSize: 15 }}>{r.exercises.join(' · ')}</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable onPress={onStart} style={[s.btn, { flex: 1, backgroundColor: c.accent }]}>
          <Text style={{ color: c.accentInk, fontFamily: F.bodyBold, fontSize: 16 }}>▶ Start</Text>
        </Pressable>
        <Pressable onPress={onEdit} style={[s.btn, { borderWidth: 1.5, borderColor: c.line }]}>
          <Text style={{ color: c.ink, fontFamily: F.bodyBold, fontSize: 16 }}>Edit</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MenuItem({ c, label, detail, onPress }: { c: Palette; label: string; detail: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.menuItem, pressed && { backgroundColor: c.bg }]}>
      <Text style={{ color: c.ink, fontFamily: F.bodyBold, fontSize: 16 }}>{label}</Text>
      <Text style={{ color: c.muted, fontFamily: F.body, fontSize: 13 }}>{detail}</Text>
    </Pressable>
  );
}

function VoiceSheet({ c, visible, onClose, voiceId, onVoice }: {
  c: Palette; visible: boolean; onClose: () => void; voiceId: string | null; onVoice: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [voices, setVoices] = useState<CoachVoice[]>([]);
  useEffect(() => {
    if (visible) listVoices().then(setVoices);
  }, [visible]);
  const current = voices.find((v) => v.id === voiceId) || voices[0];
  const test = () => initAudio().then(() => say('Goblet squats. 3. 2. 1. Go. Halfway there.', true, true));
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={[s.sheetHead, { borderColor: c.line }]}>
          <Text style={[s.h2, { color: c.ink, flex: 1 }]}>Coach voice</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={{ color: c.accent, fontFamily: F.bodyBold, fontSize: 17 }}>Done</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30, gap: 10, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
          <Pressable onPress={test} style={[s.btn, { borderWidth: 1.5, borderColor: c.line }]}>
            <Text style={{ color: c.ink, fontFamily: F.bodyBold, fontSize: 16 }}>▶ Test {current ? current.name : 'voice'}</Text>
          </Pressable>
          {voices.length === 0 ? (
            <Text style={[s.empty, { color: c.muted }]}>Using the phone's default voice.</Text>
          ) : (
            voices.map((v) => {
              const on = current?.id === v.id;
              return (
                <Pressable key={v.id} onPress={() => { onVoice(v.id); setTimeout(test, 50); }}
                  style={[s.voiceRow, { backgroundColor: c.surface, borderColor: on ? c.accent : c.line }]}>
                  <View style={[s.radio, { borderColor: on ? c.accent : c.line }]}>
                    {on ? <View style={[s.radioDot, { backgroundColor: c.accent }]} /> : null}
                  </View>
                  <Text style={{ color: c.ink, fontFamily: on ? F.bodyBold : F.body, fontSize: 16, flex: 1 }}>{v.name}</Text>
                  <Text style={{ color: c.muted, fontFamily: F.body, fontSize: 13 }}>{v.enhanced ? 'Enhanced · ' : ''}{v.lang}</Text>
                </Pressable>
              );
            })
          )}
          <Text style={{ color: c.muted, fontFamily: F.body, fontSize: 13, marginTop: 6 }}>
            Tap a voice to choose it and hear a sample. For the most natural sound, download a Premium or Enhanced voice: Settings → Accessibility → Spoken Content → Voices → English, then come back here.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

function ProCard({ c, isPro, onUpgrade, onReset }: { c: Palette; isPro: boolean; onUpgrade: () => void; onReset: () => void }) {
  if (isPro) {
    return (
      <View style={[s.card, { backgroundColor: c.surface, borderColor: c.line, gap: 8 }]}>
        <Text style={{ color: c.good, fontFamily: F.bodyBold, fontSize: 16 }}>✓ Pro unlocked</Text>
        <Text style={{ color: c.muted, fontFamily: F.body, fontSize: 14 }}>Unlimited routines and {PRO_HISTORY_DAYS}-day history.</Text>
        {TEST_MODE ? (
          <Pressable onPress={onReset} style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
            <Text style={{ color: c.accent, fontFamily: F.bodyBold, fontSize: 14 }}>Test mode: switch back to Free</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  return (
    <Pressable onPress={onUpgrade} style={[s.card, { backgroundColor: c.surface, borderColor: c.accent, borderWidth: 1.5, gap: 6 }]}>
      <Text style={[s.label, { color: c.accent }]}>HIIT Timer Pro</Text>
      <Text style={{ color: c.ink, fontFamily: F.bodyBold, fontSize: 17 }}>Unlimited routines and {PRO_HISTORY_DAYS}-day history</Text>
      <Text style={{ color: c.muted, fontFamily: F.body, fontSize: 14 }}>One payment, no subscription. Tap to see details.</Text>
    </Pressable>
  );
}

function History({ c, history: all, onClear, isPro, onUpgrade }: {
  c: Palette; history: HistoryEntry[]; onClear: () => void; isPro: boolean; onUpgrade: () => void;
}) {
  const [armed, setArmed] = useState(false);
  const span = isPro ? PRO_HISTORY_DAYS : FREE_HISTORY_DAYS;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const keyOf = (t: number) => {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const cutoff = today.getTime() - (span - 1) * DAY;
  const history = all.filter((h) => keyOf(h.t) >= cutoff);
  const hidden = all.length - history.length;
  const active = new Set(history.map((h) => keyOf(h.t)));
  const totalSec = history.reduce((a, h) => a + h.dur, 0);
  const days = Array.from({ length: span }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (span - 1 - i));
    return { k: d.getTime(), today: i === span - 1 };
  });
  const groups = new Map<number, HistoryEntry[]>();
  [...history].sort((a, b) => b.t - a.t).forEach((h) => {
    const k = keyOf(h.t);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(h);
  });
  const clear = () => {
    if (!armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 3000);
      return;
    }
    setArmed(false);
    onClear();
  };

  return (
    <View style={{ gap: 20 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {([
          [String(history.length), 'Workouts'],
          [String(active.size), 'Active days'],
          [fmtTotal(totalSec), 'Total time'],
        ] as const).map(([v, k]) => (
          <View key={k} style={[s.sum, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Text style={{ color: c.ink, fontFamily: F.display, fontSize: 28, lineHeight: 30, fontVariant: ['tabular-nums'] }} numberOfLines={1} adjustsFontSizeToFit>{v}</Text>
            <Text style={[s.dt, { color: c.muted }]}>{k}</Text>
          </View>
        ))}
      </View>

      <View style={[s.card, { backgroundColor: c.surface, borderColor: c.line, gap: 10 }]}>
        <Text style={[s.label, { color: c.muted }]}>Workout days</Text>
        <View style={s.strip}>
          {days.map((d) => (
            <View key={d.k} style={[s.dayCell, { width: `${100 / (span === 7 ? 7 : 15)}%` }]}>
              <View style={[s.day, { borderColor: active.has(d.k) ? c.accent : c.line, backgroundColor: active.has(d.k) ? c.accent : 'transparent' },
                d.today && { borderColor: c.ink }]} />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: c.muted, fontFamily: F.body, fontSize: 12 }}>{span} days ago</Text>
          <Text style={{ color: c.muted, fontFamily: F.body, fontSize: 12 }}>Today</Text>
        </View>
      </View>

      {!isPro ? (
        <Pressable onPress={onUpgrade} style={[s.card, { backgroundColor: c.surface, borderColor: c.accent, borderWidth: 1.5, gap: 4 }]}>
          <Text style={{ color: c.ink, fontFamily: F.bodyBold, fontSize: 16 }}>
            {hidden > 0 ? `${hidden} older ${hidden === 1 ? 'workout is' : 'workouts are'} saved` : `Your last ${PRO_HISTORY_DAYS} days are kept`}
          </Text>
          <Text style={{ color: c.muted, fontFamily: F.body, fontSize: 14 }}>Free shows the last {FREE_HISTORY_DAYS} days. Unlock Pro to see all {PRO_HISTORY_DAYS}.</Text>
        </Pressable>
      ) : null}

      {history.length === 0 ? (
        <Text style={[s.empty, { color: c.muted }]}>
          No workouts in the last {span} days yet. Finish a workout, or end one after at least 30 seconds, and it will show up here.
        </Text>
      ) : (
        <>
          {[...groups.entries()].map(([k, items]) => {
            const diff = Math.round((today.getTime() - k) / DAY);
            const label = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday'
              : new Date(k).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
            return (
              <View key={k} style={{ gap: 8 }}>
                <Text style={[s.label, { color: c.muted }]}>{label}</Text>
                {items.map((h, i) => (
                  <View key={h.t + '-' + i} style={[s.hitem, { backgroundColor: c.surface, borderColor: c.line }]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: c.ink, fontFamily: F.bodyBold, fontSize: 16 }}>{h.name}</Text>
                      <Text style={{ color: c.muted, fontFamily: F.body, fontSize: 14, fontVariant: ['tabular-nums'] }}>
                        {new Date(h.t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · {fmtLong(h.dur)}
                      </Text>
                    </View>
                    <Text style={[s.pill, { borderColor: h.done ? c.good : c.line, color: h.done ? c.good : c.muted }]}>
                      {h.done ? 'Completed' : `Ended in round ${h.round} of ${h.rounds}`}
                    </Text>
                  </View>
                ))}
              </View>
            );
          })}
          <Pressable onPress={clear} style={[s.btn, { borderWidth: 1.5, borderColor: c.danger }]}>
            <Text style={{ color: c.danger, fontFamily: F.bodyBold, fontSize: 16 }}>{armed ? 'Tap again to clear all' : 'Clear history'}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: { gap: 8 },
  toolbar: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  more: { width: 46, height: 46, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  moreDots: { flexDirection: 'row', gap: 4 },
  moreDot: { width: 5, height: 5, borderRadius: 3 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  menu: { position: 'absolute', width: 260, borderWidth: 1, borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  menuItem: { paddingVertical: 12, paddingHorizontal: 16, gap: 2 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12, borderBottomWidth: 1 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  h1: { fontFamily: F.displayHeavy, fontSize: 36, lineHeight: 37, textTransform: 'uppercase' },
  h2: { flex: 1, fontFamily: F.display, fontSize: 26, lineHeight: 27, textTransform: 'uppercase' },
  btn: { minHeight: 46, borderRadius: 10, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, padding: 4, gap: 4 },
  tab: { flex: 1, minHeight: 42, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  tag: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, fontFamily: F.bodySemi, fontSize: 11, letterSpacing: 0.9 },
  dt: { fontFamily: F.bodySemi, fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase' },
  label: { fontFamily: F.bodySemi, fontSize: 12, letterSpacing: 1.1, textTransform: 'uppercase' },
  empty: { textAlign: 'center', paddingVertical: 24, paddingHorizontal: 8, fontFamily: F.body, fontSize: 15 },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, minHeight: 46 },
  sum: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 12, gap: 2 },
  strip: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 },
  dayCell: { alignItems: 'center' },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 },
  day: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  hitem: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  pill: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, fontFamily: F.bodyBold, fontSize: 12, overflow: 'hidden' },
});
