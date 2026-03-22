# Feature: Arpeggiator

## Overview
An arpeggiator transforms a set of held keys into an automatically sequenced melodic pattern. It operates as a client-side recording assistant — the output is a standard locked-in pattern indistinguishable from a manually recorded one. No network protocol changes are required.

---

## User Stories

- **As a player**, I want to hold down a chord while the arpeggiator runs so that I can create melodic sequences without having to play each note individually at the right timing.
- **As a player**, I want to choose the arpeggio rate (speed) and direction so that the sequence matches the musical feel I'm going for.
- **As a player**, I want to preview the arpeggio live before locking it in so that I can hear what it will sound like and adjust before committing.
- **As a player**, I want to pick from a library of pre-made arpeggio patterns (e.g. "staircase", "broken chord") so that I have a starting point even if I'm not sure what sounds good.
- **As a player**, I want the arpeggiator to only affect my current recording — not other players' patterns.

---

## UI/UX

### Pattern Creation Panel (`Practice.jsx` — pattern-panel aside)
- The "Create [inst]" buttons gain a small toggle: **[ Manual | Arp ]** per instrument row.
- Selecting "Arp" opens an **Arpeggiator Config drawer** below the button row (not a modal — stays visible while recording).

### Arpeggiator Config Drawer
```
[ Rate: ▼ 1/16 ]  [ Direction: ▼ Up ]  [ Octaves: ▼ 1 ]
[ Preset: ▼ None               ]
[ ● Record ]  (replaces normal recording; activates on pattern create)
```
- **Rate**: `1/4`, `1/8`, `1/16`, `1/32` — sets the interval between arp steps.
- **Direction**: `Up`, `Down`, `Up-Down`, `Random` — order notes are arpeggiated.
- **Octaves**: `1`, `2`, `3` — span arpeggiated notes across N octaves above held keys.
- **Preset**: dropdown of named patterns from the arpeggio library (see Assets).
- While recording in Arp mode, held keys are shown highlighted on the track canvas and the arp sequence pulses at the configured rate.
- Locking in (SPACE) finalizes the arp sequence into a standard pattern — the config drawer closes.

### Track Canvas
- In arp mode, the track shows two layers: **held keys** (dim) and **generated arp steps** (bright), so the player can see the sequence as it's being generated.

---

## State Changes

### New `ArpConfig` object (client-side only, not stored on server)
```js
{
  enabled: boolean,
  rate: '1/4' | '1/8' | '1/16' | '1/32',   // default '1/16'
  direction: 'up' | 'down' | 'updown' | 'random',  // default 'up'
  octaves: 1 | 2 | 3,                        // default 1
  presetId: string | null,                    // null = custom
}
```

### Practice component state
- `arpConfig: ArpConfig` — added to component state (not in the reducer; lives in a `useRef` since it only needs to affect the arp engine, not trigger renders).
- `arpMode: boolean` — whether the currently-being-created pattern is in arp mode.

### Pattern (game/Pattern.js)
- No changes to the `Pattern` class itself — the arpeggiator generates standard `Note` objects via `onPress`/`onRelease` calls. The `Pattern` is unaware it's being filled by an arpeggiator.

---

## New Content / Assets

### Arpeggio Preset Library (`client/src/game/ArpPresets.js`)
A static map of named presets, each defining a sequence of relative lane offsets and durations:
```js
export const ARP_PRESETS = {
  'staircase':     { steps: [0, 1, 2, 3], ratchet: false },
  'broken-chord':  { steps: [0, 2, 1, 3], ratchet: false },
  'alberti-bass':  { steps: [0, 2, 1, 2], ratchet: false },
  'ratchet-up':    { steps: [0, 0, 1, 1, 2, 2, 3, 3], ratchet: true },
};
```
These are pure data — no audio files required.

### Arpeggiator Engine (`client/src/game/Arpeggiator.js`)
New class:
```js
class Arpeggiator {
  constructor(config, pattern, instrument)
  start(heldLanes)   // begins generating notes into pattern
  updateHeld(lanes)  // call on keydown/keyup while arp is active
  stop()             // halts generation (called on lock-in)
}
```
Internally uses `setInterval` (or a Tone.js `Transport` sequence) timed to `rate` against `secondsRef`.

---

## Network Protocol Changes

**None.** The arpeggiator is entirely client-side. The locked-in pattern it produces is published via the existing `on_pattern_publish` event with standard note data. Other players receive it as a normal pattern.

---

## Open Questions
- Should arp mode be available for drums? (Likely not — drum lanes are percussive, not pitched. Disable arp toggle for drum instruments.)
- Should the arp continue generating while SPACE is being held, or stop immediately? (Recommendation: stop at the nearest quantize boundary so the loop ends cleanly.)
- Should preset selection load the config fields (rate, direction) or override them entirely?
