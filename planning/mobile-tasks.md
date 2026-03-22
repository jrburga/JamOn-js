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

## Phase 1 — Foundation

These tasks have no dependencies and unblock everything else. Do these first.

| ID | Task | Feature | Sub-feature | Depends on | Testing | Complexity | Break down? | Status |
|---|---|---|---|---|---|---|---|---|
| T01 | Add `useMediaQuery` hook (or `isMobile` boolean) to detect `width < 1024px` and `ontouchstart` | Mobile | Foundation | — | Auto | Low | No | Todo |
| T02 | Add responsive CSS breakpoints to `index.css`: `≥1024px` desktop, `768–1023px` tablet-mobile, `<768px` phone | Mobile | Foundation | — | Manual | Low | No | Todo |
| T03 | Make `Track.jsx` canvas dimensions dynamic — accept `width`/`height` props, add `ResizeObserver` on wrapper div, recalculate `laneWidth` | Mobile | Track Canvas | — | Both | Med | No | Todo |

---

## Phase 2 — New Components

Self-contained components that can be built and tested in isolation.

| ID | Task | Feature | Sub-feature | Depends on | Testing | Complexity | Break down? | Status |
|---|---|---|---|---|---|---|---|---|
| T04 | Create `Dock.jsx` — fixed 72px bottom bar with three slot layout; accepts `mode` prop (`idle` / `recording` / `locked`) and action callbacks | Mobile | Dock | T01 | Both | Med | No | Todo |
| T05 | Create `PanelDrawer.jsx` — slide-up panel shell with drag handle, `translateY` animation, snap to 60% height, swipe-down-to-close | Mobile | Panel | T01 | Manual | Med | No | Todo |
| T06 | Add pattern list section to `PanelDrawer` — mirrors existing `pattern-panel` list with queue/delete controls | Mobile | Panel | T05 | Manual | Low | No | Todo |
| T07 | Create `MiniTrack.jsx` — read-only canvas thumbnail (~120×80px); renders note rectangles only; accepts same `notes`/`now`/`seconds` props as `Track.jsx` | Mobile | Mini Track | T03 | Both | Med | No | Todo |
| T08 | Add players section to `PanelDrawer` — renders a `MiniTrack` per remote player; tapping a mini-track triggers spectator mode callback | Mobile | Panel | T05, T07 | Manual | Low | No | Todo |
| T09 | Create `InstrumentPickerSheet.jsx` — bottom sheet with instrument grid; same animation pattern as `PanelDrawer`; fires `onSelect(instName)` and `onCancel` | Mobile | Instrument Picker | T01 | Manual | Low | No | Todo |
| T10 | Create `TrackLaneOverlay.jsx` — `pointer-events: none` absolutely-positioned div over canvas; renders note-name labels centered per lane near the bottom; renders track ownership banner at top | Mobile | Track Canvas | T03 | Manual | Med | No | Todo |

---

## Phase 3 — Touch Input

Wires touch events into the existing `noteOn`/`noteOff` logic.

| ID | Task | Feature | Sub-feature | Depends on | Testing | Complexity | Break down? | Status |
|---|---|---|---|---|---|---|---|---|
| T11 | Add `onTouchStart`, `onTouchMove`, `onTouchEnd` props to `Track.jsx`; call `event.preventDefault()` with `{ passive: false }` to block scroll | Mobile | Track Canvas | T03 | Both | Med | No | Todo |
| T12 | Add `activeTouches` ref (`Map<identifier, laneIdx>`) to `Practice.jsx`; implement touch handler functions that compute lane index from `clientX` and call the existing `noteOn`/`noteOff` reducers | Mobile | Practice Wiring | T11 | Both | Med | No | Todo |
| T13 | Handle multi-touch chords — each `Touch` in `changedTouches` tracked independently by `touch.identifier`; `touchmove` detects lane slide and calls `noteOff(old)` / `noteOn(new)` | Mobile | Practice Wiring | T12 | Both | Med | No | Todo |
| T14 | Mobile audio gate — call `Tone.start()` on first `touchstart` (parallel to existing keypress gate); dock "+ New" tap also counts as a valid gesture | Mobile | Practice Wiring | T12 | Manual | Low | No | Todo |

---

## Phase 4 — Practice Scene Layout

Wires all new components into `Practice.jsx` under the mobile layout branch.

| ID | Task | Feature | Sub-feature | Depends on | Testing | Complexity | Break down? | Status |
|---|---|---|---|---|---|---|---|---|
| T15 | Add mobile layout branch to `Practice.jsx` — `isMobile` check; render `Dock` + `TrackLaneOverlay` wrapper instead of `pattern-panel` sidebar; full-width `Track` canvas | Mobile | Practice Wiring | T01, T02, T03, T04, T10 | Manual | **High** | **Yes** | Todo |
| T16 | Add `panelOpen` and `instrumentPickerOpen` state to `Practice.jsx`; wire open/close callbacks to `Dock`, `PanelDrawer`, and `InstrumentPickerSheet` | Mobile | Practice Wiring | T15, T05, T09 | Manual | Low | No | Todo |
| T17 | Wire pattern actions from `PanelDrawer` — queue/dequeue and delete from panel list must call same `queuePattern` / `removePattern` functions | Mobile | Practice Wiring | T16, T06 | Both | Low | No | Todo |
| T18 | Landscape detection in `Practice.jsx` — `useEffect` on `resize`/`orientationchange`; when landscape AND `768–1023px` width, render 160px sidebar variant instead of bottom dock | Mobile | Landscape | T15 | Manual | Med | No | Todo |

---

## Phase 5 — Spectator Mode

Allows a player to view another player's track in the main canvas.

| ID | Task | Feature | Sub-feature | Depends on | Testing | Complexity | Break down? | Status |
|---|---|---|---|---|---|---|---|---|
| T19 | Add `spectatorTarget` state to `Practice.jsx` (`null` = own track, `playerId` = spectating); tapping a `MiniTrack` in the panel sets this | Mobile | Spectator Mode | T16, T08 | Manual | Med | No | Todo |
| T20 | Pass spectator data to `TrackLaneOverlay` — show `"Your Track"` vs `"👁 Watching [name]'s track"` banner based on `spectatorTarget` | Mobile | Spectator Mode | T19, T10 | Manual | Low | No | Todo |
| T21 | Apply greyscale + `pointer-events: none` to `Track` canvas when in spectator mode; feed the remote player's notes into the canvas | Mobile | Spectator Mode | T19, T11 | Manual | Med | No | Todo |

---

## Phase 6 — Navigation Scenes

Simpler responsive updates to existing scenes.

| ID | Task | Feature | Sub-feature | Depends on | Testing | Complexity | Break down? | Status |
|---|---|---|---|---|---|---|---|---|
| T22 | `MainMenu.jsx` mobile layout — stack HOST/JOIN buttons full-width, clamp title font size, reveal join input inline on tap | Mobile | Navigation | T01, T02 | Manual | Low | No | Todo |
| T23 | `WaitingRoom.jsx` mobile layout — stacked player list, full-width CTA, room code row with copy button, instrument segmented control | Mobile | Navigation | T01, T02 | Manual | Low | No | Todo |

---

## Phase 7 — Haptic Feedback

Opt-in enhancement; lowest priority.

| ID | Task | Feature | Sub-feature | Depends on | Testing | Complexity | Break down? | Status |
|---|---|---|---|---|---|---|---|---|
| T24 | Add haptic setting to user preferences — `localStorage` key `haptic` with values `off` (default) / `medium` / `strong`; expose three-way toggle in settings sheet (Tier 4) | Mobile | Haptic | — | Manual | Low | No | Todo |
| T25 | Call `navigator.vibrate()` on `noteOn` when on mobile and setting is not `off`; pulse durations: medium = 10ms, strong = 25ms; guard with `typeof navigator.vibrate === 'function'` | Mobile | Haptic | T24, T12 | Manual | Low | No | Todo |

---

## Task T15 Subtask Breakdown

T15 is flagged **High complexity / needs breakdown**. Suggested subtasks:

| ID | Subtask | Depends on |
|---|---|---|
| T15a | Extract a `useMobileLayout` hook that returns `{ isMobile, isLandscape, layoutMode }` | T01 |
| T15b | Wrap `Practice` render in a layout branch: `isMobile ? <MobilePractice> : <DesktopPractice>` (or conditional JSX blocks) | T15a |
| T15c | Implement full-width `Track` canvas sizing — pass `window.innerWidth` and `(vh - HEADER_H - DOCK_H)` as props | T15b, T03 |
| T15d | Mount `Dock` in mobile branch with correct `mode` derived from current recording state | T15b, T04 |
| T15e | Mount `TrackLaneOverlay` wrapper around the canvas | T15b, T10 |
| T15f | QA pass: portrait phone (375px), portrait tablet (768px), landscape phone (667px), landscape tablet (1024px) | T15c–e, T18 |

---

## Summary

| Phase | Tasks | New Files | Modified Files |
|---|---|---|---|
| 1 — Foundation | T01–T03 | `hooks/useMediaQuery.js` | `index.css`, `Track.jsx` |
| 2 — New Components | T04–T10 | `Dock.jsx`, `PanelDrawer.jsx`, `MiniTrack.jsx`, `InstrumentPickerSheet.jsx`, `TrackLaneOverlay.jsx` | — |
| 3 — Touch Input | T11–T14 | — | `Track.jsx`, `Practice.jsx` |
| 4 — Practice Layout | T15–T18 | — | `Practice.jsx` |
| 5 — Spectator Mode | T19–T21 | — | `Practice.jsx`, `TrackLaneOverlay.jsx`, `Track.jsx` |
| 6 — Navigation | T22–T23 | — | `MainMenu.jsx`, `WaitingRoom.jsx` |
| 7 — Haptic | T24–T25 | — | `Practice.jsx` (or new settings hook) |
| **Total** | **25 tasks** | **6 new files** | **6 modified files** | |
