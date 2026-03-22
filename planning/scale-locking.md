# Feature: Scale Locking

## Overview
The host selects a musical key and scale during session setup. All recorded notes are snapped to the nearest in-key pitch at lock-in time, and the 8 playable lanes are remapped to show only in-scale notes. This lowers the barrier for non-musicians and keeps collaborative jams harmonically coherent.

---

## User Stories

- **As a host**, I want to select a key and scale for the session so that all players are constrained to compatible notes even if they don't know music theory.
- **As a player**, I want to see my 8 lanes labeled with note names so that I know what pitch each key plays without memorizing the layout.
- **As a player**, I want my recorded notes automatically snapped to the chosen scale so that even accidental key presses don't produce wrong notes.
- **As a non-musician player**, I want to be able to jam freely without worrying about hitting "bad" notes so that I can focus on rhythm and feel.
- **As a host**, I want to leave scale locking off (chromatic) so that experienced players can use all 12 pitches if they prefer.

---

## UI/UX

### WaitingRoom — Host Controls
A new **Key & Scale** section appears in the host's instrument panel alongside the existing instrument-set picker:

```
[ Key:   ▼ C  ]  [ Scale: ▼ Minor Pentatonic ]
```

- **Key** dropdown: `C`, `C#`, `D`, `D#`, `E`, `F`, `F#`, `G`, `G#`, `A`, `A#`, `B`
- **Scale** dropdown: `Chromatic (off)`, `Major`, `Natural Minor`, `Major Pentatonic`, `Minor Pentatonic`, `Blues`, `Dorian`, `Mixolydian`
- Default: `Chromatic (off)` — no change from current behavior.
- The selection is broadcast with `on_scene_change` and visible (read-only) to non-host players in the waiting room.

### Practice — Lane Labels
When a scale is active, each of the 8 track lanes displays its note name in the canvas gutter (e.g. `C3`, `Eb3`, `G3`…). The 8 lanes are mapped to the first 8 notes of the scale starting from a configurable root octave.

When `Chromatic (off)`, lanes show their current label (unchanged).

### Practice — Visual Feedback
- Notes that were snapped at lock-in show a small indicator (subtle color shift) so players can see the quantization happened.
- No real-time snapping visual during recording — the snap only applies at lock-in.

---

## State Changes

### Session metadata (extends `on_scene_change` payload)
```js
{
  scene_name: 'practice',
  band_members: [...],
  instrument_set: 'ROCK',
  scale_key: 'C',          // new — root note, e.g. 'C', 'F#'
  scale_type: 'minor_pentatonic',  // new — or 'chromatic' for off
}
```

### Client `Practice` component
- `scaleKey: string` and `scaleType: string` props (passed from `App.jsx` via `handleStart`).
- `scaleLanes: number[]` — computed from key+type, a list of 8 MIDI note numbers representing the lane-to-pitch mapping. Replaces the current `instRef.current.notes[lane]` lookup for pitched instruments.

### WaitingRoom component
- `selectedScaleKey: string` (state, host only)
- `selectedScaleType: string` (state, host only)

### App.jsx
- `scaleKey` and `scaleType` added alongside `instSet` to the scene transition state.

---

## New Content / Assets

### Scale Definitions (`client/src/game/Scales.js`)
Static map of scale types to interval arrays (semitone offsets from root):
```js
export const SCALES = {
  chromatic:          [0,1,2,3,4,5,6,7,8,9,10,11],
  major:              [0,2,4,5,7,9,11],
  natural_minor:      [0,2,3,5,7,8,10],
  major_pentatonic:   [0,2,4,7,9],
  minor_pentatonic:   [0,3,5,7,10],
  blues:              [0,3,5,6,7,10],
  dorian:             [0,2,3,5,7,9,10],
  mixolydian:         [0,2,4,5,7,9,10],
};

// Given key (0-11) + scale type, returns the first N MIDI pitches
export function buildLanes(rootMidi, scaleType, count = 8) { ... }
```

No audio samples required — the existing Tone.js synths accept arbitrary MIDI note numbers.

---

## Network Protocol Changes

### Modified: `on_scene_change` action payload
```js
// Before
{ scene_name, band_members, instrument_set }

// After
{ scene_name, band_members, instrument_set, scale_key, scale_type }
```

### Modified: Server `current_scene` storage
The server stores `current_scene = actionData.action` on `on_scene_change`, so `scale_key` and `scale_type` are automatically persisted for late-joining players. No other server changes needed.

### Modified: `on_pattern_publish` (minor)
The `notes` array already contains absolute `lane` indices. Since `scaleLanes` is derived from `scale_key` + `scale_type` (which all players share), remote players apply the same lane→pitch mapping automatically. No change to the publish payload needed.

---

## Open Questions
- Should the scale snap be applied at **press time** (real-time, affects live monitoring sound) or at **lock-in time** (only affects the stored notes)? Lock-in-time is simpler and consistent with time quantization. Real-time snapping is more musical but requires remapping `noteOn` calls.
- Should drum tracks be excluded from lane remapping? (Yes — drum lanes are kit pieces, not pitches.)
- Should the root octave be configurable per-instrument (bass plays C2, piano plays C4)?
