# Feature: Arrangement / Scheduling Layer

## Overview
Each locked-in pattern can be given a **start offset** (in bars) within a longer session phrase, so players can compose with their loops rather than having everything play simultaneously from bar 0. A lightweight horizontal timeline UI makes offsets visible and editable. The session phrase extends to accommodate all offsets.

---

## User Stories

- **As a player**, I want my 2-bar fill to only play in bars 3–4 of the phrase so that it hits at the right moment instead of looping from the top.
- **As a drummer**, I want to schedule a breakdown pattern to start at bar 9 in a 16-bar phrase so that the arrangement has a structured arc.
- **As any player**, I want to see all active patterns on a shared timeline so that I can understand the overall arrangement at a glance.
- **As a player**, I want to drag a pattern block on the timeline to change when it plays so that I can experiment with arrangement without re-recording.
- **As a host**, I want to set the total session phrase length (8, 16, or 32 bars) so that there's enough space for meaningful arrangement.

---

## UI/UX

### WaitingRoom — Host Controls
A **Phrase Length** selector is added to the host's setup panel:
```
[ Phrase: ▼ 8 bars ]
```
Options: `4`, `8`, `16`, `32` bars. Default: `4` (current behavior, no visible change).

### Practice — Arrangement Timeline
A new **arrangement strip** appears between the pattern list and the track area (collapsible, hidden by default):

```
▶ Arrangement  [collapse ▲]
Bar:  1    2    3    4    5    6    7    8
┌─────────────┐
│ piano v1    │                          ← drag to reposition
└─────────────┘
         ┌──────────────────────────────┐
         │ bass v1                      │
         └──────────────────────────────┘
              ┌──────────┐
              │ drum v1  │
              └──────────┘
```

- Each locked-in, queued pattern appears as a **draggable block** on the timeline.
- Block width = pattern length in bars.
- Blocks snap to bar boundaries on drag.
- A block can be dragged horizontally to change its `offsetBars`.
- The timeline scrolls horizontally for phrase lengths > 8 bars.
- Blocks belonging to other players are shown with a different border (you can see their arrangement but can't move their blocks).
- The loop playhead is a vertical line that scrolls across the timeline in sync with `state.now`.

### Pattern List Item
The pattern list shows the offset alongside queue status:
```
[ piano  v1 · starts bar 3 ]  [ ▶ Playing ]  [ ✕ ]
```
Clicking the offset badge (`starts bar 3`) focuses the timeline on that pattern.

---

## State Changes

### Pattern object (`game/Pattern.js`)
```js
this.offsetBars = 0;  // new — bar offset within the session phrase (default 0)
```

### Practice component state
- `phraseLength: number` — total bars in the session phrase (from scene metadata). Derived from `on_scene_change`.
- `arrangementOpen: boolean` — whether the timeline strip is expanded.
- Pattern list items gain `offsetBars: number`.

### Playback logic (game loop)
The `inWindow` check in the game loop must account for offset:
```js
// Effective pattern time within the phrase:
const phraseSecs = phraseLength * spb * 4;
const offsetSecs = pat.offsetBars * spb * 4;
const patElapsed = (now - offsetSecs + phraseSecs) % phraseSecs;
// Then check if patElapsed is within [prevPatElapsed, patElapsed)
// wrapping at pat.seconds (not phraseSecs)
```

This is the core logic change: each pattern's playback position is shifted by `offsetBars` relative to the shared clock.

---

## New Content / Assets

No new files or audio assets. The timeline UI uses CSS/SVG for rendering — no external libraries required.

---

## Network Protocol Changes

### Modified: `on_scene_change` payload
```js
{ scene_name, band_members, instrument_set, scale_key, scale_type, phrase_length }
// phrase_length: number of bars in the session phrase (e.g. 8)
```

### New event: `on_pattern_arrange`
Broadcast when a player changes the offset of one of their own patterns:
```js
// Client sends:
client.sendAction('on_pattern_arrange', {
  pattern_id: 'abc123',
  offset_bars: 2,
})

// Server: standard action forward (no server-side state change needed)

// Other clients update:
case 'on_pattern_arrange': {
  const { pattern_id, offset_bars } = action;
  const pat = plRef.current.getPattern(pattern_id);
  if (pat) pat.offsetBars = offset_bars;
  dispatch({ type: 'UPDATE_PATTERN', id: pattern_id, updates: { offsetBars: offset_bars } });
  break;
}
```

### Modified: `on_pattern_publish` payload
```js
{ ..., offset_bars: 0 }  // new — default 0, included in snapshot
```
Remote players reconstruct patterns with the correct offset from the start.

---

## Open Questions
- **Offset ownership**: Should only the pattern creator be able to move their blocks on the timeline? Or can the host arrange all blocks (like a DAW arranger)? Recommendation: creator only for their blocks, for simplicity.
- **Collision handling**: What happens when two patterns from different players overlap on the same instrument? Nothing special — both play; it's a mix decision. But the UI should make overlaps visible (block borders overlap visually).
- **Phrase length changes mid-session**: If the host wants to extend from 8 to 16 bars, this would require re-broadcasting `on_scene_change`. Is that safe? Patterns with `offsetBars` within the old length are unaffected; new space is simply empty.
- **Non-looping patterns**: Should a pattern with `offsetBars > 0` and a short length loop repeatedly within the phrase, or play once and stop? Recommendation: loop (consistent with current behavior). A "one-shot" mode could come later.
