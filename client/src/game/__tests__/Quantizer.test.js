import { describe, it, expect } from 'vitest';
import { Quantizer } from '../Quantizer.js';

// Helpers
const SECONDS = 8.0;
const RES = 16; // 16 grid divisions per 8-second phrase → 0.5s per division

describe('Quantizer', () => {
  let q;

  beforeEach(() => {
    q = new Quantizer(SECONDS, RES);
  });

  // ── Constructor ────────────────────────────────────────────────────────────

  it('computes seconds-per-note correctly', () => {
    expect(q.spn).toBeCloseTo(SECONDS / RES); // 0.5
  });

  it('stores seconds and res', () => {
    expect(q.seconds).toBe(SECONDS);
    expect(q.res).toBe(RES);
  });

  // ── quantizeNote ──────────────────────────────────────────────────────────

  it('snaps a time exactly on a grid line to itself', () => {
    expect(q.quantizeNote(0.0)).toBeCloseTo(0.0);
    expect(q.quantizeNote(0.5)).toBeCloseTo(0.5);
    expect(q.quantizeNote(1.0)).toBeCloseTo(1.0);
    expect(q.quantizeNote(4.0)).toBeCloseTo(4.0);
  });

  it('rounds down when offset < half a grid cell', () => {
    // spn = 0.5; offset of 0.1 < 0.25 → round down to 1.0
    expect(q.quantizeNote(1.1)).toBeCloseTo(1.0);
    expect(q.quantizeNote(0.2)).toBeCloseTo(0.0);
  });

  it('rounds up when offset >= half a grid cell', () => {
    // offset of 0.3 >= 0.25 → round up to 1.5
    expect(q.quantizeNote(1.3)).toBeCloseTo(1.5);
    expect(q.quantizeNote(0.4)).toBeCloseTo(0.5);
  });

  it('handles the exact midpoint by rounding up', () => {
    // offset = 0.25 = spn/2 → boundary, rounds up
    expect(q.quantizeNote(0.25)).toBeCloseTo(0.5);
  });

  it('works with higher-resolution quantizers', () => {
    const fine = new Quantizer(4.0, 32); // spn = 0.125
    expect(fine.quantizeNote(0.06)).toBeCloseTo(0.0);
    expect(fine.quantizeNote(0.07)).toBeCloseTo(0.125);
  });

  it('handles values at the very end of the phrase', () => {
    expect(q.quantizeNote(7.9)).toBeCloseTo(8.0);
  });

  // ── quantizeGem ───────────────────────────────────────────────────────────

  it('snaps gem start and end to grid', () => {
    const gem = { time: 1.1, length: 0.4 };
    q.quantizeGem(gem);
    // time 1.1 → 1.0; end = 1.5 → 1.5; length = 0.5
    expect(gem.time).toBeCloseTo(1.0);
    expect(gem.length).toBeCloseTo(0.5);
  });

  it('enforces minimum note length of spn', () => {
    // A note so short the quantized length would be 0 → snap to spn
    const gem = { time: 1.0, length: 0.05 };
    q.quantizeGem(gem);
    expect(gem.length).toBeGreaterThanOrEqual(q.spn - 0.001);
  });

  it('preserves longer notes correctly', () => {
    const gem = { time: 0.0, length: 2.1 };
    q.quantizeGem(gem);
    expect(gem.time).toBeCloseTo(0.0);
    expect(gem.length).toBeCloseTo(2.0); // 2.1 rounds to 2.0
  });

  // ── quantizeDrumGem ───────────────────────────────────────────────────────

  it('only snaps drum gem start time, does not touch length', () => {
    const gem = { time: 1.1, length: 0.1 };
    q.quantizeDrumGem(gem);
    expect(gem.time).toBeCloseTo(1.0);
    expect(gem.length).toBe(0.1); // unchanged
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  it('handles zero time', () => {
    expect(q.quantizeNote(0)).toBeCloseTo(0);
  });

  it('handles a single-division phrase', () => {
    const tiny = new Quantizer(1.0, 1);
    expect(tiny.spn).toBe(1.0);
    expect(tiny.quantizeNote(0.6)).toBeCloseTo(1.0);
    expect(tiny.quantizeNote(0.4)).toBeCloseTo(0.0);
  });
});
