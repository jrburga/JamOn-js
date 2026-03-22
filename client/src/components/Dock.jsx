/**
 * Dock.jsx — Fixed 72px bottom bar for mobile practice view.
 *
 * Accepts a `mode` prop: 'idle' | 'recording' | 'locked'
 * Three-slot layout adapts controls based on mode.
 */

import React from 'react';

const DOCK_HEIGHT = 72;

const styles = {
  dock: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: DOCK_HEIGHT,
    background: 'var(--surface)',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 12px',
    zIndex: 100,
  },
  slot: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
  },
  slotLeft: {
    justifyContent: 'flex-start',
  },
  slotRight: {
    justifyContent: 'flex-end',
  },
  btn: {
    border: 'none',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 14,
    padding: '10px 16px',
    transition: 'opacity 0.15s',
  },
  btnNew: {
    background: 'var(--surface2)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
  },
  btnCancel: {
    background: 'none',
    color: 'var(--accent-red)',
    border: '1px solid var(--accent-red)',
  },
  btnLock: {
    background: 'var(--accent-red)',
    color: '#fff',
    minWidth: 100,
  },
  btnQueue: {
    color: '#fff',
    minWidth: 100,
  },
  btnPanel: {
    background: 'var(--surface2)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    fontSize: 18,
    padding: '10px 14px',
  },
};

/**
 * @param {object}  props
 * @param {'idle'|'recording'|'locked'} props.mode
 * @param {boolean} [props.isQueued]        - Whether current pattern is queued/playing
 * @param {Function} props.onNew            - "+ New" tapped (opens instrument picker)
 * @param {Function} props.onLockIn         - "Lock In" tapped
 * @param {Function} props.onCancel         - "Cancel" tapped (discard recording)
 * @param {Function} props.onToggleQueue    - Toggle queue/dequeue
 * @param {Function} props.onOpenPanel      - Open slide-up panel
 * @param {boolean}  [props.panelOpen]      - Whether panel is currently open
 */
export default function Dock({
  mode = 'idle',
  isQueued = false,
  onNew,
  onLockIn,
  onCancel,
  onToggleQueue,
  onOpenPanel,
  panelOpen = false,
}) {
  return (
    <div style={styles.dock} className="dock">
      {/* Left slot */}
      <div style={{ ...styles.slot, ...styles.slotLeft }}>
        {mode === 'recording' ? (
          <button
            style={{ ...styles.btn, ...styles.btnCancel }}
            onClick={onCancel}
          >
            &#x2715; Cancel
          </button>
        ) : (
          <button
            style={{ ...styles.btn, ...styles.btnNew }}
            onClick={onNew}
          >
            + New
          </button>
        )}
      </div>

      {/* Center slot */}
      <div style={styles.slot}>
        {mode === 'recording' && (
          <button
            style={{ ...styles.btn, ...styles.btnLock }}
            onClick={onLockIn}
          >
            Lock In
          </button>
        )}
        {mode === 'locked' && (
          <button
            style={{
              ...styles.btn,
              ...styles.btnQueue,
              background: isQueued ? 'var(--accent-green)' : 'var(--accent-blue)',
            }}
            onClick={onToggleQueue}
          >
            {isQueued ? 'Playing' : 'Queue'}
          </button>
        )}
        {/* idle: center slot is empty */}
      </div>

      {/* Right slot */}
      <div style={{ ...styles.slot, ...styles.slotRight }}>
        <button
          style={styles.btnPanel}
          onClick={onOpenPanel}
          aria-label={panelOpen ? 'Close panel' : 'Open panel'}
        >
          {panelOpen ? '\u2193' : '\u2261'}
        </button>
      </div>
    </div>
  );
}

export { DOCK_HEIGHT };
