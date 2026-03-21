/**
 * Instrument.js — Instrument definitions + Tone.js audio engine.
 *
 * Ports Python instrument.py:
 *   - INSTRUMENT_SETS with MIDI note numbers
 *   - Instrument class with note_on / note_off
 *   - InstrumentManager for channel/synth management
 */

import * as Tone from 'tone';

// ── Utility ─────────────────────────────────────────────────────────────────

/** Convert a MIDI note number (0-127) to a Tone.js note string like "C4". */
export function midiToNote(midi) {
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[midi % 12]}${octave}`;
}

// ── Instrument Set Definitions ───────────────────────────────────────────────
// Mirrors INSTRUMENT_SETS in instrument.py exactly.
// patch: [bank, program]  notes: MIDI note numbers for each lane

export const INSTRUMENT_SETS = {
  ROCK: {
    piano:      { patch: [0,   0], notes: [60,62,64,65,67,69,71,72,74,76] },
    vibraphone: { patch: [0,  11], notes: [60,62,64,65,67,69,71,72,74,76] },
    guitar:     { patch: [0,  24], notes: [48,50,52,53,55,57,59,60,62,64] },
    drum:       { patch: [128, 0], notes: [35,38,42,46,41,43,51,49] },
    bass:       { patch: [0,  33], notes: [33,35,36,38,40,41,43,45,47,48] },
  },
  ELECTRO: {
    synth:    { patch: [0,  80], notes: [60,62,64,65,67,69,71,72,74,76] },
    trumpet:  { patch: [0,  62], notes: [60,62,64,65,67,69,71,72,74,76] },
    drum:     { patch: [128,24], notes: [35,38,42,46,41,43,51,49] },
    bass:     { patch: [0,  38], notes: [33,35,36,38,40,41,43,45,47,48] },
  },
  JAZZ: {
    bass:    { patch: [0,  32], notes: [36,38,40,41,43,45,47,48] },
    trumpet: { patch: [0,  56], notes: [60,62,64,65,67,69,71,72,74,76] },
    sax:     { patch: [0,  65], notes: [60,62,64,65,67,69,71,72,74,76] },
    drum:    { patch: [128, 0], notes: [35,38,42,46,41,43,51,49] },
    piano:   {
      patch: [0, 0],
      notes: [
        [60,64,67,69], [62,65,69,72], [64,67,71,74], [65,69,72,76],
        [55,65,67,71,74], [67,69,72,76], [69,71,74,77], [60,64,67,71], [60,64,66,69],
      ],
    },
  },
};

export const TEMPOS = { ROCK: 120, ELECTRO: 120, JAZZ: 120 };

// ── Synth Factories ──────────────────────────────────────────────────────────

// Drum note mapping: MIDI note → { synth type, params }
const DRUM_MAP = {
  35: { type: 'kick',  freq: 60 },   // Bass Drum
  36: { type: 'kick',  freq: 60 },
  38: { type: 'snare', freq: 200 },  // Snare
  40: { type: 'snare', freq: 220 },
  42: { type: 'hihat', freq: 800 },  // Closed Hi-Hat
  44: { type: 'hihat', freq: 800 },
  46: { type: 'hihat', freq: 1200 }, // Open Hi-Hat
  41: { type: 'tom',   freq: 100 },  // Low Floor Tom
  43: { type: 'tom',   freq: 130 },  // High Floor Tom
  45: { type: 'tom',   freq: 180 },
  47: { type: 'tom',   freq: 220 },
  48: { type: 'tom',   freq: 270 },
  50: { type: 'tom',   freq: 310 },
  49: { type: 'crash', freq: 1500 }, // Crash
  51: { type: 'ride',  freq: 1200 }, // Ride
  57: { type: 'crash', freq: 1400 },
  59: { type: 'ride',  freq: 1100 },
};

function makeSynth(instName) {
  switch (instName) {
    case 'piano':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 1.2 },
      }).toDestination();

    case 'vibraphone':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.8, sustain: 0.2, release: 2.0 },
      }).toDestination();

    case 'guitar':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.01, decay: 0.15, sustain: 0.2, release: 0.5 },
      }).toDestination();

    case 'bass':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.05, decay: 0.4, sustain: 0.5, release: 0.8 },
      }).toDestination();

    case 'synth':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'square' },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 },
      }).toDestination();

    case 'trumpet':
    case 'sax':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.05, decay: 0.1, sustain: 0.8, release: 0.4 },
      }).toDestination();

    default:
      return new Tone.PolySynth(Tone.Synth).toDestination();
  }
}

// ── InstrumentManager ────────────────────────────────────────────────────────

/**
 * Manages all Tone.js synths and the metronome.
 * Mirrors InstrumentManager in instrument.py.
 */
export class InstrumentManager {
  constructor(tempo) {
    this._synths = {};
    this._drumSynths = {
      kick:  new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 4 }).toDestination(),
      snare: new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.005, decay: 0.1, sustain: 0 } }).toDestination(),
      hihat: new Tone.MetalSynth({ frequency: 800, envelope: { attack: 0.001, decay: 0.05, release: 0.01 }, harmonicity: 5.1, modulationIndex: 32 }).toDestination(),
      tom:   new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 2 }).toDestination(),
      crash: new Tone.MetalSynth({ frequency: 1200, envelope: { attack: 0.001, decay: 0.3, release: 0.2 }, harmonicity: 5.1, modulationIndex: 32 }).toDestination(),
      ride:  new Tone.MetalSynth({ frequency: 1000, envelope: { attack: 0.001, decay: 0.1, release: 0.05 }, harmonicity: 5.1, modulationIndex: 24 }).toDestination(),
    };

    Tone.getTransport().bpm.value = tempo;
  }

  getSynth(instName) {
    if (!this._synths[instName]) {
      this._synths[instName] = makeSynth(instName);
    }
    return this._synths[instName];
  }

  noteOn(instName, midiNote, velocity = 0.75) {
    const isDrum = instName === 'drum';
    if (isDrum) {
      const drumInfo = DRUM_MAP[midiNote];
      if (!drumInfo) return;
      const synth = this._drumSynths[drumInfo.type];
      if (!synth) return;
      if (drumInfo.type === 'snare') {
        synth.triggerAttackRelease('16n', Tone.now());
      } else {
        synth.triggerAttackRelease(drumInfo.freq, '8n', Tone.now());
      }
    } else {
      const note = midiToNote(midiNote);
      const synth = this.getSynth(instName);
      synth.triggerAttack(note, Tone.now(), velocity);
    }
  }

  noteOff(instName, midiNote) {
    if (instName === 'drum') return; // drums are percussive
    const note = midiToNote(midiNote);
    const synth = this.getSynth(instName);
    synth.triggerRelease(note, Tone.now());
  }

  dispose() {
    for (const s of Object.values(this._synths)) s.dispose();
    for (const s of Object.values(this._drumSynths)) s.dispose();
  }
}

// ── Instrument ───────────────────────────────────────────────────────────────

/**
 * A single instrument held by a player.
 * Mirrors Instrument in instrument.py.
 */
export class Instrument {
  constructor(instName, instSet = 'ROCK') {
    this.instSet = instSet;
    this.instName = instName;
    const def = INSTRUMENT_SETS[instSet][instName];
    this.patch = def.patch;
    this.notes = def.notes;
    this.vel = 0.75;
    this.mute = false;
    this.manager = null; // set by InstrumentManager.add()
  }

  get numNotes() {
    return this.notes.length;
  }

  get isDrum() {
    return this.instName === 'drum';
  }

  setInst(instName, instSet = null) {
    const set = instSet || this.instSet;
    const def = INSTRUMENT_SETS[set][instName];
    this.instName = instName;
    this.instSet = set;
    this.patch = def.patch;
    this.notes = def.notes;
  }

  setVolume(vol) {
    this.vel = vol;
  }

  setMute(mute) {
    this.mute = mute;
  }

  noteOn(lane) {
    if (!this.manager) return;
    const pitches = Array.isArray(this.notes[lane]) ? this.notes[lane] : [this.notes[lane]];
    for (const pitch of pitches) {
      this.manager.noteOn(this.instName, pitch, this.mute ? 0 : this.vel);
    }
  }

  noteOff(lane) {
    if (!this.manager) return;
    const pitches = Array.isArray(this.notes[lane]) ? this.notes[lane] : [this.notes[lane]];
    for (const pitch of pitches) {
      this.manager.noteOff(this.instName, pitch);
    }
  }
}
