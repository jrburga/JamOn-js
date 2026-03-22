# Feature: Per-Pattern Effects

## Overview
Each locked-in pattern carries a set of audio effect parameters (reverb, delay, filter) that are applied during playback. Effects are configured before or after lock-in, included in the `on_pattern_publish` snapshot, and applied identically on all players' clients — so everyone hears the same mix.

---

## User Stories

- **As a synth player**, I want to add reverb to my pad pattern so that it feels spacious and ambient without having to record a different part.
- **As a bassist**, I want to high-pass filter my bass pattern so it doesn't muddy up the low end when mixed with a kick drum.
- **As a player**, I want my effects settings to be heard by other players automatically so that the overall mix sounds as I intended.
- **As a player**, I want to tweak effects on a locked-in pattern without re-recording so that I can refine the sound after hearing how it sits in the mix.
- **As a player**, I want the effects to be simple (a few knobs, not a full DAW) so that I can adjust them quickly during a jam.

---

## UI/UX

### Pattern List Item — Effects Row
When a pattern is locked in, an **FX** button appears alongside Queue and Delete:
```
[ piano  v1 ]  [ ▶ Playing ]  [ FX ]  [ ✕ ]
```

Clicking **FX** opens an **Effects Drawer** inline below the pattern item:
```
┌─ piano v1 ─────────────────────────────────────────────┐
│ Reverb:  [━━━━━●━━━━] 40%    Size:  [━━●━━━━━━━━━] 20% │
│ Delay:   [━━━●━━━━━━] 25%    Time:  [ ▼ 1/8 ]          │
│ Filter:  [━━━━━━━●━━] 70%    Type:  [ ▼ Low-pass ]      │
└─────────────────────────────────────────────────────────┘
```

- **Reverb**: wet level (0–100%) + room size (0–100%).
- **Delay**: wet level (0–100%) + delay time (synced to tempo: `1/4`, `1/8`, `1/16`, or off).
- **Filter**: cutoff (0–100% of frequency range) + type (`Low-pass`, `High-pass`, `Band-pass`).
- All controls are sliders/dropdowns; changes are applied in real time (live preview during editing).
- Changes broadcast to other players via `on_pattern_effects_update` (see Protocol).
- Remote players' patterns show effects controls as **read-only** (sliders visible but disabled).

### Effects Indicator
Pattern list items show a subtle **FX active** dot when any effect is non-default:
```
[ piano  v1  ● ]  [ ▶ Playing ]  [ FX ]  [ ✕ ]
```

---

## State Changes

### New `EffectsConfig` object
```js
// Default (no effects)
{
  reverb:  { wet: 0,   size: 0.5 },
  delay:   { wet: 0,   time: '1/8' },
  filter:  { cutoff: 1.0, type: 'lowpass' },   // cutoff 1.0 = fully open
}
```

### Pattern object (`game/Pattern.js`)
```js
this.effects = { ...DEFAULT_EFFECTS };  // new field
```

### InstrumentManager (`game/Instrument.js`)
- Each instrument channel gains an **effects chain**: `[Filter] → [Delay] → [Reverb] → output`.
- Tone.js nodes: `Tone.Filter`, `Tone.FeedbackDelay`, `Tone.Reverb`.
- `InstrumentManager.setEffects(instName, effectsConfig)` — updates the chain parameters live.
- Effects nodes are created per-instrument on startup (bypassed at default settings) to avoid latency from dynamic node creation.

### Practice component state
- Pattern list items gain `effects: EffectsConfig`.
- `effectsOpenId: string | null` — which pattern's FX drawer is currently expanded.

---

## New Content / Assets

No audio samples needed. Tone.js provides all required effect nodes:
- `Tone.Reverb` — convolution reverb
- `Tone.FeedbackDelay` — tempo-synced delay
- `Tone.Filter` — biquad filter

A `DEFAULT_EFFECTS` constant in a new `client/src/game/Effects.js` file defines baseline values and parameter ranges:
```js
export const DEFAULT_EFFECTS = {
  reverb:  { wet: 0, size: 0.5 },
  delay:   { wet: 0, time: '1/8' },
  filter:  { cutoff: 1.0, type: 'lowpass' },
};

export const DELAY_TIMES = ['1/4', '1/8', '1/16'];
export const FILTER_TYPES = ['lowpass', 'highpass', 'bandpass'];
```

---

## Network Protocol Changes

### Modified: `on_pattern_publish` payload
```js
{
  pattern_id, inst, isDrum, bars, tempo, instSet, notes, creator,
  effects: {           // new — defaults to DEFAULT_EFFECTS if omitted
    reverb:  { wet: 0.4, size: 0.2 },
    delay:   { wet: 0.25, time: '1/8' },
    filter:  { cutoff: 0.7, type: 'lowpass' },
  }
}
```
Remote players reconstruct the pattern with these effects applied immediately on first playback.

### New event: `on_pattern_effects_update`
Broadcast when a player adjusts effects on their own locked-in pattern (live tweaking):
```js
// Client sends:
client.sendAction('on_pattern_effects_update', {
  pattern_id: 'abc123',
  effects: { reverb: { wet: 0.5, size: 0.3 }, ... },
})

// Server: standard forward (no server-side state)

// Other clients:
case 'on_pattern_effects_update': {
  const { pattern_id, effects } = action;
  const pat = plRef.current.getPattern(pattern_id);
  if (pat) {
    pat.effects = effects;
    imRef.current.setEffects(pat.inst, effects);
  }
  dispatch({ type: 'UPDATE_PATTERN', id: pattern_id, updates: { effects } });
  break;
}
```

**Throttling**: Effects sliders emit `on_pattern_effects_update` at most every 100ms (debounced) to avoid flooding the room with events during knob dragging.

---

## Open Questions
- **Per-pattern vs. per-instrument effects**: If two patterns share the same instrument (e.g. two piano patterns), do they share one effects chain or have independent chains? Per-pattern is more flexible but requires routing each pattern through its own effects chain, which multiplies Tone.js nodes. Per-instrument is simpler. Recommendation: **per-instrument** to start, since only one pattern per instrument plays at a time in the current model.
- **Reverb tail on loop boundary**: A long reverb tail from the end of a loop may bleed into the next iteration. This is musically natural but could sound muddy. Consider a short fade on the loop boundary.
- **Effects on remote patterns you've modified**: If player A publishes effects, and player B manually overrides them locally, then A sends `on_pattern_effects_update` — should B's local override be preserved or overwritten? Recommendation: overwrite (A's effects are canonical for their pattern).
