# Test Plan: Refactor + Mobile Feature

Related docs: [`refactor-practice.md`](./refactor-practice.md) · [`mobile-tasks.md`](./mobile-tasks.md)

## Test Stack

- **Framework**: Vitest + jsdom
- **Component testing**: `@testing-library/react` (to be added)
- **Tone.js**: globally mocked in `src/test/setup.js`
- **Canvas**: jsdom does not execute canvas draw calls; canvas tests verify
  dimensions and that draw methods are called, not pixel output

---

## Existing Coverage (summary)

| File | Coverage | Notes |
|---|---|---|
| `Quantizer.js` | Good | All quantization paths covered including edge cases |
| `Pattern.js` | Good | Note, Pattern, PatternList; drum mode; toJSON/fromJSON |
| `Instrument.js` | Good | midiToNote, INSTRUMENT_SETS, Instrument, InstrumentManager |
| `Client.js` | Good | connect, CRUD, sendAction, onAction, multi-listener |
| `Practice.jsx` | **None** | Reducer, game loop, pattern actions — entirely untested |
| `Track.jsx` | **None** | Canvas sizing, laneWidth, draw logic — entirely untested |
| All new components | **None** | Don't exist yet |

---

## Pre-existing Gaps (fixable now, independent of any new work)

These tests cover code that already exists and should be written regardless of
the refactor or mobile feature.

### Gap 1 — Practice reducer

The `reducer` function in `Practice.jsx` is a pure function. It has no side
effects and no imports. It can be tested right now by importing it directly.
This is the highest-value gap: the reducer is the authoritative description of
what state changes are legal, and it currently has zero test coverage.

**File**: `src/scenes/__tests__/practiceReducer.test.js` (or moved to
`src/hooks/__tests__/usePractice.test.js` after T-R01a)

| Test | What it verifies |
|---|---|
| `SET_NOW` updates `now` | Basic clock tick |
| `ADD_PATTERN` with `own: true` sets `editingPatternId` to new pattern's id | Recording starts on own pattern |
| `ADD_PATTERN` with `own: false` does not change `editingPatternId` | Remote patterns don't hijack recording |
| `UPDATE_PATTERN` only mutates the matched id, others unchanged | Isolation between patterns |
| `REMOVE_PATTERN` for the current `editingPatternId` → sets `editingPatternId` to `null` | Deleting your own in-progress pattern |
| `REMOVE_PATTERN` for a non-editing pattern → `editingPatternId` unchanged | Deleting someone else's pattern |
| `NOTE_DOWN` adds lane to `activeNotes` | Note on |
| `NOTE_UP` removes lane from `activeNotes` | Note off |
| `NOTE_UP` for a lane not in `activeNotes` → state unchanged, no crash | Defensive: release without press |
| `ADD_VPLAYER` deduplicates by `id` | Re-joining player doesn't duplicate |
| `UPDATE_VPLAYER` only mutates the matched id | Isolation between vplayers |
| Unknown action type → returns state unchanged | Reducer default case |

### Gap 2 — `time2y` and lane index calculation in Track

`time2y` and the laneWidth calculation in `Track.jsx` are pure math used both
for rendering and (once T11 lands) for touch hit-testing. Worth extracting and
testing in isolation before mobile work begins.

**File**: `src/components/__tests__/Track.test.js`

| Test | What it verifies |
|---|---|
| `time2y(0, seconds, H)` returns `H` (time=0 is at the bottom) | Coordinate origin |
| `time2y(seconds, seconds, H)` returns `0` (full phrase = top) | Coordinate ceiling |
| `time2y` is linear between 0 and H | No curvature bugs |
| `laneWidth = W / numLanes` gives correct value for 8 lanes at 375px | Mobile target size |
| `laneWidth` for 8 lanes at 375px is ≥ 44px | Meets touch target minimum |

---

## Refactor Tests (T-R01a → T-R03)

### T-R01a — Reducer moved to `usePractice.js`

The Gap 1 tests above are written here (or migrated if written earlier).
The only change from Gap 1: the import path updates from `Practice.jsx` to
`hooks/usePractice.js`.

### T-R01b — `usePractice` hook

The hook wraps stateful logic and async behaviour. Test with
`@testing-library/react`'s `renderHook`.

**File**: `src/hooks/__tests__/usePractice.test.js`

| Test | What it verifies |
|---|---|
| `sessionReady` starts `false`, becomes `true` after async init resolves | Init lifecycle |
| `audioActive` starts `false`; `activateAudio()` calls `Tone.start()` and sets it `true` | Audio gate |
| `createPattern(instName)` dispatches `ADD_PATTERN` and sets `editingPatternId` | Pattern creation |
| `createPattern` is a no-op when `sessionReady` is `false` | Guard condition |
| `noteOn(lane)` dispatches `NOTE_DOWN` and calls `instRef.noteOn` | Note recording |
| `noteOff(lane)` dispatches `NOTE_UP` and calls `instRef.noteOff` | Note release |
| `lockIn()` calls `pat.lockIn()`, dispatches `UPDATE_PATTERN`, sends `on_pattern_publish` via client | Lock-in action |
| `lockIn()` is a no-op when no `editingPatternId` | Guard condition |
| `removePattern(id)` dispatches `REMOVE_PATTERN` and calls `imRef.releaseAll` | Pattern deletion |
| `queuePattern(id)` toggles `queued` and calls `releaseAll` on dequeue | Queue toggle |
| `on_player_join` network action adds player to `players` without duplicates | Network: join |
| `on_pattern_publish` from another player adds pattern to state | Network: remote pattern |
| `on_pattern_publish` from own `client.id` is ignored | Network: own publish filter |

> **Note on `stateRef`**: the hook uses `stateRef.current = state` so the rAF
> loop reads current state without re-subscribing. Tests should verify that
> `noteOn`/`noteOff` called from within a setTimeout/rAF tick read the
> latest state, not a stale closure.

### T-R02 — PracticeDesktop smoke test

**File**: `src/scenes/__tests__/PracticeDesktop.test.jsx`

| Test | What it verifies |
|---|---|
| Renders without throwing when `usePractice` returns `sessionReady: false` | Mount safety |
| Renders the pattern list and instrument buttons when `sessionReady: true` | Desktop layout intact |
| Keydown `'a'` calls `noteOn(0)` from the hook | Keyboard → hook wiring |
| Keydown `' '` (SPACE) calls `lockIn()` from the hook | Lock-in key wiring |
| Keyup `'a'` calls `noteOff(0)` from the hook | Key release wiring |
| Same key held (repeat event) does not call `noteOn` twice | `keysDown` dedup |

### T-R03 — Practice.jsx thin wrapper

**File**: update `PracticeDesktop.test.jsx` or separate smoke test

| Test | What it verifies |
|---|---|
| `<Practice>` renders `<PracticeDesktop>` at `width ≥ 1024px` | Layout routing — desktop |
| `<Practice>` renders `<PracticeMobile>` stub at `width < 1024px` | Layout routing — mobile |

---

## Mobile Feature Tests

### T01 — `useMediaQuery` hook

**File**: `src/hooks/__tests__/useMediaQuery.test.js`

| Test | What it verifies |
|---|---|
| `isMobile: true` when `window.innerWidth = 767` | Below phone breakpoint |
| `isMobile: true` when `window.innerWidth = 1023` | Tablet-mobile range |
| `isMobile: false` when `window.innerWidth = 1024` | At desktop breakpoint |
| `isLandscape: true` when width > height | Orientation detection |
| `isLandscape: false` when height > width | Portrait detection |
| Hook returns updated values after a simulated `resize` event | Reactivity |

### T03 — Dynamic `Track` canvas sizing

Add to `src/components/__tests__/Track.test.js`

| Test | What it verifies |
|---|---|
| Canvas `width` attribute matches `width` prop | Prop → canvas size |
| Canvas `height` attribute matches `height` prop | Prop → canvas size |
| Falls back to constant `TRACK_W`/`TRACK_H` when props are absent | Backwards-compat for desktop |
| `ResizeObserver` callback updates canvas dimensions | Responsive resize |

### T04 — `Dock.jsx`

**File**: `src/components/__tests__/Dock.test.jsx`

| Test | What it verifies |
|---|---|
| `mode='idle'` renders `[+ New]` and panel button; center slot is empty | Idle state |
| `mode='recording'` renders `[✕ Cancel]` and `[🔴 Lock In]` | Recording state |
| `mode='locked'` renders `[+ New]` and `[▶ Playing]` / `[⏸ Queue]` | Locked state |
| Clicking `[+ New]` calls `onNew` | Callback wiring |
| Clicking `[🔴 Lock In]` calls `onLockIn` | Callback wiring |
| Clicking `[✕ Cancel]` calls `onCancel` | Callback wiring |
| Clicking panel button calls `onOpenPanel` | Callback wiring |

### T07 — `MiniTrack.jsx`

**File**: `src/components/__tests__/MiniTrack.test.jsx`

| Test | What it verifies |
|---|---|
| Renders a `<canvas>` with correct `width` and `height` props | Dimensions |
| Does not throw when `notes` is empty | Empty state |
| Does not throw when `notes` contains completed notes | Normal state |

### T11 — Touch props on `Track.jsx`

Add to `src/components/__tests__/Track.test.jsx`

| Test | What it verifies |
|---|---|
| `touchstart` on canvas calls `onTouchStart` with the event | Prop wiring |
| `touchmove` on canvas calls `onTouchMove` with the event | Prop wiring |
| `touchend` on canvas calls `onTouchEnd` with the event | Prop wiring |
| Touch listener registered with `{ passive: false }` | Scroll prevention |

### T12 / T13 — Touch handler logic in `PracticeMobile`

These test the pure calculation and state-tracking logic; they do not require
a full render.

**File**: `src/scenes/__tests__/touchHandlers.test.js`
(exports the handler functions for isolated testing, or tests via `renderHook`)

| Test | What it verifies |
|---|---|
| `laneIdx = Math.floor((clientX - left) / laneWidth)` for various positions | Lane hit calculation |
| `clientX` at left edge → lane 0 | Boundary |
| `clientX` at right edge → lane 7 | Boundary |
| `touchstart` on lane 2 → `noteOn(2)` called, `activeTouches.set(id, 2)` | Touch begin |
| Second `touchstart` on lane 5 (different id) → `noteOn(5)` called | Multi-touch chord |
| `touchend` for id → `noteOff(lane)` called, id removed from `activeTouches` | Touch release |
| `touchcancel` for id → `noteOff` called, same as `touchend` | Cancel = release |
| `touchmove` to a different lane → `noteOff(oldLane)`, `noteOn(newLane)` | Slide between lanes |
| `touchmove` within same lane → no extra calls | No spurious events |
| `touchend` for id not in `activeTouches` → no crash | Defensive |

### T14 — Mobile audio gate

Add to `usePractice` tests or `PracticeMobile` tests

| Test | What it verifies |
|---|---|
| First `touchstart` when `Tone.context.state !== 'running'` calls `activateAudio()` | Touch audio gate |
| Subsequent touches after audio is active do not call `Tone.start` again | No double-init |

### T17 — Pattern actions from `PanelDrawer`

Add to `src/scenes/__tests__/PracticeMobile.test.jsx`

| Test | What it verifies |
|---|---|
| Tapping queue button in panel calls `queuePattern(id)` from hook | Panel → hook wiring |
| Tapping delete button in panel calls `removePattern(id)` from hook | Panel → hook wiring |
| Pattern list in panel reflects `state.patterns` from hook | State sync |

### T19 — Spectator mode state

Add to `src/scenes/__tests__/PracticeMobile.test.jsx`

| Test | What it verifies |
|---|---|
| `spectatorTarget` starts as `null` | Own track by default |
| Tapping a `MiniTrack` sets `spectatorTarget` to that player's id | Spectate action |
| Closing the panel resets `spectatorTarget` to `null` | Exit spectator |
| When `spectatorTarget` is set, remote player's notes are passed to Track | Correct data source |
| When `spectatorTarget` is set, local `noteOn`/`noteOff` are not called on canvas touch | Touch disabled |

### T24 / T25 — Haptic feedback

**File**: `src/hooks/__tests__/useHaptic.test.js` (or inline in `usePractice` tests)

| Test | What it verifies |
|---|---|
| Default value read from `localStorage` is `'off'` when key absent | Default state |
| Setting `'medium'` writes `'medium'` to `localStorage` | Persistence |
| `noteOn` with setting `'off'` does not call `navigator.vibrate` | Off by default |
| `noteOn` with setting `'medium'` calls `navigator.vibrate(10)` | Medium pulse |
| `noteOn` with setting `'strong'` calls `navigator.vibrate(25)` | Strong pulse |
| `navigator.vibrate` absent → no crash | Feature-detect guard |

---

## Tests That Are Intentionally Manual Only

Some behaviours cannot be meaningfully tested in jsdom and require a real device
or browser DevTools device emulation:

| Behaviour | Why manual |
|---|---|
| Canvas visual output (note gems, now bar, lane colours) | jsdom canvas has no pixel API |
| `ResizeObserver` firing on actual window resize | jsdom ResizeObserver is a stub |
| `navigator.vibrate` physical haptic response | Hardware-only |
| Tone.js audio output (correct pitch, timing) | Web Audio not available in jsdom |
| Landscape/portrait layout switch on device rotation | `orientationchange` unreliable in jsdom |
| 44px touch target feel on a real phone | Subjective / hardware |
| PanelDrawer swipe animation smoothness | CSS animation not rendered in jsdom |

---

## Test File Map

| File | New or Existing | Covers |
|---|---|---|
| `src/scenes/__tests__/practiceReducer.test.js` | **New** (can be written now) | Gap 1 — reducer |
| `src/components/__tests__/Track.test.js` | **New** (can be written now) | Gap 2 — time2y, laneWidth; later T03, T11 |
| `src/hooks/__tests__/usePractice.test.js` | New — after T-R01a | T-R01a, T-R01b |
| `src/scenes/__tests__/PracticeDesktop.test.jsx` | New — after T-R02 | T-R02, T-R03 |
| `src/hooks/__tests__/useMediaQuery.test.js` | New — T01 | T01 |
| `src/components/__tests__/Dock.test.jsx` | New — T04 | T04 |
| `src/components/__tests__/MiniTrack.test.jsx` | New — T07 | T07 |
| `src/scenes/__tests__/touchHandlers.test.js` | New — T12/T13 | T12, T13, T14 |
| `src/scenes/__tests__/PracticeMobile.test.jsx` | New — T15d+ | T17, T19 |
| `src/hooks/__tests__/useHaptic.test.js` | New — T24/T25 | T24, T25 |
