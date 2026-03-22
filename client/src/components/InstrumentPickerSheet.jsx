/**
 * InstrumentPickerSheet.jsx — Bottom sheet instrument grid.
 *
 * Slides up from the bottom with a backdrop dimmer. Shows a grid of
 * instrument buttons for the current instrument set. Fires onSelect
 * with the instrument name or onCancel to dismiss.
 */

import React from 'react';
import { INSTRUMENT_SETS } from '../game/Instrument';

const INSTRUMENT_ICONS = {
  piano: '\uD83C\uDFB9',
  vibraphone: '\uD83C\uDFB6',
  guitar: '\uD83C\uDFB8',
  drum: '\uD83E\uDD41',
  bass: '\uD83C\uDFB5',
  synth: '\uD83C\uDFB9',
  trumpet: '\uD83C\uDFBA',
  sax: '\uD83C\uDFB7',
};

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'flex-end',
  },
  sheet: {
    width: '100%',
    background: 'var(--surface)',
    borderRadius: '16px 16px 0 0',
    padding: '16px 16px 24px',
    transition: 'transform 0.25s ease-out',
  },
  handle: {
    width: 40,
    height: 4,
    background: 'var(--border)',
    borderRadius: 2,
    margin: '0 auto 16px',
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 16,
    color: 'var(--text)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 12,
    marginBottom: 16,
  },
  instBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '16px 8px',
    background: 'var(--surface2)',
    border: '2px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    textTransform: 'capitalize',
    transition: 'border-color 0.15s, background 0.15s',
  },
  instIcon: {
    fontSize: 28,
  },
  cancelBtn: {
    display: 'block',
    width: '100%',
    padding: '12px',
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
  },
};

/**
 * @param {object}   props
 * @param {boolean}  props.open       - Whether the sheet is visible
 * @param {string}   props.instSet    - 'ROCK' | 'ELECTRO' | 'JAZZ'
 * @param {Function} props.onSelect   - Called with instrument name
 * @param {Function} props.onCancel   - Called to dismiss
 */
export default function InstrumentPickerSheet({
  open = false,
  instSet = 'ROCK',
  onSelect,
  onCancel,
}) {
  if (!open) return null;

  const instruments = INSTRUMENT_SETS[instSet];
  if (!instruments) return null;

  const instNames = Object.keys(instruments);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onCancel?.();
    }
  };

  return (
    <div style={styles.backdrop} onClick={handleBackdropClick}>
      <div style={styles.sheet}>
        <div style={styles.handle} />
        <div style={styles.title}>Choose Instrument</div>
        <div style={styles.grid}>
          {instNames.map((name) => (
            <button
              key={name}
              style={styles.instBtn}
              onClick={() => onSelect?.(name)}
            >
              <span style={styles.instIcon}>
                {INSTRUMENT_ICONS[name] || '\uD83C\uDFB5'}
              </span>
              {name}
            </button>
          ))}
        </div>
        <button style={styles.cancelBtn} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
