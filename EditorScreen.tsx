import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fmtLong, Routine, totalOf, uid } from '../plan';
import { F, usePalette } from '../theme';
import StepperRow from '../components/Stepper';
import LibrarySheet from '../components/LibrarySheet';

const LIMITS = { count: [1, 20], work: [5, 600], rounds: [1, 30], rest: [0, 600], cycle: [0, 900] } as const;
const WORK_CHIPS = [20, 30, 40, 45, 60, 90];
const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, v));

export default function EditorScreen({ initial, onSave, onDelete, onBack }: {
  initial: Routine | null;
  onSave: (r: Routine) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}) {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const [d, setD] = useState<Routine>(
    initial ? JSON.parse(JSON.stringify(initial)) : { id: '', name: '', exercises: ['', '', ''], work: 30, rest: 15, rounds: 3, cycle: 60 },
  );
  const [err, setErr] = useState('');
  const [delArmed, setDelArmed] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const inputs = useRef<(React.ComponentRef<typeof TextInput> | null)[]>([]);

  const set = (patch: Partial<Routine>) => setD((p) => ({ ...p, ...patch }));
  const setCount = (n: number) => {
    const ex = [...d.exercises];
    while (ex.length < n) ex.push('');
    ex.length = n;
    set({ exercises: ex });
    if (n > d.exercises.length) setTimeout(() => inputs.current[n - 1]?.focus(), 50);
  };

  const MAX = LIMITS.count[1];
  const addFromLibrary = (name: string) =>
    setD((p) => {
      if (p.exercises.some((x) => x.trim().toLowerCase() === name.toLowerCase())) return p;
      const ex = [...p.exercises];
      const empty = ex.findIndex((x) => !x.trim());
      if (empty >= 0) ex[empty] = name;
      else if (ex.length < MAX) ex.push(name);
      else return p;
      return { ...p, exercises: ex };
    });
  const removeFromLibrary = (name: string) =>
    setD((p) => {
      const ex = p.exercises.filter((x) => x.trim().toLowerCase() !== name.toLowerCase());
      return { ...p, exercises: ex.length ? ex : [''] };
    });
  const libFull = d.exercises.length >= MAX && d.exercises.every((x) => x.trim());

  const save = () => {
    const name = d.name.trim();
    const ex = d.exercises.map((x) => x.trim());
    if (!name) return setErr('Give the routine a name.');
    if (ex.some((x) => !x)) return setErr('Fill in a name for every exercise, or remove the empty ones with −.');
    const rec: Routine = { ...d, name, exercises: ex };
    delete rec.example;
    if (!rec.id || rec.id === 'example') rec.id = uid();
    onSave(rec);
  };

  const del = () => {
    if (!delArmed) {
      setDelArmed(true);
      setTimeout(() => setDelArmed(false), 3000);
      return;
    }
    onDelete(d.id);
  };

  const total = totalOf({ ...d, exercises: d.exercises.map((x) => x || 'x') });

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 16, gap: 20, maxWidth: 560, width: '100%', alignSelf: 'center' }}
      >
        <Pressable onPress={onBack} hitSlop={8} style={{ alignSelf: 'flex-start', paddingVertical: 6 }}>
          <Text style={{ color: c.accent, fontFamily: F.bodyBold, fontSize: 16 }}>‹ Routines</Text>
        </Pressable>
        <Text style={[s.h1, { color: c.ink }]}>{initial ? 'Edit routine' : 'New routine'}</Text>

        <View style={s.group}>
          <Text style={[s.label, { color: c.muted }]}>Routine name</Text>
          <TextInput
            value={d.name}
            onChangeText={(t) => set({ name: t })}
            placeholder="e.g. Kettlebell Tuesday"
            placeholderTextColor={c.muted}
            maxLength={40}
            style={[s.input, { backgroundColor: c.surface, borderColor: c.line, color: c.ink }]}
            returnKeyType="next"
            onSubmitEditing={() => inputs.current[0]?.focus()}
          />
        </View>

        <View style={s.group}>
          <Text style={[s.label, { color: c.muted }]}>Exercises</Text>
          <StepperRow c={c} title="Number of exercises" hint="Each one runs once per round" value={String(d.exercises.length)}
            onMinus={() => setCount(clamp(d.exercises.length - 1, LIMITS.count))}
            onPlus={() => setCount(clamp(d.exercises.length + 1, LIMITS.count))} />
          {d.exercises.map((x, i) => (
            <View key={i} style={s.exRow}>
              <Text style={[s.exNum, { color: c.muted }]}>{i + 1}</Text>
              <TextInput
                ref={(el) => { inputs.current[i] = el; }}
                value={x}
                onChangeText={(t) => {
                  const ex = [...d.exercises];
                  ex[i] = t;
                  set({ exercises: ex });
                }}
                placeholder={`Exercise ${i + 1} name`}
                placeholderTextColor={c.muted}
                maxLength={40}
                style={[s.input, { flex: 1, backgroundColor: c.surface, borderColor: c.line, color: c.ink }]}
                returnKeyType={i < d.exercises.length - 1 ? 'next' : 'done'}
                onSubmitEditing={() => inputs.current[i + 1]?.focus()}
                blurOnSubmit={i === d.exercises.length - 1}
              />
            </View>
          ))}
          <Pressable onPress={() => setLibOpen(true)} style={[s.libBtn, { borderColor: c.accent }]}>
            <Text style={{ color: c.accent, fontFamily: F.bodyBold, fontSize: 16 }}>+ Add from exercise library</Text>
          </Pressable>
        </View>

        <View style={s.group}>
          <Text style={[s.label, { color: c.muted }]}>Work interval</Text>
          <StepperRow c={c} title="Length of each exercise" hint="“Halfway there” plays at the midpoint" value={fmtLong(d.work)}
            onMinus={() => set({ work: clamp(d.work - 5, LIMITS.work) })}
            onPlus={() => set({ work: clamp(d.work + 5, LIMITS.work) })} />
          <View style={s.chips}>
            {WORK_CHIPS.map((v) => {
              const on = d.work === v;
              return (
                <Pressable key={v} onPress={() => set({ work: v })}
                  style={[s.chip, { borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accent : 'transparent' }]}>
                  <Text style={{ color: on ? c.accentInk : c.ink, fontFamily: F.bodySemi, fontSize: 15 }}>{v === 60 ? '1 min' : `${v} sec`}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={s.group}>
          <Text style={[s.label, { color: c.muted }]}>Rounds and rest</Text>
          <StepperRow c={c} title="Rounds" hint="Times through the full exercise list" value={String(d.rounds)}
            onMinus={() => set({ rounds: clamp(d.rounds - 1, LIMITS.rounds) })}
            onPlus={() => set({ rounds: clamp(d.rounds + 1, LIMITS.rounds) })} />
          <StepperRow c={c} title="Rest between exercises" hint="Set to 0:00 for none" value={fmtLong(d.rest)}
            onMinus={() => set({ rest: clamp(d.rest - 5, LIMITS.rest) })}
            onPlus={() => set({ rest: clamp(d.rest + 5, LIMITS.rest) })} />
          <StepperRow c={c} title="Rest after each round" hint="Replaces the normal rest at round's end" value={fmtLong(d.cycle)}
            onMinus={() => set({ cycle: clamp(d.cycle - 15, LIMITS.cycle) })}
            onPlus={() => set({ cycle: clamp(d.cycle + 15, LIMITS.cycle) })} />
        </View>

        <View style={s.totalRow}>
          <View>
            <Text style={{ color: c.ink, fontFamily: F.bodySemi, fontSize: 16 }}>Total time</Text>
            <Text style={{ color: c.muted, fontFamily: F.body, fontSize: 13 }}>Includes the 10-second lead-in</Text>
          </View>
          <Text style={{ color: c.accent, fontFamily: F.display, fontSize: 24, fontVariant: ['tabular-nums'] }}>{fmtLong(total)}</Text>
        </View>

        {err ? <Text style={{ color: c.danger, fontFamily: F.bodySemi, fontSize: 15 }}>{err}</Text> : null}

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={save} style={[s.btn, { flex: 1, backgroundColor: c.accent }]}>
            <Text style={{ color: c.accentInk, fontFamily: F.bodyBold, fontSize: 16 }}>Save routine</Text>
          </Pressable>
          {initial ? (
            <Pressable onPress={del} style={[s.btn, { borderWidth: 1.5, borderColor: c.danger }]}>
              <Text style={{ color: c.danger, fontFamily: F.bodyBold, fontSize: 16 }}>{delArmed ? 'Tap again to delete' : 'Delete'}</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
      <LibrarySheet c={c} visible={libOpen} onClose={() => setLibOpen(false)} selected={d.exercises}
        onAdd={addFromLibrary} onRemove={removeFromLibrary} full={libFull} />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  h1: { fontFamily: F.displayHeavy, fontSize: 38, lineHeight: 40, textTransform: 'uppercase' },
  group: { gap: 10 },
  label: { fontFamily: F.bodySemi, fontSize: 12, letterSpacing: 1.1, textTransform: 'uppercase' },
  input: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, minHeight: 48, fontFamily: F.body, fontSize: 16 },
  libBtn: { minHeight: 48, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exNum: { width: 22, textAlign: 'right', fontFamily: F.display, fontSize: 19 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12 },
  btn: { minHeight: 48, borderRadius: 10, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
});
