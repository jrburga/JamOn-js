# Feature: Variable Pattern Lengths

## Overview
Players choose how many bars to record (1, 2, 4, or 8) when creating a pattern, rather than every pattern being locked to 4 bars. Shorter patterns loop more frequently within the shared session clock; longer patterns fill more of the phrase. All patterns remain phase-locked to the shared `session_start_epoch`.

---

## User Stories

- **As a drummer**, I want to record a 1-bar fill so that it loops 4 times per phrase without having to copy the notes manually.
- **As a synth player**, I want to record a slow 8-bar ambient pad so that it evolves over a longer cycle and doesn't feel like a tight loop.
- **As a bassist**, I want to record a 2-bar walking bass line so that it fits naturally in 8/4 time against a 4-bar drum pattern.
- **As any player**, I want short patterns to loop seamlessly within the shared clock so that all players stay in sync regardless of individual pattern lengths.

---

## UI/UX

### Pattern Creation Buttons (`Practice.jsx` — pattern-panel aside)
Each "Create [inst]" button expands inline to show a **bar count selector** before confirming:

```
[ + piano ]  →  click  →  [ 1 bar | 2 bars | ● 4 bars | 8 bars ] [ Create ]
```

- Default selection: 4 bars (current behavior).
- The selector appears as a small inline segmented control next to the button.
- Pressing a second key shortcut (e.g. `1`, `2`, `4`, `8`) while hovering the button selects bar count.
- After creation the button row returns to normal.

### Pattern List Item
Each pattern in the list shows its bar count as a small badge: `piano · 2 bars · Recording…`

### Track Canvas (`Track.jsx`)
- The canvas width represents the session phrase (current: 4 bars always).
- Patterns shorter than the session phrase show a **repeat indicator** — a lighter copy of the note layout tiled to fill the phrase. This makes it visually clear that the 1-bar pattern will loop 4×.
- Patterns longer than 4 bars (8 bars) require the track canvas to represent 8 bars; all other pattern tracks show their notes tiled to fill 8 bars in that view. (Session phrase length is `max(all pattern bar counts)` or a fixed host-set value — see Open Questions.)

---

## State Changes

### Pattern object (`game/Pattern.js`)
- `bars` already exists on `Pattern` — it is currently always inherited from `PatternList.bars` (hardcoded 4). No new field needed; just allow it to vary per pattern.
- `PatternList.addPattern(id, inst, isDrum, bars)` — add `bars` parameter (default 4 for backward compat).

### `PatternList` (`game/Pattern.js`)
- `PatternList.bars` becomes the **session phrase length** (the LCM or max of all pattern lengths, for playback scheduling). Patterns query their own `pat.bars` for recording/looping.

### Practice component state
- `pendingBars: number | null` — tracks bar count selection before a pattern is created. `null` = no selection pending.
- `sessionBars: number` — the total phrase length (initially 4, grows if a longer pattern is added). Used for the loop clock and track canvas width.

### `on_pattern_publish` payload
- `bars` already included in the snapshot payload (added in the networking refactor). No change needed.

---

## New Content / Assets

No new files or assets required. The existing `Quantizer` is initialized with `seconds` derived from `bars × tempo`, so it already handles variable lengths correctly once `bars` is passed through.

---

## Network Protocol Changes

### No new events required.
The `on_pattern_publish` payload already includes `bars` and `tempo`. Remote players reconstruct the `Pattern` with the correct `bars` value and compute `pat.seconds` accordingly.

### Playback loop clock
The game loop currently uses a fixed `seconds = spb × BARS × 4`. With variable lengths:
- Each pattern's playback window is `pat.seconds` (its own loop length).
- The **session phrase** (`sessionBars`) is the LCM of all active pattern bar counts, so patterns of 1, 2, and 4 bars all align on a 4-bar boundary. An 8-bar pattern extends the phrase to 8 bars.
- `secondsRef.current` updates to reflect `sessionBars × spb × 4` whenever a new pattern is added.
- The `inWindow` check in the game loop uses `pat.seconds` (not `sessionSeconds`) for wrapping, so a 1-bar pattern correctly loops 4× within a 4-bar phrase.

### Modified: `createPattern` action in `Practice.jsx`
```js
// Before
plRef.current.addPattern(id, instName, isDrum)

// After
plRef.current.addPattern(id, instName, isDrum, selectedBars)
```

---

## Open Questions
- **Session phrase length**: Should the host set a fixed phrase length (4 or 8 bars) in the WaitingRoom, or should it grow dynamically as players add longer patterns? Dynamic growth is more flexible but can confuse players mid-jam. Recommendation: host sets max bars in WaitingRoom (4 or 8), patterns must be ≤ that length.
- **Odd lengths (3 bars, 6 bars)**: Not worth supporting initially — stick to powers of 2 (1, 2, 4, 8).
- **Canvas layout**: When session phrase is 8 bars, does each player's track show the full 8-bar canvas, or does each track show only its own pattern length? Recommendation: all tracks show the full session phrase for visual consistency.
