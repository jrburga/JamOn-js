/**
 * Practice.jsx — Main jam/practice session scene.
 *
 * Ports practice.py + session.py.
 * Manages:
 *  - The clock / loop timer
 *  - InstrumentManager (Tone.js)
 *  - PatternList (create / lock-in / playback)
 *  - Local player Track (keyboard input → note recording)
 *  - Virtual player Tracks (remote players, driven by action events)
 */

import React, {
  useEffect, useRef, useCallback, useState, useReducer,
} from 'react';
import * as Tone from 'tone';

import Track from '../components/Track.jsx';
import { InstrumentManager, Instrument, INSTRUMENT_SETS, TEMPOS } from '../game/Instrument.js';
import { Pattern, PatternList } from '../game/Pattern.js';

// ── Constants ────────────────────────────────────────────────────────────────

const BARS = 4;
const DIVS = 4;

// Keys mapped to lanes (mirrors default_keys in session.py)
const DEFAULT_KEYS = ['a','s','d','f','g','h','j','k','q','w','e','r','t','y','u','i'];
const LOCK_IN_KEY  = ' ';
const NUM_LANES    = 8;

// ── State reducer ────────────────────────────────────────────────────────────

const initialState = {
  now: 0,               // current time within phrase (0..seconds)
  patterns: [],         // [{id, inst, lockedIn, queued, notes, active}]
  activeNotes: {},      // lane → startTime  (currently pressed)
  editingPatternId: null,
  vplayers: [],         // [{id, username, notes, activeNotes}]
};

function reducer(state, action) {
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

// ── Practice component ───────────────────────────────────────────────────────

export default function Practice({ client, bandMembers = [], instSet = 'ROCK' }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [audioStarted, setAudioStarted] = useState(false);
  const [players, setPlayers] = useState(bandMembers);

  // Refs — mutable game state that does NOT need to trigger renders
  const imRef     = useRef(null);   // InstrumentManager
  const plRef     = useRef(null);   // PatternList
  const instRef   = useRef(null);   // local player's Instrument
  const secondsRef = useRef(0);
  const startTimeRef = useRef(null); // Date.now() when the clock started
  const rafRef    = useRef(null);
  const keysDown  = useRef(new Set());
  const stateRef  = useRef(state);
  stateRef.current = state;

  const tempo = TEMPOS[instSet] || 120;
  const spb = 60 / tempo;
  const beats = BARS * 4;
  const seconds = spb * beats;
  secondsRef.current = seconds;

  // ── Audio init ─────────────────────────────────────────────────────────────

  async function startAudio() {
    await Tone.start();
    imRef.current = new InstrumentManager(tempo);
    const instNames = Object.keys(INSTRUMENT_SETS[instSet]);
    instRef.current = new Instrument(instNames[0], instSet);
    instRef.current.manager = imRef.current;

    plRef.current = new PatternList(BARS, tempo, instSet);
    startTimeRef.current = Date.now();
    setAudioStarted(true);
  }

  // ── Game loop ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!audioStarted) return;

    function loop() {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const now = elapsed % secondsRef.current;
      dispatch({ type: 'SET_NOW', now });

      // Play back locked-in patterns
      const prevNow = stateRef.current.now;
      for (const pat of plRef.current.getAllPatterns()) {
        if (!pat.lockedIn || !pat.queued) continue;
        const inst = pat.inst;
        const seq = pat.buildSequence();
        for (const evt of seq) {
          const t = evt.time;
          // Trigger events that fall in the window [prevNow, now)
          // (handles wrap-around too)
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
  }, [audioStarted]);

  // ── Keyboard input ─────────────────────────────────────────────────────────

  const handleKeyDown = useCallback((e) => {
    if (!audioStarted || e.repeat) return;

    if (e.key === LOCK_IN_KEY) {
      e.preventDefault();
      const editingId = stateRef.current.editingPatternId;
      if (!editingId) return;
      const pat = plRef.current.getPattern(editingId);
      if (!pat) return;
      pat.lockIn();
      dispatch({ type: 'UPDATE_PATTERN', id: editingId, updates: { lockedIn: true, editing: false, notes: [...pat.notes] } });
      client?.sendAction('on_pattern_done_editing', {
        pattern_id: editingId,
        notes: pat.notes.map((n) => ({ lane: n.lane, time: n.time, length: n.length })),
      });
      return;
    }

    const laneIdx = DEFAULT_KEYS.indexOf(e.key.toLowerCase());
    if (laneIdx < 0 || laneIdx >= NUM_LANES) return;
    if (keysDown.current.has(laneIdx)) return;
    keysDown.current.add(laneIdx);

    const now = stateRef.current.now;
    instRef.current?.noteOn(laneIdx);

    dispatch({ type: 'NOTE_DOWN', lane: laneIdx, time: now });

    // Record note in active pattern
    const editingId = stateRef.current.editingPatternId;
    if (editingId) {
      plRef.current.getPattern(editingId)?.onPress(laneIdx, now);
    }
  }, [audioStarted, client]);

  const handleKeyUp = useCallback((e) => {
    if (!audioStarted) return;
    const laneIdx = DEFAULT_KEYS.indexOf(e.key.toLowerCase());
    if (laneIdx < 0 || laneIdx >= NUM_LANES) return;
    keysDown.current.delete(laneIdx);

    const now = stateRef.current.now;
    instRef.current?.noteOff(laneIdx);

    dispatch({ type: 'NOTE_UP', lane: laneIdx });

    const editingId = stateRef.current.editingPatternId;
    if (editingId) {
      plRef.current.getPattern(editingId)?.onRelease(laneIdx, now);
    }
  }, [audioStarted]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // ── Announce presence to other players already in Practice ────────────────

  useEffect(() => {
    if (!client) return;
    client.sendAction('on_player_join', client.info);
  }, [client]);

  // ── Network actions ────────────────────────────────────────────────────────

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
        case 'on_pattern_create': {
          const { pattern_id, inst, creator } = action;
          if (creator.id === client.id) break;
          const pat = plRef.current.addPattern(pattern_id, inst, inst === 'drum');
          dispatch({ type: 'ADD_PATTERN', pattern: { id: pattern_id, inst, lockedIn: false, queued: false, notes: [], editing: true, creator } });
          break;
        }
        case 'on_pattern_done_editing': {
          const { pattern_id, notes } = action;
          const pat = plRef.current.getPattern(pattern_id);
          if (pat) {
            notes.forEach((n) => { pat.notes.push({ ...n, isComplete: true }); });
            pat.lockedIn = true;
          }
          dispatch({ type: 'UPDATE_PATTERN', id: pattern_id, updates: { lockedIn: true, notes } });
          break;
        }
        case 'on_pattern_queue': {
          const { pattern_id } = action;
          const pat = plRef.current.getPattern(pattern_id);
          if (pat) pat.setQueued(true);
          dispatch({ type: 'UPDATE_PATTERN', id: pattern_id, updates: { queued: true } });
          break;
        }
        case 'on_pattern_remove': {
          plRef.current.removePattern(action.pattern_id);
          dispatch({ type: 'REMOVE_PATTERN', id: action.pattern_id });
          break;
        }
        default: break;
      }
    });
    return unsubscribe;
  }, [client]);

  // ── Pattern actions ────────────────────────────────────────────────────────

  function createPattern(instName) {
    if (!audioStarted) return;
    const id = `${client?.id || 'local'}_${Date.now()}`;
    const isDrum = instName === 'drum';
    const pat = plRef.current.addPattern(id, instName, isDrum);

    // Switch instrument
    instRef.current.setInst(instName);

    dispatch({ type: 'ADD_PATTERN', pattern: { id, inst: instName, lockedIn: false, queued: false, notes: [], editing: true }, own: true });

    client?.sendAction('on_pattern_create', {
      pattern_id: id,
      inst: instName,
      creator: client.info,
    });
  }

  function removePattern(id) {
    plRef.current.removePattern(id);
    dispatch({ type: 'REMOVE_PATTERN', id });
    client?.sendAction('on_pattern_remove', { pattern_id: id });
  }

  function queuePattern(id) {
    const pat = plRef.current.getPattern(id);
    if (!pat) return;
    pat.setQueued(!pat.queued);
    dispatch({ type: 'UPDATE_PATTERN', id, updates: { queued: !pat.queued } });
    client?.sendAction('on_pattern_queue', { pattern_id: id, queued: !pat.queued });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const editingPattern = state.editingPatternId
    ? (plRef.current?.getPattern(state.editingPatternId) ?? null)
    : null;

  const currentPatternNotes = editingPattern
    ? editingPattern.notes.filter((n) => n.isComplete || n.length !== null)
    : [];

  const instNames = Object.keys(INSTRUMENT_SETS[instSet]);

  if (!audioStarted) {
    return (
      <div className="scene practice audio-gate">
        <h2>Jam On!</h2>
        <p>Click the button to start the audio engine and begin jamming.</p>
        <button className="btn btn-host btn-large" onClick={startAudio}>
          Start Session
        </button>
      </div>
    );
  }

  return (
    <div className="scene practice">
      <div className="practice-layout">
        {/* ── Pattern list ── */}
        <aside className="pattern-panel">
          <h3>Patterns</h3>

          <div className="create-pattern">
            {instNames.map((inst) => (
              <button
                key={inst}
                className="btn btn-sm btn-create"
                onClick={() => createPattern(inst)}
                title={`Create ${inst} pattern`}
              >
                + {inst}
              </button>
            ))}
          </div>

          <ul className="pattern-list">
            {state.patterns.map((p) => (
              <li key={p.id} className={`pattern-item ${p.id === state.editingPatternId ? 'editing' : ''} ${p.lockedIn ? 'locked' : ''}`}>
                <span className="p-inst">{p.inst}</span>
                {p.lockedIn ? (
                  <>
                    <button
                      className={`btn btn-xs ${p.queued ? 'btn-queued' : 'btn-queue'}`}
                      onClick={() => queuePattern(p.id)}
                      title={p.queued ? 'Dequeue' : 'Queue for playback'}
                    >
                      {p.queued ? '▶ Playing' : '▶ Queue'}
                    </button>
                    <button
                      className="btn btn-xs btn-delete"
                      onClick={() => removePattern(p.id)}
                      title="Delete pattern"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <span className="p-status">
                    {p.id === state.editingPatternId ? 'Recording… (SPACE to lock in)' : 'Editing'}
                  </span>
                )}
              </li>
            ))}
            {state.patterns.length === 0 && (
              <li className="empty-hint">Create a pattern to start recording.</li>
            )}
          </ul>

          <div className="key-hint">
            <strong>Keys:</strong> {DEFAULT_KEYS.slice(0, NUM_LANES).join(' ')}<br />
            <strong>Lock in:</strong> SPACE
          </div>
        </aside>

        {/* ── Track area ── */}
        <main className="track-area">
          <div className="tracks">
            {/* Local player track */}
            <div className="track-wrapper">
              <Track
                numLanes={NUM_LANES}
                seconds={seconds}
                active={!!state.editingPatternId}
                now={state.now}
                notes={currentPatternNotes}
                activeNotes={state.activeNotes}
                isMe={true}
              />
              <span className="track-label">
                {client?.username || 'You'} — {instRef.current?.instName || ''}
              </span>
            </div>

            {/* Virtual player tracks (remote players) */}
            {players
              .filter((m) => m.id !== client?.id)
              .map((member) => {
                const vp = state.vplayers.find((v) => v.id === member.id) || {};
                return (
                  <div key={member.id} className="track-wrapper">
                    <Track
                      numLanes={NUM_LANES}
                      seconds={seconds}
                      active={false}
                      now={state.now}
                      notes={vp.notes || []}
                      activeNotes={vp.activeNotes || {}}
                      isMe={false}
                    />
                    <span className="track-label">{member.username}</span>
                  </div>
                );
              })
            }
          </div>

          {/* Loop progress bar */}
          <div className="loop-bar">
            <div
              className="loop-progress"
              style={{ width: `${(state.now / seconds) * 100}%` }}
            />
            <span className="loop-time">
              {state.now.toFixed(2)}s / {seconds.toFixed(2)}s
            </span>
          </div>
        </main>
      </div>
    </div>
  );
}
