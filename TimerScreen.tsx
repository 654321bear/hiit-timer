import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { initAudio, isMuted, say, setMuted, stopSpeech } from '../audio';
import { saveMuted } from '../storage';
import SpeakerIcon from '../components/SpeakerIcon';
import { buildPlan, Cue, cuesFor, fmt, fmtLong, HistoryEntry, Routine, Seg } from '../plan';
import { F, PHASE } from '../theme';
import Ring from '../components/Ring';
import DotRow, { DotState } from '../components/Dots';

type Engine = {
  segs: Seg[];
  idx: number;
  remain: number; // ms left in current segment
  running: boolean;
  last: number;
  cues: Cue[];
  total: number; // planned ms
  doneMs: number; // elapsed ms, pauses excluded
  startedAt: number;
  recorded: boolean;
  finished: boolean;
  stopArmed: boolean;
};

const KEEP_AWAKE_TAG = 'hiit-timer';

export default function TimerScreen({ routine, onExit, onRecord }: {
  routine: Routine;
  onExit: () => void;
  onRecord: (h: HistoryEntry) => void;
}) {
  const E = useRef<Engine | null>(null);
  const iv = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, force] = useReducer((x: number) => x + 1, 0);
  const insets = useSafeAreaInsets();
  const [muted, setMutedState] = useState(isMuted());
  const toggleMute = () => {
    const m = !muted;
    setMutedState(m);
    setMuted(m);
    saveMuted(m);
  };
  const { width, height } = useWindowDimensions();
  const ring = Math.min(width * 0.74, height * 0.4, 360);

  const record = useCallback(
    (completed: boolean) => {
      const e = E.current;
      if (!e || e.recorded) return;
      if (!completed && e.doneMs < 30000) return;
      const s = e.segs[e.idx];
      const pos = s.type === 'work' ? s : s.next || s;
      e.recorded = true;
      onRecord({
        t: e.startedAt,
        name: routine.name,
        dur: Math.round(e.doneMs / 1000),
        done: completed,
        round: completed ? routine.rounds : pos.round || 1,
        rounds: routine.rounds,
      });
    },
    [onRecord, routine],
  );

  const runCue = (c: Cue) => {
    if (c.text) say(c.text);
  };

  const fireCues = (silent: boolean) => {
    const e = E.current!;
    for (const c of e.cues) {
      if (!c.done && e.remain <= c.at + 1) {
        c.done = true;
        if (!silent) runCue(c);
      }
    }
  };

  const enterSeg = (i: number, silent: boolean) => {
    const e = E.current!;
    e.idx = i;
    e.remain = e.segs[i].dur * 1000;
    e.cues = cuesFor(e.segs, i);
    if (silent) e.cues.forEach((c) => (c.done = true));
  };

  const stopTicking = () => {
    if (iv.current) clearInterval(iv.current);
    iv.current = null;
  };

  const finish = () => {
    const e = E.current!;
    stopTicking();
    e.running = false;
    e.finished = true;
    deactivateKeepAwake(KEEP_AWAKE_TAG);
    say('Workout complete. Nice work');
    record(true);
  };

  const tick = () => {
    const e = E.current;
    if (!e || !e.running) return;
    const now = Date.now();
    let dt = now - e.last;
    e.last = now;
    // Catch up across segments if the app was in the background.
    while (dt > 0) {
      if (dt < e.remain) {
        e.remain -= dt;
        e.doneMs += dt;
        dt = 0;
      } else {
        dt -= e.remain;
        e.doneMs += e.remain;
        e.remain = 0;
        fireCues(dt > 0);
        if (e.idx + 1 >= e.segs.length) {
          finish();
          force();
          return;
        }
        enterSeg(e.idx + 1, dt > e.segs[e.idx + 1].dur * 1000);
      }
    }
    fireCues(false);
    force();
  };

  const startTicking = () => {
    stopTicking();
    iv.current = setInterval(tick, 100);
  };

  const start = () => {
    const segs = buildPlan(routine);
    E.current = {
      segs,
      idx: 0,
      remain: segs[0].dur * 1000,
      running: true,
      last: Date.now(),
      cues: cuesFor(segs, 0),
      total: segs.reduce((a, s) => a + s.dur, 0) * 1000,
      doneMs: 0,
      startedAt: Date.now(),
      recorded: false,
      finished: false,
      stopArmed: false,
    };
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    startTicking();
    tick();
  };

  useEffect(() => {
    initAudio().then(start);
    return () => {
      stopTicking();
      stopSpeech();
      deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const e = E.current;

  const onPause = () => {
    if (!e) return;
    if (e.finished) return onExit();
    if (e.running) {
      e.running = false;
      stopTicking();
      stopSpeech();
      deactivateKeepAwake(KEEP_AWAKE_TAG);
    } else {
      e.running = true;
      e.last = Date.now();
      activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
      startTicking();
    }
    force();
  };

  const onSkip = () => {
    if (!e || e.finished) return;
    stopSpeech();
    e.doneMs += e.remain;
    if (e.idx + 1 >= e.segs.length) {
      finish();
      force();
      return;
    }
    enterSeg(e.idx + 1, false);
    e.last = Date.now();
    if (e.running) tick();
    else force();
  };

  const onEnd = () => {
    if (!e) return;
    if (e.finished) {
      start();
      return;
    }
    if (!e.stopArmed) {
      e.stopArmed = true;
      force();
      setTimeout(() => {
        if (E.current && !E.current.finished) {
          E.current.stopArmed = false;
          force();
        }
      }, 3000);
      return;
    }
    stopTicking();
    stopSpeech();
    record(false);
    onExit();
  };

  if (!e) {
    return <View style={[s.root, { backgroundColor: PHASE.ready }]} />;
  }

  const seg = e.segs[e.idx];
  const R = routine.rounds;
  const N = routine.exercises.length;
  const phaseKey = e.finished ? 'done' : seg.type;
  const bg = PHASE[phaseKey];

  // Dots
  let rc = 1, ec = 1;
  let state: 'work' | 'next' | 'done' = 'next';
  if (e.finished) state = 'done';
  else if (seg.type === 'work') { rc = seg.round!; ec = seg.ex!; state = 'work'; }
  else if (seg.next) { rc = seg.next.round!; ec = seg.next.ex!; }
  const roundStarted = state === 'work' || ec > 1;
  const roundDots: DotState[] = Array.from({ length: R }, (_, i) => {
    const r = i + 1;
    if (state === 'done' || r < rc) return 'full';
    if (r === rc) return roundStarted ? 'cur-full' : 'cur-empty';
    return 'empty';
  });
  const exDots: DotState[] = Array.from({ length: N }, (_, i) => {
    const x = i + 1;
    if (state === 'done' || x < ec) return 'full';
    if (x === ec) return state === 'work' ? 'cur-full' : 'cur-empty';
    return 'empty';
  });

  // Labels
  let phase = '';
  let name = '';
  let next = '';
  if (e.finished) {
    phase = 'Done';
    name = 'Workout complete';
    next = `${R} rounds · ${N} exercises`;
  } else if (seg.type === 'work') {
    phase = 'Work';
    name = seg.name || '';
    next = seg.next ? `Up next: ${seg.next.name}` : 'Last one. Finish strong.';
  } else {
    phase = (seg.type === 'ready' ? 'Get ready' : seg.type === 'cyclerest' ? `Round ${seg.round} done · Rest` : 'Rest') + ' · up next';
    name = seg.next?.name || '';
  }

  const clock = e.finished ? fmtLong(e.doneMs / 1000) : fmt(Math.ceil(e.remain / 1000 - 1e-6));
  const progress = e.finished ? 1 : 1 - e.remain / (seg.dur * 1000);
  const overall = e.finished ? 1 : e.doneMs / e.total;

  return (
    <View style={[s.root, { backgroundColor: bg, paddingTop: insets.top + 10, paddingBottom: insets.bottom + 16, paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }]}>
      <StatusBar style="light" />
      <View style={s.overall}><View style={[s.overallFill, { width: `${overall * 100}%` }]} /></View>
      <View style={s.topRow}>
        <Text style={s.routine} numberOfLines={1}>{routine.name}</Text>
        <Pressable onPress={toggleMute} hitSlop={10} accessibilityRole="button"
          accessibilityLabel={muted ? 'Turn voice cues on' : 'Mute voice cues'}
          style={[s.speaker, muted && s.speakerMuted]}>
          <SpeakerIcon muted={muted} color={PHASE.on} size={24} />
        </Pressable>
      </View>
      <View style={s.dotsBox}>
        <DotRow label="Round" states={roundDots} value={`${state === 'done' ? R : rc}/${R}`} />
        <DotRow label="Exercise" states={exDots} value={`${state === 'done' ? N : ec}/${N}`} />
      </View>

      <View style={s.mid}>
        <Text style={s.phase}>{phase}</Text>
        <Text style={s.name} numberOfLines={2} adjustsFontSizeToFit>{name}</Text>
        <View style={{ marginTop: 10, opacity: e.running || e.finished ? 1 : 0.6 }}>
          <Ring size={ring} progress={progress} color={PHASE.on} track="rgba(255,255,255,0.22)">
            <Text style={[s.clock, { fontSize: ring * (clock.length > 2 ? 0.3 : 0.44) }]}>{clock}</Text>
          </Ring>
        </View>
        <Text style={s.next}>{next}</Text>
      </View>

      <View style={s.controls}>
        <Pressable onPress={onEnd} style={[s.ctl, e.stopArmed && s.ctlArmed]}>
          <Text style={s.ctlText}>{e.finished ? 'Again' : e.stopArmed ? 'Tap to end' : 'End'}</Text>
        </Pressable>
        <Pressable onPress={onPause} style={[s.ctl, s.ctlMain]}>
          <Text style={[s.ctlText, s.ctlMainText]}>{e.finished ? 'Done' : e.running ? 'Pause' : 'Resume'}</Text>
        </Pressable>
        <Pressable onPress={onSkip} style={[s.ctl, e.finished && { opacity: 0 }]} disabled={e.finished}>
          <Text style={s.ctlText}>Skip</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  overall: { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden', marginBottom: 12 },
  overallFill: { height: '100%', backgroundColor: 'rgba(255,255,255,0.85)' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  routine: { flex: 1, color: PHASE.on, opacity: 0.85, fontFamily: F.bodySemi, fontSize: 16 },
  speaker: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' },
  speakerMuted: { backgroundColor: 'rgba(0,0,0,0.25)', borderColor: 'rgba(255,255,255,0.35)' },
  dotsBox: { gap: 10, marginTop: 12 },
  mid: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  phase: { color: PHASE.on, opacity: 0.9, fontFamily: F.display, fontSize: 18, letterSpacing: 3, textTransform: 'uppercase', textAlign: 'center' },
  name: { color: PHASE.on, fontFamily: F.displayHeavy, fontSize: 46, lineHeight: 48, textTransform: 'uppercase', textAlign: 'center' },
  clock: { color: PHASE.on, fontFamily: F.displayHeavy, fontVariant: ['tabular-nums'], includeFontPadding: false },
  next: { color: PHASE.on, opacity: 0.9, fontFamily: F.bodySemi, fontSize: 16, marginTop: 14, minHeight: 22, textAlign: 'center' },
  controls: { flexDirection: 'row', gap: 10 },
  ctl: { flex: 1, minHeight: 60, borderRadius: 14, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' },
  ctlArmed: { backgroundColor: 'rgba(0,0,0,0.25)' },
  ctlMain: { flex: 1.4, backgroundColor: PHASE.on, borderColor: PHASE.on },
  ctlText: { color: PHASE.on, fontFamily: F.bodyBold, fontSize: 17 },
  ctlMainText: { color: '#14191d', fontSize: 20 },
});
