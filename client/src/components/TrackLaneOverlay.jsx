/**
 * TrackLaneOverlay.jsx — pointer-events:none overlay for lane labels
 * and track ownership banner.
 *
 * Absolutely positioned over the Track canvas wrapper. Renders:
 *   - Note-name labels (e.g. "C3") centered per lane near the bottom
 *   - Track ownership banner ("Your Track" or "Watching [name]'s track") near the top
 */

import React from 'react';
import { midiToNote } from '../game/Instrument';

const styles = {
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    overflow: 'hidden',
  },
  banner: {
    position: 'absolute',
    top: 4,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 700,
    padding: '2px 0',
    textShadow: '0 1px 3px rgba(0,0,0,0.8)',
  },
  laneLabelsRow: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    display: 'flex',
  },
  laneLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: 600,
    fontFamily: 'monospace',
    color: 'rgba(255,255,255,0.6)',
    textShadow: '0 1px 2px rgba(0,0,0,0.9)',
  },
};

/**
 * @param {object}  props
 * @param {number}  props.numLanes           - Number of lanes
 * @param {number[]} [props.midiNotes]       - MIDI note numbers per lane (for labels)
 * @param {string}  [props.ownerLabel]       - "Your Track" or player name
 * @param {boolean} [props.isSpectating]     - Whether viewing another player's track
 * @param {string}  [props.spectatingName]   - Name of the player being spectated
 */
export default function TrackLaneOverlay({
  numLanes = 8,
  midiNotes,
  ownerLabel,
  isSpectating = false,
  spectatingName,
}) {
  // Build lane labels from MIDI notes
  const labels = midiNotes
    ? midiNotes.slice(0, numLanes).map((midi) =>
        Array.isArray(midi) ? midiToNote(midi[0]) : midiToNote(midi)
      )
    : [];

  // Banner text
  let bannerText = ownerLabel || 'Your Track';
  let bannerColor = 'var(--text)';
  if (isSpectating && spectatingName) {
    bannerText = `Watching ${spectatingName}'s track`;
    bannerColor = 'var(--text-muted)';
  }

  return (
    <div style={styles.overlay}>
      {/* Ownership banner */}
      <div style={{ ...styles.banner, color: bannerColor }}>
        {bannerText}
      </div>

      {/* Lane note labels */}
      {labels.length > 0 && (
        <div style={styles.laneLabelsRow}>
          {labels.map((label, i) => (
            <div key={i} style={styles.laneLabel}>
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
