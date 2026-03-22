# Feature: Mobile-Friendly Design

## Overview
Redesign the app's layout and interaction model to work on phones and tablets. The track canvas dominates the screen and responds to touch input (tap to play, hold to sustain, multi-touch for chords). A fixed dock bar surfaces the most critical controls; a slide-up panel provides access to everything else. Desktop layout is preserved through a responsive breakpoint.

---

## User Stories

- **As a mobile player**, I want to tap and hold a lane on the track to play a note so that I can perform without a keyboard.
- **As a mobile player**, I want to touch multiple lanes at the same time to play chords so that I have the same expressiveness as a keyboard player.
- **As a mobile player**, I want the track to fill most of my screen so that I have large, accurate touch targets for each lane.
- **As a mobile player**, I want a lock-in button always within thumb's reach so that I can commit a recording without hunting for a control.
- **As a mobile player**, I want secondary controls (pattern list, other players' tracks) accessible from a panel so that they don't clutter my playing space.
- **As a mobile player**, I want to create a new pattern from a single tap so that I can start recording without navigating menus.
- **As a host on mobile**, I want to configure the instrument set and start the session from a clear, stacked layout so that I can manage the room from my phone.

---

## Control Access Hierarchy

Controls are ranked by how often they're needed during a jam. Higher tiers are always visible; lower tiers live behind one tap.

| Tier | Controls | Location |
|---|---|---|
| **1 — Always on screen** | Lock In (SPACE), Lane touch targets | Track canvas + dock |
| **2 — One tap** | New pattern (instrument picker), Queue/dequeue current pattern, Delete current pattern | Dock bar |
| **3 — Panel open** | Full pattern list, Other players' mini-tracks, Room code | Slide-up panel |
| **4 — Settings sheet** | Leave room, Audio hint | Settings icon in header |

---

## Layout Diagrams

### Practice Scene — Portrait Phone (default, idle)

```
┌────────────────────────┐  ← 375px wide (iPhone SE/14)
│ [≡]  JamOn   AB12CD  │  ← Header: 44px, room code right-aligned
├────────────────────────┤
│                        │
│   YOUR TRACK           │  ← Full-width canvas
│   (8 lanes, full width)│     height = 100vh - 44px header
│                        │               - 72px dock
│   ┆ ┆ ┆ ┆ ┆ ┆ ┆ ┆    │     ≈ 560px on a 676px-tall phone
│   ┆ ┆ ┆ ┆ ┆ ┆ ┆ ┆    │
│   ┆ ┆ ┆ ┆ ┆ ┆ ┆ ┆    │
│   ─────────────────    │  ← Now bar (horizontal)
│   (past notes below)   │
│                        │
├────────────────────────┤
│  [+ New]  [    ]  [≡] │  ← Dock: 72px
└────────────────────────┘
       ↑          ↑
   Instrument   Panel
    Picker       Open
```

**Dock slots (left to right):**
- `[+ New]` — opens instrument picker sheet
- `[    ]` — context-sensitive center button (empty when idle)
- `[≡]` — opens slide-up panel

---

### Practice Scene — Portrait Phone (while recording)

```
┌────────────────────────┐
│ [≡]  JamOn   AB12CD  │
├────────────────────────┤
│                        │
│   YOUR TRACK           │
│   (recording active)   │
│   ┆ ┆ ┆ ┆ ┆ ┆ ┆ ┆    │
│   ●───────────── ●─    │  ← live notes appearing as you hold
│   ─────────────────    │  ← now bar (green/active)
│                        │
├────────────────────────┤
│  [✕ Cancel] [🔴 Lock] [≡]│  ← Dock changes while recording
└────────────────────────┘
              ↑
        Lock In (was SPACE)
```

**Dock while recording:**
- `[✕ Cancel]` — discard this pattern, return to idle
- `[🔴 Lock In]` — lock the pattern (prominent, red accent)
- `[≡]` — panel (same)

---

### Practice Scene — Portrait Phone (pattern locked, queued)

```
┌────────────────────────┐
│ [≡]  JamOn   AB12CD  │
├────────────────────────┤
│                        │
│   YOUR TRACK           │
│   (piano • playing ▶)  │
│   ┆█┆ ┆ ┆█┆ ┆ ┆ ┆    │  ← locked-in notes shown
│   ─────────────────    │
│                        │
├────────────────────────┤
│  [+ New] [▶ Playing] [≡]│  ← Center btn = queue toggle
└────────────────────────┘
```

**Dock after lock-in:**
- `[+ New]` — start another pattern
- `[▶ Playing]` / `[⏸ Queue]` — toggle playback of the most recently locked pattern
- `[≡]` — panel

---

### Practice Scene — Slide-Up Panel (open)

The panel slides up from the bottom, overlapping the lower portion of the track. A drag handle at the top lets it be dismissed by swiping down.

```
┌────────────────────────┐
│ [≡]  JamOn   AB12CD  │
├────────────────────────┤
│   YOUR TRACK (cropped) │  ← Track still visible at top (~200px)
│                        │
├──────────────┬─────────┤  ← Panel snap point (60% of screen height)
│       ━━━━━  │         │  ← Drag handle (swipe down to close)
├──────────────┴─────────┤
│ Patterns               │  ← Section header
│ ┌──────────────────┐   │
│ │ 🎹 piano  v1  ▶ ✕│   │  ← Pattern items (tap to select/dequeue)
│ │ 🥁 drum   v1  ▶ ✕│   │
│ └──────────────────┘   │
│                        │
│ Players                │  ← Section header
│ ┌─────────┐ ┌────────┐ │
│ │Bob      │ │Carol   │ │  ← Mini track thumbnails (read-only)
│ │[mini trk│ │[mini   │ │     ~120×80px each
│ └─────────┘ └────────┘ │
├────────────────────────┤
│  [+ New] [▶ Playing] [≡ ↓]│  ← Dock still visible, ≡ rotates to ↓
└────────────────────────┘
```

---

### Practice Scene — Instrument Picker Sheet (on "+ New" tap)

A bottom sheet slides up with instrument options:

```
┌────────────────────────┐
│   (track, dimmed)      │
│                        │
├────────────────────────┤
│         ━━━━━          │  ← drag handle
│  Choose Instrument     │
│                        │
│  ┌──────┐  ┌──────┐   │
│  │  🎹  │  │  🎸  │   │
│  │ piano│  │guitar│   │
│  └──────┘  └──────┘   │
│  ┌──────┐  ┌──────┐   │
│  │  🎵  │  │  🥁  │   │
│  │ bass │  │ drum │   │
│  └──────┘  └──────┘   │
│                        │
│       [ Cancel ]       │
└────────────────────────┘
```

---

### Phone Landscape — Practice Scene

In landscape, more horizontal space is available. The track stays full-width but shorter; a narrow sidebar replaces the dock.

```
┌──────────────────────────────────────┐  ~667×375px
│ [≡] JamOn  AB12CD              [⚙] │  ← Header (40px)
├─────────────────────────┬────────────┤
│                         │ Patterns   │
│   YOUR TRACK            │ ┌────────┐ │
│   (full width, shorter) │ │piano ▶✕│ │
│   ┆ ┆ ┆ ┆ ┆ ┆ ┆ ┆      │ │drum  ▶✕│ │
│   ─────────────────     │ └────────┘ │
│                         │            │
│                         │[+ New]     │
│                         │[🔴 Lock In]│
└─────────────────────────┴────────────┘
```

Landscape sidebar is 160px wide — same controls as the dock but stacked vertically.

---

### Waiting Room — Portrait Phone

```
┌────────────────────────┐
│ [←]  Waiting Room      │  ← Header (back = leave room)
├────────────────────────┤
│ Room: AB12CD  📋       │  ← Room code + copy button
├────────────────────────┤
│ The Band               │
│ ┌──────────────────┐   │
│ │ Rudolph  [You] [Host]│
│ │ Dasher         │
│ └──────────────────┘   │
├────────────────────────┤
│ Instruments  (host only)│
│ ● ROCK   ○ ELECTRO  ○ JAZZ│  ← Segmented control or radio
├────────────────────────┤
│    [ Let's Jam! ]      │  ← Full-width CTA (host only)
└────────────────────────┘
       (non-host sees "Waiting for host…" instead of CTA)
```

---

### Main Menu — Portrait Phone

```
┌────────────────────────┐
│                        │
│      JamOn!            │  ← Title (smaller clamp, ~56px)
│   Play music together  │
│                        │
│  ┌──────────────────┐  │
│  │      HOST        │  │  ← Full-width button, stacked
│  │  Start a session │  │
│  └──────────────────┘  │
│  ┌──────────────────┐  │
│  │      JOIN        │  │  ← Full-width button
│  │  Enter room code │  │
│  └──────────────────┘  │
│                        │
│  ┌──────────────────┐  │  ← Join form (revealed on JOIN tap)
│  │  A B 1 2 C D     │  │
│  │  [Join] [Cancel] │  │
│  └──────────────────┘  │
└────────────────────────┘
```

---

## Touch Interaction Model

### Lane Touch Input (Track Canvas)
Touch events replace keyboard events on mobile. The track canvas receives:

- **`touchstart`** → identify lane(s) from `touch.clientX` position → `noteOn(lane, time)`
- **`touchmove`** → detect if finger slid to a different lane → `noteOff(oldLane)`, `noteOn(newLane)`
- **`touchend`** / **`touchcancel`** → `noteOff(lane, time)` for each released touch

Lane index from touch: `laneIdx = Math.floor((touch.clientX - trackRect.left) / laneWidth)`

Multi-touch: each `Touch` object in `event.changedTouches` is tracked independently by `touch.identifier`. This allows chords (multiple lanes held simultaneously).

### Preventing Scroll Conflicts
The track canvas calls `event.preventDefault()` on touch events to prevent the page from scrolling while playing. This requires the touch listener to be registered with `{ passive: false }`.

### Touch Target Sizing
On a 375px-wide phone with 8 lanes: each lane is ~47px wide. This meets the 44px minimum recommended touch target size. On narrower phones (320px): ~40px per lane — acceptable since users see the lane boundaries.

### Gesture: Slide-Up Panel
- Swipe up from the dock bar to open the panel
- Swipe down (or tap `↓`) to close it
- Panel snaps to 60% screen height by default; draggable to full-screen
- Implemented via CSS `transform: translateY` + touch drag tracking

### Gesture: Lock In
Tapping the `[🔴 Lock In]` dock button = pressing SPACE. No gesture shortcut for lock-in (avoids accidental commits).

---

## State Changes

### New: `isMobile` detection
```js
// In App.jsx or a hook
const isMobile = window.innerWidth < 768 || 'ontouchstart' in window;
```
Or use a CSS media query approach with a `useMediaQuery` hook. Controls which layout renders.

### New: `panelOpen: boolean` in Practice component state
Controls the slide-up panel visibility.

### New: `instrumentPickerOpen: boolean` in Practice component state
Controls the instrument picker bottom sheet.

### New: `activeTouches: Map<identifier, laneIdx>` ref in Practice
Tracks which touch points correspond to which lanes. Needed for multi-touch note management.

---

## New Components

### `Dock.jsx`
Fixed bottom bar (72px). Accepts `mode` prop:
- `'idle'` — `[+ New]` | `[ ]` | `[≡]`
- `'recording'` — `[✕ Cancel]` | `[🔴 Lock In]` | `[≡]`
- `'locked'` — `[+ New]` | `[▶ Playing / ⏸ Queue]` | `[≡]`

### `PanelDrawer.jsx`
Slide-up panel with:
- Drag handle
- Pattern list section (queue/delete controls per item)
- Players section (mini track thumbnails)
- Animated via CSS `transform: translateY` + `transition`

### `InstrumentPickerSheet.jsx`
Bottom sheet grid of instrument buttons. Animated same as PanelDrawer.

### `MiniTrack.jsx`
Read-only thumbnail of a remote player's track (~120×80px). Simplified rendering: just note rectangles, no labels.

---

## Implementation Notes

### CSS Breakpoints
Single breakpoint added to `index.css`:
```css
/* Mobile: < 768px */
@media (max-width: 767px) {
  .practice-layout { flex-direction: column; }
  .pattern-panel { display: none; }   /* replaced by PanelDrawer */
  .tracks { flex-direction: column; } /* stacked full-width tracks */
}
```

### Track Canvas Resize
`Track.jsx` currently uses hardcoded `TRACK_W = 200`, `TRACK_H = 560`. On mobile:
- `TRACK_W` = `window.innerWidth` (passed as prop)
- `TRACK_H` = `window.innerHeight - HEADER_H - DOCK_H`
- A `ResizeObserver` on the wrapper div keeps the canvas sized to its container
- Lane width recalculated as `canvasWidth / numLanes`

### Touch Events on Canvas
`Track.jsx` gains three touch handler props: `onTouchStart`, `onTouchMove`, `onTouchEnd`. In `Practice.jsx`, these compute the lane index and call the same `noteOn`/`noteOff` logic as keyboard handlers.

### Tone.js Audio Gate on Mobile
`Tone.start()` is triggered on the first `touchstart` event (user gesture) rather than the first keypress. The `createPattern` tap on the dock also serves as a valid gesture. The `audio-hint` banner displays until audio is active.

### Landscape Detection
A `useEffect` listens to `window.addEventListener('orientationchange')` or `resize` to switch between portrait (dock) and landscape (sidebar) layouts.

---

## Files to Create / Modify

| File | Change |
|---|---|
| `client/src/components/Dock.jsx` | New — fixed bottom action bar |
| `client/src/components/PanelDrawer.jsx` | New — slide-up panel |
| `client/src/components/InstrumentPickerSheet.jsx` | New — bottom sheet instrument grid |
| `client/src/components/MiniTrack.jsx` | New — read-only thumbnail track |
| `client/src/components/Track.jsx` | Add touch events, dynamic canvas sizing via props |
| `client/src/scenes/Practice.jsx` | Mobile layout branch, touch handlers, dock/panel state |
| `client/src/scenes/WaitingRoom.jsx` | Stacked layout on mobile |
| `client/src/scenes/MainMenu.jsx` | Stacked buttons, full-width join input |
| `client/src/index.css` | Add `@media (max-width: 767px)` responsive rules |
| `client/index.html` | Confirm viewport meta (already present) |

---

## Open Questions

- **Landscape on tablet (iPad)**: Should the tablet get the desktop layout (sidebar) or the mobile layout (dock + panel)? Recommendation: use the desktop layout above 1024px width; mobile layout between 1024px and 768px gets the landscape sidebar variant.
- **Haptic feedback**: Should tapping a lane trigger vibration (`navigator.vibrate(10)`)? Adds tactile feel for note-on. Opt-in or on by default?
- **Note sustain on mobile**: If the player lifts their finger to navigate the dock mid-recording, should held notes be released? Yes — `touchcancel` and `touchend` always release. Players need to finish their phrase before tapping the dock.
- **Visual lane labels on mobile**: Should the 8 lane columns show note name labels (e.g. `C3`) on the canvas, especially when scale locking is active? Useful for learning; could be toggled in settings.
- **Scrolling between players' tracks**: In the panel, if there are 4+ players, should the mini-track section scroll horizontally or vertically? Horizontal scrolling feels more natural for a multi-player band display.
