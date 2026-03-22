# Mobile-Friendly Design — Task Tracker

Reference: [`mobile-design.md`](./mobile-design.md)

## Legend

| Column | Values |
|---|---|
| **Feature** | Top-level area |
| **Sub-feature** | Component or concern within that area |
| **Depends on** | Task IDs that must be complete first |
| **Testing** | `Auto` = unit/integration test, `Manual` = device/browser QA, `Both` |
| **Complexity** | `Low` / `Med` / `High` |
| **Break down?** | Whether this task should be split into subtasks before starting |
| **Status** | `Todo` / `In Progress` / `Done` |

---

## Architecture Decision

`Practice.jsx` is split into three files:

```
usePractice.js          ← game engine hook (input-agnostic)
                           owns: game loop, audio, network, pattern state
                           exposes: noteOn(lane), noteOff(lane), lockIn(),
                                    createPattern(inst), removePattern(id),
                                    queuePattern(id), activateAudio()

PracticeDesktop.jsx     ← desktop layout, consumes usePractice
                           owns: keysDown ref, keydown/keyup handlers

PracticeMobile.jsx      ← mobile layout, consumes usePractice
                           owns: activeTouches ref, touch handlers,
                                 panelOpen, instrumentPickerOpen,
                                 spectatorTarget

Practice.jsx            ← thin wrapper, picks layout based on breakpoint
```

UI-only state (`panelOpen`, `instrumentPickerOpen`, `spectatorTarget`) stays in
`PracticeMobile` because it has no effect on game logic and would be dead weight
in the hook when the desktop layout is active. `keysDown` and `activeTouches` are
input-layer refs — each layout owns the one relevant to it.

---

## Phase 1 — Foundation

No dependencies. Unblocks everything else.

| ID | Task | Feature | Sub-feature | Depends on | Testing | Complexity | Break down? | Status |
|---|---|---|---|---|---|---|---|---|
| T01 | Add `useMediaQuery` hook to `hooks/useMediaQuery.js` — returns `{ isMobile, isTablet, isLandscape }` based on window width and orientation | Mobile | Foundation | — | Auto | Low | No | Todo |
| T02 | Add responsive CSS breakpoints to `index.css`: `≥1024px` desktop unchanged, `768–1023px` tablet-mobile, `<768px` phone | Mobile | Foundation | — | Manual | Low | No | Todo |
| T03 | Make `Track.jsx` canvas dimensions dynamic — accept `width`/`height` props (fall back to current constants when absent), add `ResizeObserver` on wrapper div, recalculate `laneWidth` from canvas width | Mobile | Track Canvas | — | Both | Med | No | Todo |

---

## Phase 2 — New Components

Self-contained. Can be built and tested in isolation before any wiring.

| ID | Task | Feature | Sub-feature | Depends on | Testing | Complexity | Break down? | Status |
|---|---|---|---|---|---|---|---|---|
| T04 | Create `Dock.jsx` — fixed 72px bottom bar; accepts `mode` prop (`idle` / `recording` / `locked`) and action callbacks; three-slot layout per design doc | Mobile | Dock | T01 | Both | Med | No | Todo |
| T05 | Create `PanelDrawer.jsx` shell — slide-up panel with drag handle, `translateY` CSS animation, snaps to 60% screen height, swipe-down or tap `↓` to close | Mobile | Panel | T01 | Manual | Med | No | Todo |
| T06 | Add pattern list section to `PanelDrawer` — same queue/delete controls as existing `pattern-panel`; receives `patterns`, `onQueue`, `onDelete` props | Mobile | Panel | T05 | Manual | Low | No | Todo |
| T07 | Create `MiniTrack.jsx` — read-only canvas thumbnail (~120×80px); same `notes`/`now`/`seconds` props as `Track.jsx`; renders note rectangles only, no labels | Mobile | Mini Track | T03 | Both | Med | No | Todo |
| T08 | Add players section to `PanelDrawer` — renders a `MiniTrack` per remote player; tapping a thumbnail fires `onSpectate(playerId)` callback | Mobile | Panel | T05, T07 | Manual | Low | No | Todo |
| T09 | Create `InstrumentPickerSheet.jsx` — bottom sheet instrument grid; same open/close animation as `PanelDrawer`; fires `onSelect(instName)` and `onCancel` | Mobile | Instrument Picker | T01 | Manual | Low | No | Todo |
| T10 | Create `TrackLaneOverlay.jsx` — `pointer-events: none` div absolutely positioned over canvas wrapper; renders note-name labels (e.g. `C3`) centered per lane near the bottom; renders track ownership banner near the top | Mobile | Track Canvas | T03 | Manual | Med | No | Todo |

---

## Phase 3 — Practice Refactor

**Do this before any mobile wiring.** Splits `Practice.jsx` into `usePractice` +
`PracticeDesktop` + thin wrapper. Desktop behavior must remain identical after
this phase — it is a pure refactor.

| ID | Task | Feature | Sub-feature | Depends on | Testing | Complexity | Break down? | Status |
|---|---|---|---|---|---|---|---|---|
| T15a | Extract `usePractice({ client, bandMembers, instSet })` hook — move game loop, audio init, pattern state, network handlers, and `reducer` out of `Practice.jsx`; expose `{ state, sessionReady, audioActive, players, seconds, noteOn, noteOff, lockIn, createPattern, removePattern, queuePattern, activateAudio }` | Mobile | Practice Refactor | — | Both | **High** | No | Todo |
| T15b | Create `PracticeDesktop.jsx` — consumes `usePractice`; moves `keysDown` ref and `handleKeyDown`/`handleKeyUp` here; JSX is the current `Practice` render verbatim; desktop smoke test must pass | Mobile | Practice Refactor | T15a | Both | Med | No | Todo |
| T15c | Reduce `Practice.jsx` to a thin layout-picker wrapper — renders `<PracticeDesktop>` unconditionally for now; `<PracticeMobile>` is a stub that returns `<div>Mobile coming soon</div>`; all existing tests must still pass | Mobile | Practice Refactor | T15b, T01 | Both | Low | No | Todo |

---

## Phase 4 — Touch Input

Adds touch event plumbing to `Track.jsx` and implements handlers in
`PracticeMobile.jsx`. Depends on Phase 3 because handlers call `noteOn`/`noteOff`
from `usePractice`.

| ID | Task | Feature | Sub-feature | Depends on | Testing | Complexity | Break down? | Status |
|---|---|---|---|---|---|---|---|---|
| T11 | Add `onTouchStart`, `onTouchMove`, `onTouchEnd` props to `Track.jsx`; register listeners with `{ passive: false }` and call `event.preventDefault()` to block scroll | Mobile | Track Canvas | T03 | Both | Med | No | Todo |
| T12 | Add `activeTouches` ref (`Map<identifier, laneIdx>`) to `PracticeMobile.jsx`; implement `handleTouchStart`/`Move`/`End` that compute lane index from `touch.clientX` and call `noteOn`/`noteOff` from `usePractice` | Mobile | Practice Wiring | T11, T15c | Both | Med | No | Todo |
| T13 | Handle multi-touch chords in `PracticeMobile` — each `Touch` in `changedTouches` tracked by `touch.identifier`; `touchmove` detects lane slide and calls `noteOff(oldLane)` / `noteOn(newLane)` | Mobile | Practice Wiring | T12 | Both | Med | No | Todo |
| T14 | Mobile audio gate in `PracticeMobile` — call `activateAudio()` from `usePractice` on first `touchstart`; dock "+ New" tap also counts; mirrors existing keypress gate in `PracticeDesktop` | Mobile | Practice Wiring | T12 | Manual | Low | No | Todo |

---

## Phase 5 — Mobile Layout Wiring

Builds out `PracticeMobile.jsx` from the stub into the full mobile UI.
Work here is sequential — each step depends on the previous.

| ID | Task | Feature | Sub-feature | Depends on | Testing | Complexity | Break down? | Status |
|---|---|---|---|---|---|---|---|---|
| T15d | Full-width canvas in `PracticeMobile` — wrap `Track` in a measured div; use `ResizeObserver` to pass live `width`/`height` as props; derive height from `(100vh - HEADER_H - DOCK_H)` | Mobile | Practice Wiring | T15c, T03 | Manual | Med | No | Todo |
| T15e | Mount `Dock` in `PracticeMobile` — derive `mode` from `editingPatternId` and `lockedIn` state; connect `onNew`, `onLockIn`, `onCancel`, `onToggleQueue`, `onOpenPanel` callbacks to `usePractice` actions | Mobile | Practice Wiring | T15d, T04 | Manual | Med | No | Todo |
| T15f | Mount `TrackLaneOverlay` in `PracticeMobile` — wrap canvas + overlay in a shared `position: relative` div; pass lane count, note names, and ownership props | Mobile | Practice Wiring | T15d, T10 | Manual | Low | No | Todo |
| T16 | Add `panelOpen` and `instrumentPickerOpen` state to `PracticeMobile`; wire open/close to `Dock`, `PanelDrawer`, and `InstrumentPickerSheet`; instrument selection calls `createPattern` from `usePractice` | Mobile | Practice Wiring | T15e, T05, T09 | Manual | Low | No | Todo |
| T17 | Wire pattern actions from `PanelDrawer` — `onQueue` and `onDelete` props call `queuePattern`/`removePattern` from `usePractice`; pattern list in panel stays in sync with hook state | Mobile | Practice Wiring | T16, T06 | Both | Low | No | Todo |
| T18 | Landscape detection in `PracticeMobile` — `useEffect` on `resize`/`orientationchange`; when landscape AND `768–1023px`, swap dock for 160px sidebar variant; canvas height recalculates without dock offset | Mobile | Landscape | T15e | Manual | Med | No | Todo |

---

## Phase 6 — Spectator Mode

Lets a player view another player's track in the main canvas.

| ID | Task | Feature | Sub-feature | Depends on | Testing | Complexity | Break down? | Status |
|---|---|---|---|---|---|---|---|---|
| T19 | Add `spectatorTarget` state to `PracticeMobile` (`null` = own track, `playerId` = spectating); `onSpectate(id)` from `PanelDrawer` sets it; closing panel returns to own track | Mobile | Spectator Mode | T16, T08 | Manual | Med | No | Todo |
| T20 | Pass spectator props to `TrackLaneOverlay` — show `"Your Track"` or `"👁 Watching [name]'s track"` banner; muted style when spectating | Mobile | Spectator Mode | T19, T10 | Manual | Low | No | Todo |
| T21 | Apply spectator visual treatment to `Track` canvas — greyscale filter + `pointer-events: none` when `spectatorTarget` is set; feed the remote player's notes and `activeNotes` into the canvas instead of local state | Mobile | Spectator Mode | T19, T11 | Manual | Med | No | Todo |

---

## Phase 7 — Navigation Scenes

Simpler responsive updates. No dependency on Phase 3–6.

| ID | Task | Feature | Sub-feature | Depends on | Testing | Complexity | Break down? | Status |
|---|---|---|---|---|---|---|---|---|
| T22 | `MainMenu.jsx` mobile layout — stack HOST/JOIN buttons full-width, clamp title font, reveal join input inline on JOIN tap | Mobile | Navigation | T01, T02 | Manual | Low | No | Todo |
| T23 | `WaitingRoom.jsx` mobile layout — stacked player list, full-width CTA, room code row with copy button, instrument segmented control | Mobile | Navigation | T01, T02 | Manual | Low | No | Todo |

---

## Phase 8 — Haptic Feedback

Opt-in enhancement. Lowest priority; no blockers on other phases.

| ID | Task | Feature | Sub-feature | Depends on | Testing | Complexity | Break down? | Status |
|---|---|---|---|---|---|---|---|---|
| T24 | Add haptic preference to `localStorage` — key `haptic`, values `off` (default) / `medium` / `strong`; expose three-way toggle in settings sheet (Tier 4) | Mobile | Haptic | — | Manual | Low | No | Todo |
| T25 | Call `navigator.vibrate()` in `usePractice` `noteOn` when on mobile and setting is not `off`; pulse durations: medium = 10ms, strong = 25ms; guard with feature-detect | Mobile | Haptic | T24, T12 | Manual | Low | No | Todo |

---

## Summary

| Phase | Tasks | New Files | Modified / Deleted Files |
|---|---|---|---|
| 1 — Foundation | T01–T03 | `hooks/useMediaQuery.js` | `index.css`, `Track.jsx` |
| 2 — New Components | T04–T10 | `Dock.jsx`, `PanelDrawer.jsx`, `MiniTrack.jsx`, `InstrumentPickerSheet.jsx`, `TrackLaneOverlay.jsx` | — |
| 3 — Practice Refactor | T15a–c | `usePractice.js`, `PracticeDesktop.jsx` | `Practice.jsx` (gutted to wrapper) |
| 4 — Touch Input | T11–T14 | — | `Track.jsx`, `PracticeMobile.jsx` |
| 5 — Mobile Layout | T15d–f, T16–T18 | — | `PracticeMobile.jsx` |
| 6 — Spectator Mode | T19–T21 | — | `PracticeMobile.jsx`, `TrackLaneOverlay.jsx`, `Track.jsx` |
| 7 — Navigation | T22–T23 | — | `MainMenu.jsx`, `WaitingRoom.jsx` |
| 8 — Haptic | T24–T25 | — | `usePractice.js` |
| **Total** | **27 tasks** | **7 new files** | **7 modified files** |
