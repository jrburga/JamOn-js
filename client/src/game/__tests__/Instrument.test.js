import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as Tone from 'tone';
import {
  midiToNote,
  INSTRUMENT_SETS,
  TEMPOS,
  Instrument,
  InstrumentManager,
  setTone,
} from '../Instrument.js';

// Tone.js is mocked globally in src/test/setup.js.
// Inject the mock before each test so InstrumentManager can use it.
beforeEach(() => setTone(Tone));

describe('midiToNote', () => {
  it('converts middle C (MIDI 60) to C4', () => {
    expect(midiToNote(60)).toBe('C4');
  });

  it('converts MIDI 69 to A4', () => {
    expect(midiToNote(69)).toBe('A4');
  });

  it('converts MIDI 0 to C-1', () => {
    expect(midiToNote(0)).toBe('C-1');
  });

  it('converts MIDI 127 to G9', () => {
    expect(midiToNote(127)).toBe('G9');
  });

  it('handles sharps correctly', () => {
    expect(midiToNote(61)).toBe('C#4'); // C# / Db
    expect(midiToNote(66)).toBe('F#4'); // F# / Gb
  });

  it('converts across multiple octaves consistently', () => {
    // Every 12 semitones is one octave
    const note0 = midiToNote(48); // C3
    const note1 = midiToNote(60); // C4
    const note2 = midiToNote(72); // C5
    expect(note0).toBe('C3');
    expect(note1).toBe('C4');
    expect(note2).toBe('C5');
  });
});

describe('INSTRUMENT_SETS', () => {
  it('contains exactly ROCK, ELECTRO, and JAZZ sets', () => {
    const keys = Object.keys(INSTRUMENT_SETS);
    expect(keys).toContain('ROCK');
    expect(keys).toContain('ELECTRO');
    expect(keys).toContain('JAZZ');
    expect(keys).toHaveLength(3);
  });

  it('each instrument definition has patch and notes arrays', () => {
    for (const [setName, set] of Object.entries(INSTRUMENT_SETS)) {
      for (const [instName, def] of Object.entries(set)) {
        expect(def, `${setName}/${instName} missing patch`).toHaveProperty('patch');
        expect(def, `${setName}/${instName} missing notes`).toHaveProperty('notes');
        expect(Array.isArray(def.patch), `${setName}/${instName} patch not array`).toBe(true);
        expect(Array.isArray(def.notes), `${setName}/${instName} notes not array`).toBe(true);
        expect(def.patch).toHaveLength(2);
        expect(def.notes.length).toBeGreaterThan(0);
      }
    }
  });

  it('ROCK set contains piano, guitar, bass, drum, vibraphone', () => {
    const rock = Object.keys(INSTRUMENT_SETS.ROCK);
    expect(rock).toContain('piano');
    expect(rock).toContain('guitar');
    expect(rock).toContain('bass');
    expect(rock).toContain('drum');
    expect(rock).toContain('vibraphone');
  });

  it('drum patches have bank 128 (General MIDI percussion)', () => {
    expect(INSTRUMENT_SETS.ROCK.drum.patch[0]).toBe(128);
    expect(INSTRUMENT_SETS.ELECTRO.drum.patch[0]).toBe(128);
    expect(INSTRUMENT_SETS.JAZZ.drum.patch[0]).toBe(128);
  });

  it('melodic instruments have bank 0', () => {
    expect(INSTRUMENT_SETS.ROCK.piano.patch[0]).toBe(0);
    expect(INSTRUMENT_SETS.ROCK.guitar.patch[0]).toBe(0);
    expect(INSTRUMENT_SETS.JAZZ.sax.patch[0]).toBe(0);
  });

  it('all MIDI note numbers are in valid range 0–127', () => {
    for (const set of Object.values(INSTRUMENT_SETS)) {
      for (const { notes } of Object.values(set)) {
        for (const note of notes) {
          const nums = Array.isArray(note) ? note : [note];
          for (const n of nums) {
            expect(n, `MIDI note ${n} out of range`).toBeGreaterThanOrEqual(0);
            expect(n, `MIDI note ${n} out of range`).toBeLessThanOrEqual(127);
          }
        }
      }
    }
  });
});

describe('TEMPOS', () => {
  it('defines tempos for each instrument set', () => {
    expect(TEMPOS.ROCK).toBeDefined();
    expect(TEMPOS.ELECTRO).toBeDefined();
    expect(TEMPOS.JAZZ).toBeDefined();
  });

  it('all tempos are positive numbers', () => {
    for (const bpm of Object.values(TEMPOS)) {
      expect(bpm).toBeGreaterThan(0);
    }
  });
});

describe('Instrument', () => {
  it('initialises with the correct inst name and notes from the set', () => {
    const inst = new Instrument('piano', 'ROCK');
    expect(inst.instName).toBe('piano');
    expect(inst.instSet).toBe('ROCK');
    expect(inst.notes).toEqual(INSTRUMENT_SETS.ROCK.piano.notes);
    expect(inst.patch).toEqual(INSTRUMENT_SETS.ROCK.piano.patch);
  });

  it('numNotes matches the notes array length', () => {
    const inst = new Instrument('guitar', 'ROCK');
    expect(inst.numNotes).toBe(INSTRUMENT_SETS.ROCK.guitar.notes.length);
  });

  it('isDrum returns true only for drum instruments', () => {
    expect(new Instrument('drum',  'ROCK').isDrum).toBe(true);
    expect(new Instrument('piano', 'ROCK').isDrum).toBe(false);
    expect(new Instrument('bass',  'ROCK').isDrum).toBe(false);
  });

  it('setInst changes the instrument definition within the same set', () => {
    const inst = new Instrument('piano', 'ROCK');
    inst.setInst('guitar');
    expect(inst.instName).toBe('guitar');
    expect(inst.notes).toEqual(INSTRUMENT_SETS.ROCK.guitar.notes);
  });

  it('setInst can switch to a different instrument set', () => {
    const inst = new Instrument('piano', 'ROCK');
    inst.setInst('synth', 'ELECTRO');
    expect(inst.instName).toBe('synth');
    expect(inst.instSet).toBe('ELECTRO');
    expect(inst.notes).toEqual(INSTRUMENT_SETS.ELECTRO.synth.notes);
  });

  it('setVolume updates velocity', () => {
    const inst = new Instrument('piano', 'ROCK');
    inst.setVolume(0.5);
    expect(inst.vel).toBe(0.5);
  });

  it('setMute toggles mute flag', () => {
    const inst = new Instrument('piano', 'ROCK');
    expect(inst.mute).toBe(false);
    inst.setMute(true);
    expect(inst.mute).toBe(true);
    inst.setMute(false);
    expect(inst.mute).toBe(false);
  });

  it('noteOn calls manager.noteOn with correct args', () => {
    const inst = new Instrument('piano', 'ROCK');
    const mockManager = { noteOn: vi.fn(), noteOff: vi.fn() };
    inst.manager = mockManager;
    inst.noteOn(0);
    expect(mockManager.noteOn).toHaveBeenCalledWith(
      'piano',
      INSTRUMENT_SETS.ROCK.piano.notes[0],
      inst.vel,
    );
  });

  it('noteOn passes velocity 0 when muted', () => {
    const inst = new Instrument('piano', 'ROCK');
    const mockManager = { noteOn: vi.fn(), noteOff: vi.fn() };
    inst.manager = mockManager;
    inst.setMute(true);
    inst.noteOn(0);
    expect(mockManager.noteOn).toHaveBeenCalledWith('piano', expect.any(Number), 0);
  });

  it('noteOff calls manager.noteOff with correct args', () => {
    const inst = new Instrument('piano', 'ROCK');
    const mockManager = { noteOn: vi.fn(), noteOff: vi.fn() };
    inst.manager = mockManager;
    inst.noteOff(2);
    expect(mockManager.noteOff).toHaveBeenCalledWith(
      'piano',
      INSTRUMENT_SETS.ROCK.piano.notes[2],
    );
  });

  it('noteOn does nothing if manager is not set', () => {
    const inst = new Instrument('piano', 'ROCK');
    expect(() => inst.noteOn(0)).not.toThrow();
  });

  it('handles chord notes (JAZZ piano which uses tuples)', () => {
    const inst = new Instrument('piano', 'JAZZ');
    const mockManager = { noteOn: vi.fn(), noteOff: vi.fn() };
    inst.manager = mockManager;
    // The first JAZZ piano note is a chord [60,64,67,69]
    inst.noteOn(0);
    // Should call noteOn once per pitch in the chord
    expect(mockManager.noteOn.mock.calls.length).toBe(4);
  });
});

describe('InstrumentManager', () => {
  it('creates without throwing (Tone.js is mocked)', () => {
    expect(() => new InstrumentManager(120)).not.toThrow();
  });

  it('getSynth returns a synth and caches it', () => {
    const im = new InstrumentManager(120);
    const s1 = im.getSynth('piano');
    const s2 = im.getSynth('piano');
    expect(s1).toBe(s2); // same instance (cached)
  });

  it('noteOn for a melodic instrument calls triggerAttack on the synth', () => {
    const im = new InstrumentManager(120);
    const synth = im.getSynth('piano');
    im.noteOn('piano', 60, 0.75);
    expect(synth.triggerAttack).toHaveBeenCalledWith('C4', 0, 0.75);
  });

  it('noteOff for a melodic instrument calls triggerRelease on the synth', () => {
    const im = new InstrumentManager(120);
    const synth = im.getSynth('guitar');
    im.noteOff('guitar', 60);
    expect(synth.triggerRelease).toHaveBeenCalledWith('C4', 0);
  });

  it('noteOn for drum does NOT call melodic synth', () => {
    const im = new InstrumentManager(120);
    const melodicSynth = im.getSynth('piano');
    im.noteOn('drum', 35); // bass drum
    expect(melodicSynth.triggerAttack).not.toHaveBeenCalled();
  });

  it('dispose cleans up all synths', () => {
    const im = new InstrumentManager(120);
    im.getSynth('piano');
    im.getSynth('guitar');
    expect(() => im.dispose()).not.toThrow();
  });
});
