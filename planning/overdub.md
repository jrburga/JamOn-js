# Feature: Overdub / Pattern Versioning

## Overview
After a pattern is locked in, its creator can overdub it — record a new layer of notes on top — producing a revised version (v2, v3, …). The new version is published as a fresh snapshot that other players receive and can choose to adopt. Previous versions remain available locally until explicitly removed.

---

## User Stories

- **As a player**, I want to add notes to a pattern I already locked in without losing what I recorded so that I can build up a part incrementally.
- **As a player**, I want to record a second take of a pattern and have other players automatically receive the update so that we're all playing the latest version.
- **As a player receiving an overdub**, I want to choose whether to switch to the updated pattern or keep playing the original so that I stay in control of my own mix.
- **As a player**, I want to see a version indicator on patterns so that I know when I'm playing v1 vs. v2 of someone's part.

---

## UI/UX

### Pattern List Item — Owner View
When a player views their own locked-in pattern:
```
[ piano  v1 ]  [ ▶ Playing ]  [ Overdub ]  [ ✕ ]
```
- **Overdub** button appears only for patterns you created (`own: true`).
- Clicking Overdub opens the pattern for re-recording: the existing notes are shown on the track (dimmed) and you record new notes on top using the same keys.
- SPACE locks in the overdub, producing v2. The v1 notes + new notes are merged. (Or: v2 replaces v1 entirely — see Open Questions.)
- The button label changes to `Cancel Overdub` while recording.

### Pattern List Item — Remote Player View
When a remote player's pattern is updated:
```
[ piano  v2  ↑ Update available ]  [ ▶ Playing ]  [ ✕ ]
```
- A small **↑ Update available** indicator appears when a new version of a pattern you have queued arrives.
- Player can click it to swap to v2, or ignore it and keep playing v1.
- The update does not auto-apply to avoid disrupting playback mid-loop.

### Track Canvas
- During overdub recording, the canvas shows existing (v1) notes in a muted color and newly recorded notes in the full accent color.

---

## State Changes

### Pattern object (`game/Pattern.js`)
```js
this.version = 1;           // increments on each overdub publish
this.overridesId = null;    // id of the pattern this replaces (null for v1)
```

### Practice component state
- `overdubPatternId: string | null` — the ID of the pattern currently being overdubbed. Separate from `editingPatternId` since the visual treatment differs (shows existing notes).
- Pattern list items gain `version: number` in the React state shape.

### Pattern list items (React state)
```js
{
  id, inst, lockedIn, queued, notes, editing, creator,
  version: 1,          // new
  overridesId: null,   // new — null for original patterns
  updateAvailable: false,  // new — true when a newer version arrived
  pendingNotes: [],    // new — notes from the incoming newer version (buffered until player accepts)
}
```

---

## New Content / Assets

No new files or assets. The existing `Pattern.fromJSON` / note serialization handles reconstruction of any version.

---

## Network Protocol Changes

### Modified: `on_pattern_publish` payload
```js
// Before
{ pattern_id, inst, isDrum, bars, tempo, instSet, notes, creator }

// After (overdub adds two optional fields)
{
  pattern_id,   // the NEW pattern id (v2 gets a new id)
  inst, isDrum, bars, tempo, instSet, notes, creator,
  version: 2,                   // new — version number
  overrides_id: 'original-id',  // new — id of the pattern this supersedes (null if v1)
}
```

### Handling `on_pattern_publish` with `overrides_id` (client)
When a player receives a publish with `overrides_id` set:
1. Look up whether they have a pattern with that id locally.
2. If yes and it's currently queued: set `updateAvailable = true` on that pattern item, store the new pattern data in `pendingNotes`. Do NOT replace automatically.
3. If yes and not queued: replace immediately (silent update).
4. If no (they never received v1): treat as a new pattern and add normally.

### New event: `on_pattern_update_accept` (client-side only, no server involvement)
Not a network event — purely local. When the player clicks "↑ Update available", the client swaps the queued pattern for the new one locally. No broadcast needed.

---

## Open Questions
- **Merge vs. replace**: Should overdub v2 contain *only* the new notes (additive layer) or v1 notes + new notes merged? Additive allows reverting to v1 by playing both; merged is simpler and produces a single clean snapshot. Recommendation: **merged** — the overdub recording session starts with v1 notes pre-loaded, player records on top, result is v1+new locked in as v2.
- **Who can overdub**: Only the original creator? Or any player (collaborative overdub)? Recommendation: original creator only for v1 — prevents conflicts. Collaborative overdub could be a later addition.
- **Version limits**: Should there be a cap (e.g. v5 max) to prevent runaway version chains? Not strictly necessary but worth considering for UX.
- **Update notification timing**: Should update notifications apply immediately on the next loop boundary, or only on the current loop end? Loop-boundary swap is cleaner musically.
