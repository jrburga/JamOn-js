/**
 * MiniTrack.jsx — Read-only canvas thumbnail (~120x80px).
 *
 * Same data shape as Track.jsx but renders only note rectangles,
 * no labels, no beat lines, no now-bar text. Used in PanelDrawer
 * to show remote players' tracks.
 */

import React, { useRef, useEffect, useCallback } from 'react';

const DEFAULT_W = 120;
const DEFAULT_H = 80;
const LANE_BG_COLORS = ['#1a1a2e', '#16213e'];

function laneColor(laneIndex, numLanes) {
  const hue = Math.round((laneIndex / numLanes) * 300);
  return `hsla(${hue}, 80%, 60%, 0.85)`;
}

function time2y(time, seconds, trackH) {
  return trackH - (trackH / seconds) * time;
}

/**
 * @param {object}  props
 * @param {number}  [props.width=120]     - Canvas width
 * @param {number}  [props.height=80]     - Canvas height
 * @param {number}  [props.numLanes=8]    - Number of lanes
 * @param {number}  [props.seconds=8]     - Phrase duration
 * @param {number}  [props.now=0]         - Current playback time
 * @param {Array}   [props.notes=[]]      - Committed notes [{lane, time, length}]
 * @param {object}  [props.activeNotes={}]- Currently-held notes {lane: startTime}
 */
export default function MiniTrack({
  width = DEFAULT_W,
  height = DEFAULT_H,
  numLanes = 8,
  seconds = 8,
  now = 0,
  notes = [],
  activeNotes = {},
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

    // Lane backgrounds
    for (let i = 0; i < numLanes; i++) {
      ctx.fillStyle = LANE_BG_COLORS[i % 2];
      ctx.fillRect(i * laneW, 0, laneW, H);
    }

    // Committed notes
    for (const note of notes) {
      if (note.length === null || note.length === undefined) continue;
      const x = note.lane * laneW;
      const topY = time2y(note.time, seconds, H);
      const botY = time2y(note.time + note.length, seconds, H);
      const gemH = Math.max(1, topY - botY);

      ctx.fillStyle = laneColor(note.lane, numLanes);
      ctx.fillRect(x + 0.5, botY, laneW - 1, gemH);
    }

    // Active notes
    for (const [laneStr, startTime] of Object.entries(activeNotes)) {
      const lane = parseInt(laneStr, 10);
      const x = lane * laneW;
      const topY = time2y(startTime, seconds, H);
      const botY = time2y(now, seconds, H);
      const gemH = Math.max(1, topY - botY);

      ctx.fillStyle = laneColor(lane, numLanes);
      ctx.globalAlpha = 0.9;
      ctx.fillRect(x + 0.5, Math.min(topY, botY), laneW - 1, Math.abs(gemH));
      ctx.globalAlpha = 1.0;
    }

    // Now bar (thin line)
    const nowY = time2y(now, seconds, H);
    ctx.strokeStyle = '#22aa44';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, nowY);
    ctx.lineTo(W, nowY);
    ctx.stroke();

    // Border
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, W, H);
  }, [numLanes, seconds, now, notes, activeNotes]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        display: 'block',
        width,
        height,
        borderRadius: 4,
      }}
    />
  );
}
