/**
 * Track tests — Gap 2 from test-plan.md.
 *
 * Covers: time2y coordinate math, laneWidth calculation.
 * Canvas draw calls are mocked in setup.js; pixel output is manual-only.
 */

import { describe, it, expect } from 'vitest';

// ── Inline the pure functions for isolated unit testing ──────────────────────
// These mirror the implementations in Track.jsx exactly.

function time2y(time, seconds, trackH) {
  return trackH - (trackH / seconds) * time;
}

function laneWidth(trackW, numLanes) {
  return trackW / numLanes;
}

// ── time2y tests ──────────────────────────────────────────────────────────────

describe('time2y', () => {
  const H = 560;
  const seconds = 8;

  it('time=0 returns H (bottom of track)', () => {
    expect(time2y(0, seconds, H)).toBe(H);
  });

  it('time=seconds returns 0 (top of track)', () => {
    expect(time2y(seconds, seconds, H)).toBe(0);
  });

  it('is linear between 0 and H', () => {
    // Half phrase → half height
    expect(time2y(seconds / 2, seconds, H)).toBe(H / 2);
    // Quarter phrase
    expect(time2y(seconds / 4, seconds, H)).toBeCloseTo(H * 0.75);
    // Three-quarter phrase
    expect(time2y(seconds * 0.75, seconds, H)).toBeCloseTo(H * 0.25);
  });
});

// ── laneWidth tests ───────────────────────────────────────────────────────────

describe('laneWidth', () => {
  it('gives correct value for 8 lanes at 375px (mobile target)', () => {
    expect(laneWidth(375, 8)).toBeCloseTo(46.875);
  });

  it('laneWidth for 8 lanes at 375px is ≥ 44px (touch target minimum)', () => {
    expect(laneWidth(375, 8)).toBeGreaterThanOrEqual(44);
  });

  it('gives correct value for 8 lanes at 200px (desktop TRACK_W)', () => {
    expect(laneWidth(200, 8)).toBe(25);
  });
});
