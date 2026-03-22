/**
 * PanelDrawer.jsx — Slide-up panel with drag handle.
 *
 * Snaps to 60% screen height. Swipe down or tap the close button to dismiss.
 * Contains two sections:
 *   1. Pattern list — queue/delete controls per pattern
 *   2. Players — MiniTrack thumbnails for remote players
 */

import React, { useRef, useCallback, useState } from 'react';
import MiniTrack from './MiniTrack';

const SNAP_RATIO = 0.6; // 60% of screen height

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.3)',
    zIndex: 150,
  },
  panel: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    background: 'var(--surface)',
    borderRadius: '16px 16px 0 0',
    zIndex: 151,
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.25s ease-out',
    touchAction: 'none',
  },
  handle: {
    width: 40,
    height: 4,
    background: 'var(--border)',
    borderRadius: 2,
    margin: '10px auto 6px',
    cursor: 'grab',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 16px 16px',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 12,
  },
  // Pattern list styles
  patternItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    marginBottom: 6,
    fontSize: 13,
  },
  patternName: {
    flex: 1,
    fontWeight: 700,
    textTransform: 'capitalize',
  },
  patternBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    padding: '4px 8px',
    borderRadius: 4,
  },
  queueBtn: {
    color: 'var(--accent-blue)',
  },
  queuedBtn: {
    color: 'var(--accent-green)',
  },
  deleteBtn: {
    color: 'var(--accent-red)',
  },
  // Player thumbnails
  playersGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
  },
  playerCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    cursor: 'pointer',
  },
  playerName: {
    fontSize: 11,
    color: 'var(--text-muted)',
    fontWeight: 600,
    maxWidth: 120,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  emptyHint: {
    fontSize: 13,
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    padding: '8px 0',
  },
};

/**
 * @param {object}   props
 * @param {boolean}  props.open              - Whether the panel is visible
 * @param {Function} props.onClose           - Close callback
 * @param {Array}    [props.patterns=[]]     - Pattern objects [{id, inst, queued, editing, lockedIn}]
 * @param {Function} [props.onQueue]         - Called with pattern id to toggle queue
 * @param {Function} [props.onDelete]        - Called with pattern id to delete
 * @param {Array}    [props.players=[]]      - Remote players [{id, name, notes, activeNotes, now}]
 * @param {number}   [props.seconds=8]       - Phrase duration
 * @param {number}   [props.numLanes=8]      - Number of lanes
 * @param {Function} [props.onSpectate]      - Called with player id to spectate
 */
export default function PanelDrawer({
  open = false,
  onClose,
  patterns = [],
  onQueue,
  onDelete,
  players = [],
  seconds = 8,
  numLanes = 8,
  onSpectate,
}) {
  const panelRef = useRef(null);
  const dragStartY = useRef(null);
  const [dragOffset, setDragOffset] = useState(0);

  const panelHeight = Math.round(window.innerHeight * SNAP_RATIO);

  // Drag handling
  const handleDragStart = useCallback((e) => {
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStartY.current = clientY;
  }, []);

  const handleDragMove = useCallback((e) => {
    if (dragStartY.current === null) return;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const delta = clientY - dragStartY.current;
    if (delta > 0) {
      setDragOffset(delta);
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragOffset > 80) {
      onClose?.();
    }
    setDragOffset(0);
    dragStartY.current = null;
  }, [dragOffset, onClose]);

  if (!open) return null;

  const translateY = dragOffset > 0 ? `translateY(${dragOffset}px)` : 'none';

  return (
    <>
      <div style={styles.backdrop} onClick={onClose} />
      <div
        ref={panelRef}
        style={{
          ...styles.panel,
          height: panelHeight,
          transform: translateY,
        }}
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
      >
        {/* Drag handle */}
        <div style={styles.handle} />

        <div style={styles.content}>
          {/* ── Pattern list section (T06) ── */}
          <div style={styles.sectionTitle}>Patterns</div>
          {patterns.length === 0 ? (
            <div style={styles.emptyHint}>
              No patterns yet. Tap "+ New" to create one.
            </div>
          ) : (
            patterns.map((p) => (
              <div
                key={p.id}
                style={{
                  ...styles.patternItem,
                  borderColor: p.editing
                    ? 'var(--accent-green)'
                    : p.lockedIn
                    ? 'var(--accent-blue)'
                    : 'var(--border)',
                }}
              >
                <span style={styles.patternName}>{p.inst}</span>
                {p.editing && (
                  <span style={{ fontSize: 11, color: 'var(--accent-green)', fontStyle: 'italic' }}>
                    recording
                  </span>
                )}
                {p.lockedIn && (
                  <>
                    <button
                      style={{
                        ...styles.patternBtn,
                        ...(p.queued ? styles.queuedBtn : styles.queueBtn),
                      }}
                      onClick={() => onQueue?.(p.id)}
                      aria-label={p.queued ? 'Dequeue pattern' : 'Queue pattern'}
                    >
                      {p.queued ? '\u25B6' : '\u23F8'}
                    </button>
                    <button
                      style={{ ...styles.patternBtn, ...styles.deleteBtn }}
                      onClick={() => onDelete?.(p.id)}
                      aria-label="Delete pattern"
                    >
                      \u2715
                    </button>
                  </>
                )}
              </div>
            ))
          )}

          {/* ── Players section (T08) ── */}
          <div style={styles.sectionTitle}>Players</div>
          {players.length === 0 ? (
            <div style={styles.emptyHint}>No other players yet.</div>
          ) : (
            <div style={styles.playersGrid}>
              {players.map((player) => (
                <div
                  key={player.id}
                  style={styles.playerCard}
                  onClick={() => onSpectate?.(player.id)}
                >
                  <MiniTrack
                    notes={player.notes || []}
                    activeNotes={player.activeNotes || {}}
                    now={player.now || 0}
                    seconds={seconds}
                    numLanes={numLanes}
                  />
                  <span style={styles.playerName}>{player.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
