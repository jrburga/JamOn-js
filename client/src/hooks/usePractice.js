/**
 * usePractice.js — Game engine hook for the Practice scene.
 *
 * Owns: clock loop (rAF), Tone.js audio, PatternList, InstrumentManager,
 *       network handlers, reducer, pattern actions.
 *
 * Exposes: { state, sessionReady, audioActive, players, seconds,
 *            noteOn, noteOff, lockIn, createPattern, removePattern,
 *            queuePattern, activateAudio }
 */

import { useEffect, useRef, useState, useReducer } from 'react';
import * as Tone from 'tone';

import { InstrumentManager, Instrument, INSTRUMENT_SETS, TEMPOS } from '../game/Instrument.js';
import { PatternList } from '../game/Pattern.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const BARS = 4;

// ── State reducer ─────────────────────────────────────────────────────────────

export const initialState = {
  now: 0,
  patterns: [],
  activeNotes: {},
  editingPatternId: null,
  vplayers: [],
};

export function reducer(state, action) {
  switch (action.type) {
    case 'SET_NOW':
      return { ...state, now: action.now };

    case 'ADD_PATTERN':
      return {
        ...state,
        patterns: [action.pattern, ...state.patterns],
        editingPatternId: action.own ? action.pattern.id : state.editingPatternId,
      };

    case 'UPDATE_PATTERN':
      return {
        ...state,
        patterns: state.patterns.map((p) =>
          p.id === action.id ? { ...p, ...action.updates } : p,
        ),
      };

    case 'REMOVE_PATTERN':
      return {
        ...state,
        patterns: state.patterns.filter((p) => p.id !== action.id),
        editingPatternId: state.editingPatternId === action.id ? null : state.editingPatternId,
      };

    case 'NOTE_DOWN':
      return { ...state, activeNotes: { ...state.activeNotes, [action.lane]: action.time } };

    case 'NOTE_UP': {
      const next = { ...state.activeNotes };
      delete next[action.lane];
      return { ...state, activeNotes: next };
    }

    case 'ADD_VPLAYER':
      return {
        ...state,
        vplayers: [...state.vplayers.filter((v) => v.id !== action.player.id), action.player],
      };

    case 'UPDATE_VPLAYER':
      return {
        ...state,
        vplayers: state.vplayers.map((v) =>
          v.id === action.id ? { ...v, ...action.updates } : v,
        ),
      };

    default:
      return state;
  }
}

// ── lockIn — standalone exported function ─────────────────────────────────────

/**
 * Locks in the currently-editing pattern, dispatches UPDATE_PATTERN,
 * and publishes the snapshot via client.
 *
 * @param {object} params
 * @param {React.MutableRefObject} params.plRef     - PatternList ref
 * @param {React.MutableRefObject} params.stateRef  - current state ref
 * @param {Function}               params.dispatch  - reducer dispatch
 * @param {object|null}            params.client    - networking client
 */
export function lockIn({ plRef, stateRef, dispatch, client }) {
  const editingId = stateRef.current.editingPatternId;
  if (!editingId) return;
  const pat = plRef.current?.getPattern(editingId);
  if (!pat) return;
  pat.lockIn();
  dispatch({
    type: 'UPDATE_PATTERN',
    id: editingId,
    updates: { lockedIn: true, editing: false, notes: [...pat.notes] },
  });
  client?.sendAction('on_pattern_publish', {
    pattern_id: editingId,
    inst: pat.inst,
    isDrum: pat.isDrum,
    bars: pat.bars,
    tempo: pat.tempo,
    instSet: pat.instSet,
    notes: pat.notes.map((n) => ({ lane: n.lane, time: n.time, length: n.length })),
    creator: client.info,
  });
}

// ── usePractice hook ──────────────────────────────────────────────────────────

export default function usePractice({ client, bandMembers = [], instSet = 'ROCK' } = {}) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [sessionReady, setSessionReady] = useState(false);
  const [audioActive, setAudioActive] = useState(false);
  const [players, setPlayers] = useState(bandMembers);

  const imRef      = useRef(null);
  const plRef      = useRef(null);
  const instRef    = useRef(null);
  const secondsRef = useRef(0);
  const startTimeRef = useRef(null);
  const rafRef     = useRef(null);
  const stateRef   = useRef(state);
  stateRef.current = state;

  const tempo = TEMPOS[instSet] || 120;
  const spb = 60 / tempo;
  const beats = BARS * 4;
  const seconds = spb * beats;
  secondsRef.current = seconds;

  // ── Session init ────────────────────────────────────────────────────────────

  useEffect(() => {
    async function initSession() {
      imRef.current = new InstrumentManager(tempo);
      const instNames = Object.keys(INSTRUMENT_SETS[instSet]);
      instRef.current = new Instrument(instNames[0], instSet);
      instRef.current.manager = imRef.current;

      plRef.current = new PatternList(BARS, tempo, instSet);

      if (client) {
        try {
          const { session_start } = await client.syncClock();
          startTimeRef.current = session_start;
        } catch {
          startTimeRef.current = Date.now();
        }
      } else {
        startTimeRef.current = Date.now();
      }

      setSessionReady(true);
    }
    initSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Game loop ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!sessionReady) return;

    function loop() {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const now = elapsed % secondsRef.current;
      dispatch({ type: 'SET_NOW', now });

      const prevNow = stateRef.current.now;
      for (const pat of plRef.current.getAllPatterns()) {
        if (!pat.lockedIn || !pat.queued) continue;
        const inst = pat.inst;
        const seq = pat.buildSequence();
        for (const evt of seq) {
          const t = evt.time;
          const inWindow = prevNow <= now
            ? t >= prevNow && t < now
            : t >= prevNow || t < now;
          if (inWindow) {
            if (evt.on) imRef.current.noteOn(inst, instRef.current.notes[evt.lane]);
            else imRef.current.noteOff(inst, instRef.current.notes[evt.lane]);
          }
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [sessionReady]);

  // ── Announce presence ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!client) return;
    client.sendAction('on_player_join', client.info);
  }, [client]);

  // ── Network actions ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!client) return;
    const unsubscribe = client.onAction(({ event_type, action }) => {
      switch (event_type) {
        case 'on_player_join': {
          setPlayers((prev) => {
            if (prev.some((p) => p.id === action.id)) return prev;
            return [...prev, action];
          });
          break;
        }
        case 'on_pattern_publish': {
          if (action.sender_id === client.id) break;
          const { pattern_id, inst, isDrum, notes, creator } = action;
          const pat = plRef.current.addPattern(pattern_id, inst, isDrum);
          notes.forEach((n) => { pat.notes.push({ ...n }); });
          pat.lockedIn = true;
          pat.editing = false;
          dispatch({ type: 'ADD_PATTERN', pattern: { id: pattern_id, inst, lockedIn: true, queued: false, notes, editing: false, creator } });
          break;
        }
        default: break;
      }
    });
    return unsubscribe;
  }, [client]);

  // ── Input interface ─────────────────────────────────────────────────────────

  function noteOn(lane) {
    if (!sessionReady) return;
    const now = stateRef.current.now;
    instRef.current?.noteOn(lane);
    dispatch({ type: 'NOTE_DOWN', lane, time: now });
    const editingId = stateRef.current.editingPatternId;
    if (editingId) {
      plRef.current.getPattern(editingId)?.onPress(lane, now);
    }
  }

  function noteOff(lane) {
    if (!sessionReady) return;
    const now = stateRef.current.now;
    instRef.current?.noteOff(lane);
    dispatch({ type: 'NOTE_UP', lane });
    const editingId = stateRef.current.editingPatternId;
    if (editingId) {
      plRef.current.getPattern(editingId)?.onRelease(lane, now);
    }
  }

  // ── Pattern actions ─────────────────────────────────────────────────────────

  function activateAudio() {
    return Tone.start().then(() => setAudioActive(true));
  }

  function createPattern(instName) {
    if (!sessionReady) return;
    if (Tone.context.state !== 'running') {
      Tone.start().then(() => setAudioActive(true));
    }
    const id = `${client?.id || 'local'}_${Date.now()}`;
    const isDrum = instName === 'drum';
    plRef.current.addPattern(id, instName, isDrum);
    instRef.current.setInst(instName);
    dispatch({ type: 'ADD_PATTERN', pattern: { id, inst: instName, lockedIn: false, queued: false, notes: [], editing: true }, own: true });
  }

  function removePattern(id) {
    const pat = plRef.current.getPattern(id);
    if (pat) imRef.current?.releaseAll(pat.inst);
    plRef.current.removePattern(id);
    dispatch({ type: 'REMOVE_PATTERN', id });
  }

  function queuePattern(id) {
    const pat = plRef.current.getPattern(id);
    if (!pat) return;
    const newQueued = !pat.queued;
    if (!newQueued) imRef.current?.releaseAll(pat.inst);
    pat.setQueued(newQueued);
    dispatch({ type: 'UPDATE_PATTERN', id, updates: { queued: newQueued } });
  }

  return {
    state,
    sessionReady,
    audioActive,
    players,
    seconds,
    noteOn,
    noteOff,
    lockIn: () => lockIn({ plRef, stateRef, dispatch, client }),
    createPattern,
    removePattern,
    queuePattern,
    activateAudio,
    // expose refs for PracticeDesktop keyboard handler
    instRef,
    plRef,
    stateRef,
  };
}
