/**
 * Pattern.js — Note pattern recording and playback.
 *
 * Ports the Pattern/PatternList logic from pattern.py.
 * A Pattern stores a sequence of note events (on/off) with timestamps.
 */

import { Quantizer } from './Quantizer.js';

/**
 * A single recorded note (gem) within a pattern.
 */
export class Note {
  constructor(lane, time, isDrum = false) {
    this.lane = lane;
    this.time = time;
    this.length = isDrum ? 0.1 : null; // null = still held
    this.isDrum = isDrum;
  }

  get isComplete() {
    return this.length !== null;
  }

  release(time) {
    if (this.isDrum) return;
    this.length = Math.max(0.05, time - this.time);
  }
}

/**
 * A complete pattern: a loop of recorded notes.
 */
export class Pattern {
  constructor(id, bars, tempo, inst, instSet, isDrum = false) {
    this.id = id;
    this.bars = bars;
    this.tempo = tempo;
    this.inst = inst;
    this.instSet = instSet;
    this.isDrum = isDrum;

    const spb = 60 / tempo;
    const beats = bars * 4;
    this.seconds = spb * beats;

    // Resolution: 16 subdivisions per bar
    this.quantizer = new Quantizer(this.seconds, bars * 16);

    /** @type {Note[]} */
    this.notes = [];

    /** Active notes being held (lane → Note) */
    this._active = {};

    this.lockedIn = false;
    this.queued = false;
    this.editing = true;
  }

  /** Called when a key/lane is pressed. */
  onPress(lane, time) {
    if (this.lockedIn) return;
    const note = new Note(lane, time, this.isDrum);
    this._active[lane] = note;
    this.notes.push(note);
    return note;
  }

  /** Called when a key/lane is released. */
  onRelease(lane, time) {
    if (this.lockedIn) return;
    const note = this._active[lane];
    if (note) {
      note.release(time);
      if (!this.isDrum) {
        this.quantizer.quantizeGem(note);
      } else {
        this.quantizer.quantizeDrumGem(note);
      }
      delete this._active[lane];
    }
  }

  /** Remove a note at the given time and lane. */
  removeNote(time, lane) {
    this.notes = this.notes.filter(
      (n) => !(Math.abs(n.time - time) < 0.01 && n.lane === lane),
    );
  }

  /** Lock in the pattern — no more recording. */
  lockIn() {
    // Release any still-held notes
    for (const [lane, note] of Object.entries(this._active)) {
      note.release(this.seconds);
      if (!this.isDrum) this.quantizer.quantizeGem(note);
    }
    this._active = {};
    this.lockedIn = true;
    this.editing = false;
  }

  setQueued(val = true) {
    this.queued = val;
  }

  /**
   * Build a flat playback sequence: [{ time, lane, on }]
   * sorted by time, suitable for scheduling with Tone.js.
   */
  buildSequence() {
    const events = [];
    for (const note of this.notes) {
      if (!note.isComplete) continue;
      events.push({ time: note.time, lane: note.lane, on: true });
      events.push({ time: note.time + note.length, lane: note.lane, on: false });
    }
    events.sort((a, b) => a.time - b.time);
    return events;
  }

  /** Serialise to a plain object (for network transport). */
  toJSON() {
    return {
      id: this.id,
      bars: this.bars,
      tempo: this.tempo,
      inst: this.inst,
      instSet: this.instSet,
      isDrum: this.isDrum,
      lockedIn: this.lockedIn,
      notes: this.notes.map((n) => ({
        lane: n.lane,
        time: n.time,
        length: n.length,
        isDrum: n.isDrum,
      })),
    };
  }

  /** Reconstruct from a plain object. */
  static fromJSON(data) {
    const p = new Pattern(data.id, data.bars, data.tempo, data.inst, data.instSet, data.isDrum);
    p.lockedIn = data.lockedIn;
    p.editing = !data.lockedIn;
    p.notes = data.notes.map((n) => {
      const note = new Note(n.lane, n.time, n.isDrum);
      note.length = n.length;
      return note;
    });
    return p;
  }
}

/**
 * Manages the list of patterns in a session.
 * Mirrors PatternList in pattern.py.
 */
export class PatternList {
  constructor(bars, tempo, instSet) {
    this.bars = bars;
    this.tempo = tempo;
    this.instSet = instSet;
    /** @type {Object.<string, Pattern>} */
    this.patterns = {};
    this._nextId = 0;
  }

  createPattern(inst, client) {
    const id = client ? `${client.id}_${this._nextId++}` : String(this._nextId++);
    client?.addPattern(inst);
    client?.sendAction('on_pattern_create', {
      pattern_id: id,
      inst,
      creator: client.info,
    });
    return id;
  }

  addPattern(id, inst, isDrum = false) {
    const pattern = new Pattern(id, this.bars, this.tempo, inst, this.instSet, isDrum);
    this.patterns[id] = pattern;
    return pattern;
  }

  removePattern(id) {
    delete this.patterns[id];
  }

  getPattern(id) {
    return this.patterns[id];
  }

  getAllPatterns() {
    return Object.values(this.patterns);
  }
}
