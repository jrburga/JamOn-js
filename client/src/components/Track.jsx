/**
 * Track.jsx — Canvas-based vertical track component.
 *
 * Ports the Track / Lane / Gem system from track.py / virtuals/track.py.
 *
 * The track displays N lanes side-by-side.  A "now bar" scrolls through the
 * track vertically (top = future, bottom = past; when the now bar hits the
 * bottom it wraps back to the top — one full phrase = one full scroll).
 *
 * Notes (gems) are drawn as colored rectangles in their lane, positioned
 * at their recorded time.  While a key is held, the gem grows downward.
 */

import React, { useRef, useEffect, useCallback } from 'react';

// ── Layout constants ─────────────────────────────────────────────────────────
const TRACK_W = 200;
const TRACK_H = 560;
const NOW_BAR_COLOR_ACTIVE   = '#22aa44';
const NOW_BAR_COLOR_INACTIVE = '#888888';
const LANE_BG_COLORS         = ['#1a1a2e', '#16213e'];
const GEM_ALPHA              = 0.85;

function laneColor(laneIndex, numLanes) {
  const hue = Math.round((laneIndex / numLanes) * 300); // 0-300 range (avoids wrapping to red)
  return `hsla(${hue}, 80%, 60%, ${GEM_ALPHA})`;
}

function time2y(time, seconds, trackH) {
  return trackH - (trackH / seconds) * time;
}

// ── Track Component ──────────────────────────────────────────────────────────

/**
 * @param {object}  props
 * @param {number}  props.numLanes      - Number of lanes (keys)
 * @param {number}  props.seconds       - Phrase duration in seconds
 * @param {boolean} props.active        - Whether this track is being recorded
 * @param {number}  props.now           - Current playback time (0..seconds)
 * @param {Array}   props.notes         - Committed notes [{lane, time, length}]
 * @param {object}  props.activeNotes   - Currently-held notes {lane: startTime}
 * @param {boolean} props.isMe          - Whether this is the local player's track
 */
export default function Track({
  numLanes = 8,
  seconds = 8,
  active = false,
  now = 0,
  notes = [],
  activeNotes = {},
  isMe = true,
}) {
  const canvasRef = useRef(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    const laneW = W / numLanes;

    // ── Background ──
    for (let i = 0; i < numLanes; i++) {
      ctx.fillStyle = LANE_BG_COLORS[i % 2];
      ctx.fillRect(i * laneW, 0, laneW, H);
    }

    // ── Bar lines (every 1/4 bar) ──
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    const numBeatLines = 16;
    for (let i = 0; i <= numBeatLines; i++) {
      const t = (i / numBeatLines) * seconds;
      const y = time2y(t, seconds, H);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // ── Lane dividers ──
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    for (let i = 1; i < numLanes; i++) {
      ctx.beginPath();
      ctx.moveTo(i * laneW, 0);
      ctx.lineTo(i * laneW, H);
      ctx.stroke();
    }

    // ── Committed gems ──
    for (const note of notes) {
      if (note.length === null || note.length === undefined) continue;
      const x = note.lane * laneW + 1;
      const topY = time2y(note.time, seconds, H);
      const botY = time2y(note.time + note.length, seconds, H);
      const gemH = Math.max(2, topY - botY);

      ctx.fillStyle = laneColor(note.lane, numLanes);
      ctx.fillRect(x, botY, laneW - 2, gemH);

      // Fade effect: notes below now bar
      const nowY = time2y(now, seconds, H);
      if (botY > nowY) {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(x, botY, laneW - 2, gemH);
      }
    }

    // ── Active (being-held) gems ──
    for (const [laneStr, startTime] of Object.entries(activeNotes)) {
      const lane = parseInt(laneStr, 10);
      const x = lane * laneW + 1;
      const topY = time2y(startTime, seconds, H);
      const botY = time2y(now, seconds, H);
      const gemH = Math.max(2, topY - botY);

      ctx.fillStyle = laneColor(lane, numLanes);
      ctx.globalAlpha = 0.9;
      ctx.fillRect(x, Math.min(topY, botY), laneW - 2, Math.abs(gemH));
      ctx.globalAlpha = 1.0;
    }

    // ── Now bar ──
    const nowY = time2y(now, seconds, H);
    ctx.strokeStyle = active ? NOW_BAR_COLOR_ACTIVE : NOW_BAR_COLOR_INACTIVE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, nowY);
    ctx.lineTo(W, nowY);
    ctx.stroke();

    // ── Track outline ──
    ctx.strokeStyle = active ? '#33ddaa' : '#666';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, W, H);

    // ── Player label ──
    if (isMe) {
      ctx.fillStyle = active ? '#33ddaa' : '#aaa';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('YOU', 4, 14);
    }
  }, [numLanes, seconds, active, now, notes, activeNotes, isMe]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={TRACK_W}
      height={TRACK_H}
      style={{
        display: 'block',
        borderRadius: 4,
        cursor: active ? 'crosshair' : 'default',
      }}
    />
  );
}
