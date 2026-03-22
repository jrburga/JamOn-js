# Feature: Mobile-Friendly Design

## Overview
Redesign the app's layout and interaction model to work on phones and tablets. The track canvas dominates the screen and responds to touch input (tap to play, hold to sustain, multi-touch for chords). A fixed dock bar surfaces the most critical controls; a slide-up panel provides access to everything else. The main track view can switch between **Edit mode** (your own track, interactive) and **Spectator mode** (another player's track, read-only, greyscaled). Desktop layout is preserved through responsive breakpoints.

---

## User Stories

- **As a mobile player**, I want to tap and hold a lane on the track to play a note so that I can perform without a keyboard.
- **As a mobile player**, I want to touch multiple lanes at the same time to play chords so that I have the same expressiveness as a keyboard player.
- **As a mobile player**, I want the track to fill most of my screen so that I have large, accurate touch targets for each lane.
- **As a mobile player**, I want a lock-in button always within thumb's reach so that I can commit a recording without hunting for a control.
- **As a mobile player**, I want secondary controls (pattern list, other players) accessible from a panel so that they don't clutter my playing space.
- **As a mobile player**, I want to create a new pattern from a single tap so that I can start recording without navigating menus.
- **As a mobile player**, I want to watch another player's track in the main view so that I can see what they're recording without leaving the practice scene.
- **As a mobile player watching another player**, I want it to be visually obvious I'm in spectator mode and can't play so that I don't accidentally think my taps are being recorded.
- **As a host on mobile**, I want to configure the instrument set and start the session from a clear, stacked layout so that I can manage the room from my phone.

---

## Breakpoints

Three layout tiers driven by a single CSS custom property and two media query breakpoints:

| Width | Layout | Description |
|---|---|---|
| `≥ 1024px` | Desktop | Sidebar + main track area (current layout, unchanged) |
| `768px – 1023px` | Tablet / Landscape phone | Landscape sidebar variant (160px right panel, shorter track) |
| `< 768px` | Mobile portrait | Full-width track, dock bar, slide-up panel |

```css
/* Tablet landscape */
@media (max-width: 1023px) {
  /* landscape sidebar variant */
}

/* Mobile portrait */
@media (max-width: 767px) {
  /* dock + panel layout */
}
```

---

## Control Access Hierarchy

| Tier | Controls | Location |
|---|---|---|
| **1 — Always on screen** | Lane touch targets, Lock In button (while recording) | Track canvas + dock |
| **2 — One tap (dock)** | New pattern, Queue/dequeue, Cancel recording, Back to your track (spectator) | Dock bar |
| **3 — Panel open** | Full pattern list, Player list (tap to spectate), Room code | Slide-up panel |
| **4 — Settings sheet** | Haptic feedback toggle, Leave room | Settings icon in header |

---

## Layout Diagrams

### Practice Scene — Portrait Phone (idle, edit mode)

```
┌────────────────────────┐  ← 375px wide (iPhone SE / 14)
│ [≡]  JamOn   AB12CD  │  ← Header 44px · room code right-aligned
├────────────────────────┤
│  ┊  ┊  ┊  ┊  ┊  ┊  ┊  ┊ │  ← Lane labels (note names, near bottom
│  ┊  ┊  ┊  ┊  ┊  ┊  ┊  ┊ │     of each column, drawn on top of gems)
│  ┊  ┊  ┊  ┊  ┊  ┊  ┊  ┊ │
│  ┊  ┊  ┊  ┊  ┊  ┊  ┊  ┊ │  ← Full-width track canvas
│  ─────────────────────  │  ← Now bar
│                         │
│  C3  D3  E3  F3  …  B3 │  ← Labels pinned to bottom of canvas,
│                         │     visible above all other elements
├────────────────────────┤
│  [+ New]  [    ]  [≡] │  ← Dock 72px
└────────────────────────┘
```

**Canvas height** = `100vh − 44px (header) − 72px (dock)` ≈ 560px on most phones.

**Dock — idle:**
- `[+ New]` — opens instrument picker sheet
- `[    ]` — empty (no active pattern)
- `[≡]` — opens slide-up panel

---

### Practice Scene — Portrait Phone (recording)

```
┌────────────────────────┐
│ [≡]  JamOn   AB12CD  │
├────────────────────────┤
│                        │
│   ● ──────  ●──        │  ← Live notes growing downward as held
│   ┊  ┊  ┊  ┊  ┊  ┊  ┊ │
│   ──────────────────── │  ← Now bar (green · active)
│                        │
│  C3  D3  E3  F3  …  B3│  ← Lane labels
├────────────────────────┤
│  [✕ Cancel] [🔴 Lock] [≡]│  ← Dock changes during recording
└────────────────────────┘
```

**Dock — recording:**
- `[✕ Cancel]` — discard pattern, return to idle
- `[🔴 Lock In]` — commit the recording (equivalent to SPACE)
- `[≡]` — panel (unchanged)

---

### Practice Scene — Portrait Phone (locked, queued)

```
┌────────────────────────┐
│ [≡]  JamOn   AB12CD  │
├────────────────────────┤
│                        │
│   ┊█┊  ┊  ┊█┊  ┊  ┊   │  ← Locked notes looping
│   ──────────────────── │  ← Now bar
│                        │
│  C3  D3  E3  F3  …  B3│
├────────────────────────┤
│  [+ New] [▶ Playing] [≡]│  ← Centre = queue toggle for latest pattern
└────────────────────────┘
```

**Dock — locked:**
- `[+ New]` — start another pattern
- `[▶ Playing]` / `[⏸ Queue]` — toggle playback of most-recently-locked pattern
- `[≡]` — panel

---

### Practice Scene — Slide-Up Panel (open)

The panel slides up from the bottom. The track is still visible above it (cropped). No scrolling — players tap a section to expand it.

```
┌────────────────────────┐
│ [≡]  JamOn   AB12CD  │
├────────────────────────┤
│   Track (cropped top)  │  ← ~180px of track remains visible
│                        │
├────────────┬───────────┤  ← Panel slides up to 60% of screen height
│       ━━━  │           │  ← Drag handle — swipe down to close
├────────────┴───────────┤
│ ▾ Patterns             │  ← Collapsible section
│  🎹 piano  v1   [▶][✕] │
│  🥁 drum   v1   [▶][✕] │
│                        │
│ ▾ Players              │  ← Collapsible section
│  ○ Bob      [👁 Watch]  │  ← Tap Watch → spectator mode (main view)
│  ○ Carol    [👁 Watch]  │
│                        │
├────────────────────────┤
│  [+ New] [▶ Playing] [≡↓]│  ← Dock always visible; ≡ becomes ↓
└────────────────────────┘
```

**Players section** shows a list, not mini-tracks. Tapping `[👁 Watch]` next to a player's name switches the main track view to spectator mode for that player. No scrolling in the panel — if the list grows long, sections are individually scrollable within their container.

---

### Practice Scene — Spectator Mode (watching another player)

When the player taps `[👁 Watch]` for Bob, the main track switches to Bob's track. The track is greyscaled, touch input is disabled, and the header changes to show who is being watched.

```
┌────────────────────────┐
│ [≡]  👁 Bob's track  │  ← Header: player name replaces room code
├────────────────────────┤
│                        │
│   (greyscale track)    │  ← Bob's notes, greyscaled
│   ┊░┊  ┊  ┊░┊  ┊  ┊   │     Touch input disabled
│   ──────────────────── │  ← Now bar (grey, not green)
│                        │
│  [— touch disabled —]  │  ← Subtle overlay label in the track
│                        │
├────────────────────────┤
│  [◀ Your Track]  [  ] [≡]│  ← Dock: left button = return to edit mode
└────────────────────────┘
```

**Visual cues for spectator mode:**
- Canvas rendered with `filter: grayscale(100%)` via a CSS wrapper, or by desaturating colours in the canvas draw calls
- A translucent overlay text "Watching · touch disabled" centred in the lower half of the track
- The now bar turns grey instead of green
- The header swaps room code for `👁 [name]'s track`
- Dock left button becomes `[◀ Your Track]` — one tap returns to edit mode

---

### Practice Scene — Tablet / Landscape Phone (768px–1023px)

```
┌──────────────────────────────────────┐
│ [≡] JamOn  AB12CD              [⚙] │  ← Header 40px
├─────────────────────────┬────────────┤
│                         │ Patterns   │  ← 160px sidebar
│   TRACK (full width,    │ ┌────────┐ │
│   shorter height)       │ │piano ▶✕│ │
│   ┊ ┊ ┊ ┊ ┊ ┊ ┊ ┊      │ │drum  ▶✕│ │
│   ─────────────────     │ └────────┘ │
│                         │            │
│  C3 D3 E3 F3 F#3 …      │ [+ New]    │
│                         │ [🔴 Lock]  │
│                         │            │
│                         │ Players:   │
│                         │ Bob  [👁]  │
│                         │ Carol [👁] │
└─────────────────────────┴────────────┘
```

---

### Waiting Room — Portrait Phone

```
┌────────────────────────┐
│ [←]  Waiting Room      │  ← Back button = leave room
├────────────────────────┤
│ Room: AB12CD  [📋 Copy]│  ← Tap to copy room code to clipboard
├────────────────────────┤
│ The Band               │
│  Rudolph   [You][Host] │
│  Dasher                │
├────────────────────────┤
│ Instruments (host only)│
│  ● ROCK                │  ← Stacked radio options (not side-by-side)
│  ○ ELECTRO             │
│  ○ JAZZ                │
├────────────────────────┤
│   [ Let's Jam! ]       │  ← Full-width CTA, sticky to bottom
└────────────────────────┘
         (non-host: "Waiting for host to start…" replaces CTA)
```

---

### Main Menu — Portrait Phone

```
┌────────────────────────┐
│                        │
│       JamOn!           │  ← clamp(40px, 12vw, 72px)
│  Play music together   │
│                        │
│  ┌──────────────────┐  │
│  │      HOST        │  │  ← Full-width, stacked vertically
│  │  Start a session │  │
│  └──────────────────┘  │
│  ┌──────────────────┐  │
│  │      JOIN        │  │
│  │  Enter room code │  │
│  └──────────────────┘  │
│                        │
│   ── Join form ──      │  ← Slides in below JOIN button on tap
│  ┌──────────────────┐  │
│  │   A B 1 2 C D    │  │  ← Full-width input, large font
│  └──────────────────┘  │
│  [ Join ]  [ Cancel ]  │
└────────────────────────┘
```

---

## Touch Interaction Model

### Lane Touch Input
Touch events replace keyboard events on mobile. The track canvas handles:

- **`touchstart`** → map `touch.clientX` to lane index → `noteOn(lane, time)`
- **`touchmove`** → if finger crosses a lane boundary → `noteOff(prevLane)`, `noteOn(newLane, time)`
- **`touchend`** / **`touchcancel`** → `noteOff(lane, time)` for that touch identifier

```js
laneIdx = Math.floor((touch.clientX - canvasRect.left) / (canvasWidth / numLanes))
```

Multi-touch is tracked by `touch.identifier`. Each active touch is stored in `activeTouches: Map<id, laneIdx>`. Releasing one finger doesn't affect other held notes.

### Note Sustain
Lifting a finger always releases the note — `touchend` and `touchcancel` both fire `noteOff`. If the player taps the dock mid-phrase, the canvas `touchcancel` fires for any held touches, releasing them cleanly before the dock tap registers.

### Preventing Scroll
`event.preventDefault()` is called on all canvas touch events. The listener must be registered with `{ passive: false }` since passive listeners cannot call `preventDefault`.

No horizontal or vertical scrolling anywhere in the practice scene during play. The panel drawer is the only scrollable region, and only when explicitly opened — it is not in the touch path of the track.

### Touch Target Sizing
- 375px phone, 8 lanes: ~47px per lane ✓ (≥ 44px minimum)
- 320px phone, 8 lanes: ~40px per lane — acceptable, lane dividers are visible

### Slide-Up Panel Gesture
- Swipe up from the dock bar (or tap `[≡]`) → panel opens
- Swipe down on the drag handle (or tap `[≡↓]`) → panel closes
- Panel snaps to 60% screen height; draggable to full-screen (100vh − header)

### Spectator Mode
When in spectator mode, all `touchstart` / `touchmove` / `touchend` events on the canvas are ignored (no `noteOn` / `noteOff` calls). The canvas touch handler checks a `spectating` flag before processing. Tapping anywhere on the track in spectator mode does nothing.

---

## Lane Labels

Lane note names (e.g. `C3`, `D#3`) are drawn directly onto the track canvas, always visible on mobile. They are drawn **last** in the canvas render pipeline so they sit on top of all notes, grid lines, and the now bar.

**Position:** Horizontally centred within each lane column. Vertically pinned near the bottom of the canvas (`y = canvasHeight − 18px`).

**Style:** 10px monospace, semi-transparent white (`rgba(255,255,255,0.55)`), so they read against both light and dark note colours without dominating.

**On desktop:** Not shown by default (lanes are narrow and keyboard shortcuts are the primary interface). Shown only when scale locking is active (when note names are meaningful).

**On mobile:** Always shown, since touch players need to know what pitch each lane plays.

**Canvas draw order (updated):**
1. Lane backgrounds (alternating dark)
2. Lane dividers
3. Beat grid lines
4. Past-notes fade overlay
5. Note gems (coloured rectangles)
6. Now bar
7. Player label ("YOU" or spectator indicator)
8. **Lane note-name labels** ← drawn last, always on top

---

## Haptic Feedback

Tapping a lane can trigger a short vibration via `navigator.vibrate()`. This is **off by default** since audio feedback is already present and vibration drains battery.

**Setting:** In the settings sheet (header `[⚙]` icon), a haptic feedback control:
```
Haptic Feedback
  ○ Off (default)
  ○ Medium  (8ms pulse on note-on)
  ○ Strong  (15ms pulse on note-on)
```

**Implementation:**
```js
function triggerHaptic(intensity) {
  if (!navigator.vibrate) return;
  if (intensity === 'medium') navigator.vibrate(8);
  if (intensity === 'strong') navigator.vibrate(15);
}
```

Called in `noteOn` only (not `noteOff`). Stored in `localStorage` so it persists across sessions. Falls back silently on browsers that don't support `navigator.vibrate` (iOS Safari).

---

## State Changes

### `Practice.jsx`
```js
panelOpen: boolean              // slide-up panel visibility
instrumentPickerOpen: boolean   // instrument picker sheet visibility
spectatingPlayerId: string|null // null = edit mode, else = watching this player
```

### Refs
```js
activeTouches: useRef(new Map()) // Map<touchId, laneIdx> for multi-touch tracking
```

### `App.jsx` (or shared hook)
```js
isMobile: boolean  // window.innerWidth < 768, updated on resize
```

### `localStorage`
```
jamon_haptic: 'off' | 'medium' | 'strong'  // persisted haptic preference
```

---

## New Components

### `Dock.jsx`
Fixed 72px bottom bar. Props: `mode` (`'idle' | 'recording' | 'locked' | 'spectating'`), callbacks for each action.

| Mode | Left | Centre | Right |
|---|---|---|---|
| `idle` | `[+ New]` | — | `[≡]` |
| `recording` | `[✕ Cancel]` | `[🔴 Lock In]` | `[≡]` |
| `locked` | `[+ New]` | `[▶/⏸ queue]` | `[≡]` |
| `spectating` | `[◀ Your Track]` | — | `[≡]` |

### `PanelDrawer.jsx`
Slide-up sheet. Two collapsible sections:
- **Patterns** — list with queue/delete per item
- **Players** — list with `[👁 Watch]` per remote player; tapping calls `onSpectate(playerId)`

Animated with `transform: translateY` + `transition: transform 0.25s ease`.

### `InstrumentPickerSheet.jsx`
Bottom sheet with a 2×N grid of instrument buttons. Tapping one calls `onCreate(instName)` and dismisses the sheet.

### `SpectatorOverlay.jsx`
A translucent div absolutely positioned over the track canvas in spectator mode. Contains the "Watching · touch disabled" text. Intercepts and discards touch events via `pointer-events: none` on the canvas + `pointer-events: all` on this overlay (so taps don't fall through to the canvas).

---

## Implementation Notes

### CSS Breakpoints (`index.css`)
```css
/* ── Tablet / landscape phone ─────────────────────── */
@media (max-width: 1023px) {
  .practice-layout { gap: 12px; }
  .pattern-panel { width: 160px; min-width: 160px; }
}

/* ── Mobile portrait ──────────────────────────────── */
@media (max-width: 767px) {
  .practice-layout { flex-direction: column; }
  .pattern-panel   { display: none; }     /* replaced by PanelDrawer */
  .track-area      { flex: 1; }
  .tracks          { overflow: visible; } /* single track, no scroll */
}
```

### Dynamic Canvas Sizing (`Track.jsx`)
`TRACK_W` and `TRACK_H` become props. A `ResizeObserver` on the wrapper `div` updates them:
```js
// Track.jsx
useEffect(() => {
  const ro = new ResizeObserver(([entry]) => {
    setCanvasW(entry.contentRect.width);
    setCanvasH(entry.contentRect.height);
  });
  ro.observe(wrapperRef.current);
  return () => ro.disconnect();
}, []);
```
Lane width recalculates as `canvasW / numLanes` on every render.

### Touch Handlers (`Practice.jsx` + `Track.jsx`)
`Track.jsx` exposes props: `onTouchStart`, `onTouchMove`, `onTouchEnd`. In `Practice.jsx`:
```js
function handleTrackTouchStart(e) {
  e.preventDefault();
  if (spectatingPlayerId) return;   // spectator: ignore
  if (Tone.context.state !== 'running') {
    Tone.start().then(() => setAudioActive(true));
    return;
  }
  for (const t of e.changedTouches) {
    const lane = laneFromTouch(t);
    activeTouches.current.set(t.identifier, lane);
    noteOn(lane);
  }
}
```

### Greyscale for Spectator Mode
Applied via a CSS class on the track wrapper, not in canvas draw code — keeps the render path simple:
```css
.track-wrapper.spectating canvas {
  filter: grayscale(1);
  opacity: 0.7;
}
```

### Landscape / Orientation Handling
```js
useEffect(() => {
  const handler = () => setIsMobile(window.innerWidth < 768);
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}, []);
```
CSS handles the actual layout shift; `isMobile` is used to conditionally render `Dock` vs. nothing.

---

## Files to Create / Modify

| File | Change |
|---|---|
| `client/src/components/Dock.jsx` | New — context-aware bottom action bar |
| `client/src/components/PanelDrawer.jsx` | New — slide-up panel with patterns + players |
| `client/src/components/InstrumentPickerSheet.jsx` | New — bottom sheet instrument grid |
| `client/src/components/SpectatorOverlay.jsx` | New — greyscale overlay + touch block |
| `client/src/components/Track.jsx` | Touch event props, dynamic canvas sizing (ResizeObserver), lane label rendering |
| `client/src/scenes/Practice.jsx` | Mobile layout branch, touch handlers, dock/panel/spectator state |
| `client/src/scenes/WaitingRoom.jsx` | Stacked layout, full-width CTA, radio instrument picker |
| `client/src/scenes/MainMenu.jsx` | Stacked buttons, full-width join input |
| `client/src/index.css` | Two responsive breakpoints, spectating styles, dock/panel/sheet styles |
| `client/index.html` | Viewport meta already present — no change needed |

---

## Resolved Design Decisions

| Question | Decision |
|---|---|
| Tablet breakpoint | Desktop ≥ 1024px · landscape sidebar 768–1023px · mobile portrait < 768px |
| Haptic feedback | Off by default · optional Strong / Medium / Off in settings sheet · persisted to `localStorage` |
| Note sustain on finger lift | `touchend` and `touchcancel` always fire `noteOff` — notes never hang |
| Lane labels | Always visible on mobile · drawn last in canvas pipeline (on top of all elements) · centred at bottom of each lane column · 10px semi-transparent monospace |
| Other players' tracks | No mini-tracks or scrolling in panel · Players section shows a list with `[👁 Watch]` per player · tapping Watch switches the **main track view** to spectator mode for that player · spectator view is greyscaled, touch-disabled, and labelled clearly · one tap on `[◀ Your Track]` in the dock returns to edit mode |
