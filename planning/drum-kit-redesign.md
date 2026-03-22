# Feature: Drum Kit Redesign

## Overview
Replace the current generic 8-lane synthesized drum track with a named, sampler-based kit. Each lane maps to a specific piece of kit (Kick, Snare, Hi-Hat, etc.) loaded from audio samples. Velocity sensitivity and per-piece tuning are added. The kit varies per instrument set (Rock kit, Electro kit, Jazz kit).

---

## User Stories

- **As a drummer**, I want each key to trigger a recognizable drum sound (kick, snare, hi-hat) so that I can intuitively play rhythms without guessing what each lane sounds like.
- **As a drummer**, I want the kick to sound like a real kick drum, not a synthesized blip, so that the beat has weight and punch in the mix.
- **As a drummer**, I want to see the lane names (Kick, Snare, HH, etc.) labeled on the track so that I can build patterns without trial and error.
- **As a host**, I want the drum kit to match the session's instrument set (Rock, Electro, Jazz) so that the sounds are stylistically coherent.
- **As a player**, I want hitting a drum key softly vs. firmly to produce different volumes so that the performance feels expressive.

---

## UI/UX

### Track Canvas — Drum Lane Labels
For drum tracks, the 8 canvas lanes are labeled with kit piece abbreviations in the lane gutter:
```
│ KK │ ████   ████   ████   ████    ← Kick
│ SN │       ████       ████       ← Snare
│ HH │ ██ ██ ██ ██ ██ ██ ██ ██     ← Hi-Hat (closed)
│ OH │                ████         ← Hi-Hat (open)
│ CL │       ████       ████       ← Clap
│ TM │                        ████ ← Tom
│ RD │ ████                   ████ ← Ride
│ CR │                             ← Crash
```

Labels are rendered in the `Track.jsx` canvas on the left side of each lane row.

### Velocity Indication
Notes in the drum track canvas are rendered with varying opacity based on velocity: louder hits are fully opaque, softer hits are more translucent. This gives a visual sense of the dynamic shape of the beat.

### Kit Preview (WaitingRoom)
A small icon strip in the waiting room shows which drum kit will be loaded for the selected instrument set:
```
[ ROCK ] ←  🥁  Kick · Snare · Hi-Hat · Clap · Tom · Ride · Crash
```
No audio preview in the waiting room (keeps it simple).

---

## State Changes

### Kit Definition (`game/Instrument.js` — new drum kit entries)
Each `INSTRUMENT_SETS` entry gains a `drumKit` field replacing the generic `drum` synth config:
```js
ROCK: {
  piano: { ... },
  guitar: { ... },
  bass: { ... },
  drumKit: {
    lanes: [
      { name: 'Kick',     short: 'KK', sampleKey: 'kick'    },
      { name: 'Snare',    short: 'SN', sampleKey: 'snare'   },
      { name: 'Hi-Hat',   short: 'HH', sampleKey: 'hihat_c' },
      { name: 'Open HH',  short: 'OH', sampleKey: 'hihat_o' },
      { name: 'Clap',     short: 'CL', sampleKey: 'clap'    },
      { name: 'Tom',      short: 'TM', sampleKey: 'tom'     },
      { name: 'Ride',     short: 'RD', sampleKey: 'ride'    },
      { name: 'Crash',    short: 'CR', sampleKey: 'crash'   },
    ],
    samplerUrl: '/samples/rock-kit/',  // base path for sample files
  }
}
```

### Note object (`game/Pattern.js`)
```js
this.velocity = 1.0;  // new — 0.0 to 1.0, default 1.0 (full velocity)
```

### Velocity capture (keyboard input)
Velocity from keyboard is difficult to capture directly (no pressure data). Options:
1. **Static velocity** (simplest): all keyboard hits are velocity 1.0.
2. **Double-tap velocity**: pressing a key twice quickly = accent (1.0), once = ghost (0.5). Configurable.

### InstrumentManager — Drum Channel
The drum channel is constructed as a `Tone.Sampler` instead of a `Tone.PolySynth`:
```js
const drumSampler = new Tone.Sampler({
  urls: { C2: 'kick.wav', D2: 'snare.wav', ... },
  baseUrl: '/samples/rock-kit/',
});
```
Each lane maps to a specific note on the sampler (C2=kick, D2=snare, etc.).

---

## New Content / Assets

### Sample Files (`client/public/samples/`)
Three kit directories, one per instrument set:
```
client/public/samples/
  rock-kit/
    kick.wav, snare.wav, hihat_c.wav, hihat_o.wav,
    clap.wav, tom.wav, ride.wav, crash.wav
  electro-kit/
    kick.wav, snare.wav, hihat_c.wav, hihat_o.wav,
    clap.wav, tom.wav, ride.wav, crash.wav
  jazz-kit/
    kick.wav, snare.wav, hihat_c.wav, hihat_o.wav,
    clap.wav, tom.wav, ride.wav, crash.wav
```

**Sourcing**: Free, license-clear drum samples available from:
- [Freesound.org](https://freesound.org) (CC0)
- [SampleSwap](https://sampleswap.org) (free)
- Tone.js ships with a small built-in sample library that includes basic drum sounds as a starting point.

**Format**: 44.1kHz 16-bit WAV or MP3 (MP3 smaller; WAV avoids codec latency). Aim for < 200KB per kit.

### Sample Manifest (`client/src/game/DrumKits.js`)
```js
export const DRUM_KITS = {
  ROCK:   { baseUrl: '/samples/rock-kit/',   lanes: [...] },
  ELECTRO:{ baseUrl: '/samples/electro-kit/', lanes: [...] },
  JAZZ:   { baseUrl: '/samples/jazz-kit/',   lanes: [...] },
};
```

---

## Network Protocol Changes

**None for the core feature.** The drum track publishes via the existing `on_pattern_publish` with the same note format (lane index + time + length). The lane-to-sample mapping is derived from the shared `instSet` that all players already have. Remote players reconstruct the correct sounds because they load the same kit based on `instSet`.

### Modified: `Pattern.isDrum` handling
Remote pattern reconstruction (`on_pattern_publish` handler) already reads `isDrum` from the snapshot. The only change: when `isDrum` is true, playback calls `drumSampler.triggerAttack(lane_note, time, velocity)` instead of the poly synth.

---

## Open Questions
- **Sampler load time**: `Tone.Sampler` loads samples asynchronously. The session init in `Practice.jsx` should await sampler loading before setting `sessionReady = true`, or samples should be preloaded during the WaitingRoom. Recommendation: preload in WaitingRoom so Practice is immediately ready.
- **Open hi-hat choke**: In real drum kits, hitting an open hi-hat while a closed hi-hat is playing chokes (stops) the open sound. Should we implement hi-hat choking? Yes, for authenticity — the `OH` lane stop the `HH` lane on press.
- **Velocity from touch/MIDI**: On mobile (touch), velocity could be derived from touch pressure or tap area. MIDI controllers provide native velocity. Worth designing the `noteOn(lane, velocity)` API to accept velocity now even if keyboard always sends 1.0.
- **Kit mixing levels**: Each kit piece may need a gain offset (kick louder than hihat) baked into the sample or applied via `Tone.Volume` nodes. Handle in the sample manifest or in `DrumKits.js`.
