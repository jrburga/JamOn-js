/**
 * PracticeMobile.jsx — Mobile layout for the Practice scene.
 *
 * Consumes usePractice hook. Owns touch handlers and mobile JSX layout.
 *
 * Phase 3 (T11–T14):
 *   - activeTouches ref: Map<touchIdentifier, laneIdx>
 *   - handleTouchStart/Move/End: compute lane from clientX, call noteOn/noteOff
 *   - Multi-touch chords: each Touch tracked by identifier; slide detection on move
 *   - Audio gate: activateAudio() on first touchstart (mirrors keyboard gate on desktop)
 */

import React, { useRef, useCallback, useState } from 'react';

import Track from '../components/Track.jsx';
import Dock, { DOCK_HEIGHT } from '../components/Dock.jsx';
import PanelDrawer from '../components/PanelDrawer.jsx';
import InstrumentPickerSheet from '../components/InstrumentPickerSheet.jsx';
import TrackLaneOverlay from '../components/TrackLaneOverlay.jsx';
import usePractice from '../hooks/usePractice.js';
import { INSTRUMENT_SETS } from '../game/Instrument.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const NUM_LANES = 8;

// ── PracticeMobile ────────────────────────────────────────────────────────────

export default function PracticeMobile({ client, bandMembers = [], instSet = 'ROCK' }) {
  const {
    state, sessionReady, audioActive, players, seconds,
    noteOn, noteOff, lockIn, createPattern, removePattern, queuePattern,
    activateAudio, plRef,
  } = usePractice({ client, bandMembers, instSet });

  // ── Panel / picker state ───────────────────────────────────────────────────

  const [panelOpen, setPanelOpen] = useState(false);
  const [instrumentPickerOpen, setInstrumentPickerOpen] = useState(false);

  // ── Touch input (T12, T13) ─────────────────────────────────────────────────

  // Map from touch.identifier → laneIdx currently held
  const activeTouches = useRef(new Map());
  // Ref to the canvas wrapper div, used to compute lane from clientX
  const trackWrapperRef = useRef(null);
  // Whether audio has been activated yet (T14)
  const audioGated = useRef(false);

  /** Compute lane index from a clientX position using the wrapper's bounding rect. */
  const clientXToLane = useCallback((clientX) => {
    const el = trackWrapperRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const relX = clientX - rect.left;
    const laneW = rect.width / NUM_LANES;
    const lane = Math.floor(relX / laneW);
    return Math.max(0, Math.min(NUM_LANES - 1, lane));
  }, []);

  /** T14: Activate Tone.js audio on first touch. */
  const ensureAudio = useCallback(() => {
    if (!audioGated.current) {
      audioGated.current = true;
      activateAudio();
    }
  }, [activateAudio]);

  const handleTouchStart = useCallback((e) => {
    if (!sessionReady) return;
    ensureAudio();

    for (const touch of e.changedTouches) {
      const lane = clientXToLane(touch.clientX);
      if (lane < 0) continue;
      // If this identifier is already tracked (shouldn't happen), release old lane first
      if (activeTouches.current.has(touch.identifier)) {
        noteOff(activeTouches.current.get(touch.identifier));
      }
      activeTouches.current.set(touch.identifier, lane);
      noteOn(lane);
    }
  }, [sessionReady, ensureAudio, clientXToLane, noteOn, noteOff]);

  const handleTouchMove = useCallback((e) => {
    if (!sessionReady) return;

    for (const touch of e.changedTouches) {
      const newLane = clientXToLane(touch.clientX);
      if (newLane < 0) continue;
      const oldLane = activeTouches.current.get(touch.identifier);
      if (oldLane === undefined) continue;
      if (newLane !== oldLane) {
        noteOff(oldLane);
        activeTouches.current.set(touch.identifier, newLane);
        noteOn(newLane);
      }
    }
  }, [sessionReady, clientXToLane, noteOn, noteOff]);

  const handleTouchEnd = useCallback((e) => {
    if (!sessionReady) return;

    for (const touch of e.changedTouches) {
      const lane = activeTouches.current.get(touch.identifier);
      if (lane !== undefined) {
        noteOff(lane);
        activeTouches.current.delete(touch.identifier);
      }
    }
  }, [sessionReady, noteOff]);

  // ── Dock mode derivation ───────────────────────────────────────────────────

  let dockMode = 'idle';
  if (state.editingPatternId) {
    const editingPat = state.patterns.find((p) => p.id === state.editingPatternId);
    dockMode = editingPat?.lockedIn ? 'locked' : 'recording';
  }

  const editingPattern = state.editingPatternId
    ? (plRef.current?.getPattern(state.editingPatternId) ?? null)
    : null;

  const currentPatternNotes = editingPattern
    ? editingPattern.notes.filter((n) => n.isComplete || n.length !== null)
    : [];

  const currentPatternQueued = state.editingPatternId
    ? (state.patterns.find((p) => p.id === state.editingPatternId)?.queued ?? false)
    : false;

  // ── Dock callbacks ─────────────────────────────────────────────────────────

  const handleNew = useCallback(() => {
    ensureAudio();
    setInstrumentPickerOpen(true);
  }, [ensureAudio]);

  const handleInstrumentSelect = useCallback((instName) => {
    setInstrumentPickerOpen(false);
    createPattern(instName);
  }, [createPattern]);

  const handleCancel = useCallback(() => {
    if (state.editingPatternId) removePattern(state.editingPatternId);
  }, [state.editingPatternId, removePattern]);

  const handleToggleQueue = useCallback(() => {
    if (state.editingPatternId) queuePattern(state.editingPatternId);
  }, [state.editingPatternId, queuePattern]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const instNames = Object.keys(INSTRUMENT_SETS[instSet]);

  return (
    <div className="scene practice practice-mobile" style={{ position: 'relative', height: '100%' }}>
      {sessionReady && !audioActive && (
        <div className="audio-hint">
          Tap the track or "+ New" to activate audio.
        </div>
      )}

      {/* Full-width track area — fills viewport minus dock */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: DOCK_HEIGHT,
          overflow: 'hidden',
        }}
      >
        <div
          ref={trackWrapperRef}
          style={{ position: 'relative', width: '100%', height: '100%' }}
        >
          <Track
            numLanes={NUM_LANES}
            seconds={seconds}
            active={!!state.editingPatternId}
            now={state.now}
            notes={currentPatternNotes}
            activeNotes={state.activeNotes}
            isMe={true}
            width={undefined}   /* let ResizeObserver handle sizing */
            height={undefined}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />
          <TrackLaneOverlay
            numLanes={NUM_LANES}
            ownerLabel={client?.username ? `${client.username}'s Track` : 'Your Track'}
          />
        </div>
      </div>

      {/* Dock */}
      <Dock
        mode={dockMode}
        isQueued={currentPatternQueued}
        onNew={handleNew}
        onLockIn={lockIn}
        onCancel={handleCancel}
        onToggleQueue={handleToggleQueue}
        onOpenPanel={() => setPanelOpen(true)}
        panelOpen={panelOpen}
      />

      {/* Panel drawer */}
      <PanelDrawer
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        patterns={state.patterns}
        onQueue={queuePattern}
        onDelete={removePattern}
        players={players.filter((m) => m.id !== client?.id)}
        playerNotes={(playerId) =>
          state.patterns
            .filter((p) => p.creator?.id === playerId && p.lockedIn)
            .flatMap((p) => p.notes)
        }
        now={state.now}
        seconds={seconds}
      />

      {/* Instrument picker sheet */}
      <InstrumentPickerSheet
        open={instrumentPickerOpen}
        instNames={instNames}
        instSet={instSet}
        onSelect={handleInstrumentSelect}
        onCancel={() => setInstrumentPickerOpen(false)}
      />
    </div>
  );
}
