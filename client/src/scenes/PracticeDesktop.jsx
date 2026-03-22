/**
 * PracticeDesktop.jsx — Desktop layout for the Practice scene.
 *
 * Consumes usePractice hook. Owns keyboard handlers and desktop JSX layout.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone';

import Track from '../components/Track.jsx';
import { INSTRUMENT_SETS } from '../game/Instrument.js';
import usePractice from '../hooks/usePractice.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_KEYS = ['a','s','d','f','g','h','j','k','q','w','e','r','t','y','u','i'];
const LOCK_IN_KEY  = ' ';
const NUM_LANES    = 8;

// ── PracticeDesktop ───────────────────────────────────────────────────────────

export default function PracticeDesktop({ client, bandMembers = [], instSet = 'ROCK' }) {
  const {
    state, sessionReady, audioActive, players, seconds,
    noteOn, noteOff, lockIn, createPattern, removePattern, queuePattern,
    plRef,
  } = usePractice({ client, bandMembers, instSet });

  const keysDown = useRef(new Set());

  // ── Keyboard handlers ───────────────────────────────────────────────────────

  const handleKeyDown = useCallback((e) => {
    if (!sessionReady || e.repeat) return;

    if (Tone.context.state !== 'running') {
      Tone.start().then(() => {});
      return;
    }

    if (e.key === LOCK_IN_KEY) {
      e.preventDefault();
      lockIn();
      return;
    }

    const laneIdx = DEFAULT_KEYS.indexOf(e.key.toLowerCase());
    if (laneIdx < 0 || laneIdx >= NUM_LANES) return;
    if (keysDown.current.has(laneIdx)) return;
    keysDown.current.add(laneIdx);

    noteOn(laneIdx);
  }, [sessionReady, lockIn, noteOn]);

  const handleKeyUp = useCallback((e) => {
    if (!sessionReady) return;
    const laneIdx = DEFAULT_KEYS.indexOf(e.key.toLowerCase());
    if (laneIdx < 0 || laneIdx >= NUM_LANES) return;
    keysDown.current.delete(laneIdx);
    noteOff(laneIdx);
  }, [sessionReady, noteOff]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // ── Derived render values ───────────────────────────────────────────────────

  // Get live notes from the PatternList object so in-progress (held) gems are visible.
  const editingPattern = state.editingPatternId
    ? (plRef.current?.getPattern(state.editingPatternId) ?? null)
    : null;

  const currentPatternNotes = editingPattern
    ? editingPattern.notes.filter((n) => n.isComplete || n.length !== null)
    : [];

  const instNames = Object.keys(INSTRUMENT_SETS[instSet]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="scene practice">
      {sessionReady && !audioActive && (
        <div className="audio-hint">
          Press any key or create a pattern to activate audio.
        </div>
      )}
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
                {client?.username || 'You'}
              </span>
            </div>

            {/* Virtual player tracks (remote players) */}
            {players
              .filter((m) => m.id !== client?.id)
              .map((member) => {
                const remoteNotes = state.patterns
                  .filter((p) => p.creator?.id === member.id && p.lockedIn)
                  .flatMap((p) => p.notes);
                return (
                  <div key={member.id} className="track-wrapper">
                    <Track
                      numLanes={NUM_LANES}
                      seconds={seconds}
                      active={false}
                      now={state.now}
                      notes={remoteNotes}
                      activeNotes={{}}
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
