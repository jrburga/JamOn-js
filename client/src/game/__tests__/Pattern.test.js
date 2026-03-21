import { describe, it, expect, beforeEach } from 'vitest';
import { Note, Pattern, PatternList } from '../Pattern.js';

// Shared test parameters (4 bars at 120 BPM = 8 seconds)
const BARS = 4;
const TEMPO = 120;
// spb = 0.5, beats = 16, seconds = 8

describe('Note', () => {
  it('creates a melodic note with null length', () => {
    const n = new Note(2, 1.5, false);
    expect(n.lane).toBe(2);
    expect(n.time).toBe(1.5);
    expect(n.length).toBeNull();
    expect(n.isDrum).toBe(false);
    expect(n.isComplete).toBe(false);
  });

  it('creates a drum note with a short default length', () => {
    const n = new Note(0, 0.5, true);
    expect(n.isDrum).toBe(true);
    expect(n.length).toBe(0.1);
    expect(n.isComplete).toBe(true); // drums are immediately complete
  });

  it('releases a melodic note and calculates length', () => {
    const n = new Note(3, 1.0, false);
    n.release(2.5);
    expect(n.length).toBeCloseTo(1.5);
    expect(n.isComplete).toBe(true);
  });

  it('clamps released length to a minimum of 0.05', () => {
    const n = new Note(0, 1.0, false);
    n.release(1.001); // barely any time held
    expect(n.length).toBeGreaterThanOrEqual(0.05);
  });
});

describe('Pattern', () => {
  let pattern;

  beforeEach(() => {
    pattern = new Pattern('test-id', BARS, TEMPO, 'piano', 'ROCK', false);
  });

  // ── Constructor ────────────────────────────────────────────────────────────

  it('sets the correct phrase length from bars and tempo', () => {
    // 4 bars × 4 beats/bar × (60/120) s/beat = 8 s
    expect(pattern.seconds).toBeCloseTo(8.0);
  });

  it('starts with no notes and not locked in', () => {
    expect(pattern.notes).toHaveLength(0);
    expect(pattern.lockedIn).toBe(false);
    expect(pattern.editing).toBe(true);
  });

  it('has a quantizer with the right resolution', () => {
    // bars * 16 = 64 divisions
    expect(pattern.quantizer.res).toBe(BARS * 16);
    expect(pattern.quantizer.seconds).toBe(pattern.seconds);
  });

  // ── onPress / onRelease ────────────────────────────────────────────────────

  it('records a note on press and returns it', () => {
    const note = pattern.onPress(3, 1.0);
    expect(note).toBeDefined();
    expect(pattern.notes).toHaveLength(1);
    expect(pattern.notes[0].lane).toBe(3);
    expect(pattern.notes[0].time).toBe(1.0);
  });

  it('completes a note on release with quantized values', () => {
    pattern.onPress(3, 1.0);
    pattern.onRelease(3, 2.0);
    const note = pattern.notes[0];
    expect(note.isComplete).toBe(true);
    expect(note.length).toBeGreaterThan(0);
  });

  it('can record multiple simultaneous lanes', () => {
    pattern.onPress(0, 1.0);
    pattern.onPress(1, 1.0);
    expect(pattern.notes).toHaveLength(2);
    pattern.onRelease(0, 1.5);
    pattern.onRelease(1, 2.0);
    expect(pattern.notes[0].isComplete).toBe(true);
    expect(pattern.notes[1].isComplete).toBe(true);
  });

  it('does not record on press after lockIn', () => {
    pattern.lockIn();
    pattern.onPress(0, 1.0);
    expect(pattern.notes).toHaveLength(0);
  });

  it('ignores release for a lane that was never pressed', () => {
    expect(() => pattern.onRelease(5, 2.0)).not.toThrow();
    expect(pattern.notes).toHaveLength(0);
  });

  // ── lockIn ─────────────────────────────────────────────────────────────────

  it('lockIn finalizes any still-held notes', () => {
    pattern.onPress(2, 0.5);
    // No release — lock in should still close the note
    pattern.lockIn();
    expect(pattern.notes[0].isComplete).toBe(true);
    expect(pattern.lockedIn).toBe(true);
    expect(pattern.editing).toBe(false);
  });

  it('lockIn clears _active tracking', () => {
    pattern.onPress(0, 0.0);
    pattern.lockIn();
    // After lock-in, further releases should be no-ops
    expect(() => pattern.onRelease(0, 1.0)).not.toThrow();
    expect(pattern.notes).toHaveLength(1); // still just the one note
  });

  // ── removeNote ────────────────────────────────────────────────────────────

  it('removes a note at a given time and lane', () => {
    pattern.onPress(4, 1.0);
    pattern.onRelease(4, 1.5);
    pattern.removeNote(1.0, 4);
    expect(pattern.notes).toHaveLength(0);
  });

  it('does not remove notes from other lanes', () => {
    pattern.onPress(4, 1.0);
    pattern.onRelease(4, 1.5);
    pattern.removeNote(1.0, 5); // different lane
    expect(pattern.notes).toHaveLength(1);
  });

  // ── buildSequence ──────────────────────────────────────────────────────────

  it('returns an empty sequence when no complete notes exist', () => {
    pattern.onPress(0, 0.0); // never released
    expect(pattern.buildSequence()).toHaveLength(0);
  });

  it('produces on and off events for each complete note', () => {
    pattern.onPress(0, 0.0);
    pattern.onRelease(0, 1.0);
    const seq = pattern.buildSequence();
    const onEvt  = seq.find((e) => e.on  === true  && e.lane === 0);
    const offEvt = seq.find((e) => e.on  === false && e.lane === 0);
    expect(onEvt).toBeDefined();
    expect(offEvt).toBeDefined();
  });

  it('returns events sorted by time', () => {
    pattern.onPress(1, 3.0); pattern.onRelease(1, 3.5);
    pattern.onPress(0, 0.0); pattern.onRelease(0, 0.5);
    const seq = pattern.buildSequence();
    for (let i = 1; i < seq.length; i++) {
      expect(seq[i].time).toBeGreaterThanOrEqual(seq[i - 1].time);
    }
  });

  it('emits exactly 2 events per note (on + off)', () => {
    pattern.onPress(2, 1.0); pattern.onRelease(2, 2.0);
    pattern.onPress(3, 3.0); pattern.onRelease(3, 3.5);
    expect(pattern.buildSequence()).toHaveLength(4);
  });

  // ── toJSON / fromJSON ──────────────────────────────────────────────────────

  it('serialises to a plain object', () => {
    pattern.onPress(0, 0.0);
    pattern.onRelease(0, 1.0);
    const json = pattern.toJSON();
    expect(json.id).toBe('test-id');
    expect(json.inst).toBe('piano');
    expect(json.bars).toBe(BARS);
    expect(json.notes).toHaveLength(1);
    expect(json.notes[0]).toMatchObject({ lane: 0 });
  });

  it('round-trips through JSON without data loss', () => {
    pattern.onPress(1, 2.0);
    pattern.onRelease(1, 3.0);
    pattern.lockIn();

    const json   = pattern.toJSON();
    const cloned = Pattern.fromJSON(json);

    expect(cloned.id).toBe(pattern.id);
    expect(cloned.lockedIn).toBe(true);
    expect(cloned.notes).toHaveLength(1);
    expect(cloned.notes[0].lane).toBe(1);
    expect(cloned.notes[0].isComplete).toBe(true);
  });
});

describe('Pattern (drum mode)', () => {
  it('creates drum notes with immediate isComplete', () => {
    const dp = new Pattern('drum-id', BARS, TEMPO, 'drum', 'ROCK', true);
    dp.onPress(0, 1.0);
    expect(dp.notes[0].isDrum).toBe(true);
    expect(dp.notes[0].isComplete).toBe(true);
  });

  it('buildSequence works for drum notes', () => {
    const dp = new Pattern('drum-id', BARS, TEMPO, 'drum', 'ROCK', true);
    dp.onPress(0, 0.5);
    dp.onPress(1, 2.0);
    const seq = dp.buildSequence();
    expect(seq.length).toBeGreaterThan(0);
  });
});

describe('PatternList', () => {
  let pl;

  beforeEach(() => {
    pl = new PatternList(BARS, TEMPO, 'ROCK');
  });

  it('starts empty', () => {
    expect(pl.getAllPatterns()).toHaveLength(0);
  });

  it('adds a pattern and retrieves it by id', () => {
    const p = pl.addPattern('p1', 'piano');
    expect(p).toBeDefined();
    expect(pl.getPattern('p1')).toBe(p);
  });

  it('getAllPatterns returns all added patterns', () => {
    pl.addPattern('a', 'guitar');
    pl.addPattern('b', 'bass');
    expect(pl.getAllPatterns()).toHaveLength(2);
  });

  it('removes a pattern by id', () => {
    pl.addPattern('x', 'synth');
    pl.removePattern('x');
    expect(pl.getPattern('x')).toBeUndefined();
    expect(pl.getAllPatterns()).toHaveLength(0);
  });

  it('removing a non-existent id is a no-op', () => {
    expect(() => pl.removePattern('no-such-id')).not.toThrow();
  });

  it('passes isDrum flag through to the created Pattern', () => {
    const dp = pl.addPattern('d1', 'drum', true);
    expect(dp.isDrum).toBe(true);
  });
});
