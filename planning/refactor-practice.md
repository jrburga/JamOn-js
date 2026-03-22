# Refactor: Practice Scene — Separation of Concerns

## Problem

`Practice.jsx` is a 474-line monolith that conflates two distinct responsibilities:

1. **Game engine** — clock loop, audio (Tone.js), pattern state, network sync, note recording
2. **UI layout** — JSX structure, component composition, rendering decisions

This makes the file hard to reason about, hard to test, and hard to extend. Any new
layout (mobile, split-screen, spectator-only) requires forking all the game logic too.
The mobile feature work exposed this directly: adding a mobile layout branch without
this refactor would push `Practice.jsx` past ~700 lines with interleaved
desktop/mobile conditionals.

This refactor is valuable independent of the mobile feature.

---

## Goal State

```
usePractice.js          ← game engine hook — input-agnostic, layout-agnostic
                           owns: clock loop (rAF), Tone.js audio, PatternList,
                                 InstrumentManager, network handlers, reducer
                           exposes: { state, sessionReady, audioActive, players,
                                      seconds, noteOn, noteOff, lockIn,
                                      createPattern, removePattern, queuePattern,
                                      activateAudio }

PracticeDesktop.jsx     ← desktop layout — consumes usePractice
                           owns: keysDown ref, handleKeyDown/handleKeyUp,
                                 current JSX verbatim

Practice.jsx            ← thin wrapper — picks layout component, passes props
                           (currently always renders PracticeDesktop)
```

`PracticeMobile.jsx` is created separately as part of the mobile feature work
and also consumes `usePractice`. It is not part of this refactor.

---

## Why T-R01b Can't Be Broken Down Further

The session init, game loop, network handlers, and pattern actions all share the
same set of refs (`imRef`, `plRef`, `instRef`, `stateRef`, `startTimeRef`,
`secondsRef`, `rafRef`). The refs are the backbone — you can't move `createPattern`
without its refs, and you can't move the game loop without those same refs. Splitting
them across two files mid-migration would leave a worse intermediate state than
the starting point.

T-R01b is therefore a single large commit. The complexity is from volume and
required care, not from uncertainty about what to do. The pieces are all known and
bounded. T-R01a (moving the reducer first) removes the one genuinely independent
piece so T-R01b starts from a slightly smaller surface.

## What Makes T-R01b Risky

Extracting the hook is the highest-risk single task in this refactor. Specific things
to audit carefully:

- **`stateRef.current = state`** — this pattern lets the rAF loop read current state
  without being re-subscribed on every render. It must survive the move intact.
- **`client` as a parameter** — today it's a prop captured in closures; as a hook
  param it becomes a dependency of several `useEffect` calls. Audit all dependency
  arrays after the move.
- **Derived values** (`seconds`, `spb`, `tempo`) — currently computed inline in the
  component body. They move into the hook and must be returned or memoized correctly.
- **`imRef` / `plRef` / `instRef`** — these refs are created inside the component and
  passed into callbacks. They move into the hook; verify no external code holds stale
  references to them.

---

## Tasks

| ID | Task | Depends on | Testing | Complexity | Status |
|---|---|---|---|---|---|
| T-R01a | Move `reducer` + `initialState` into `hooks/usePractice.js` and re-import from `Practice.jsx` — pure function, no side effects, zero risk | — | Auto | Low | Todo |
| T-R01b | Complete `usePractice` hook — move all refs, derived values (`tempo`/`seconds`/etc.), session init, game loop, network handlers, and pattern actions into the hook; extract `lockIn()` as a standalone function (currently inline in `handleKeyDown`); extract `noteOn(lane)` / `noteOff(lane)` as the shared input interface; `Practice.jsx` consumes the hook | T-R01a | Both | High | No |
| T-R02 | Create `PracticeDesktop.jsx` — consumes `usePractice`; move `keysDown` ref and `handleKeyDown`/`handleKeyUp` here; JSX is the current `Practice` render verbatim; all existing behaviour must be identical | T-R01b | Both | Med | Todo |
| T-R03 | Reduce `Practice.jsx` to a thin wrapper — renders `<PracticeDesktop>` and passes props through; remove all game logic; all existing tests must still pass | T-R02 | Both | Low | Todo |

---

## Acceptance Criteria

- All existing automated tests pass without modification after T-R03.
- Desktop jam session is functionally identical: record, lock in, queue, multi-player sync.
- `Practice.jsx` contains no game logic — only layout-picking and prop forwarding.
- `usePractice.js` contains no JSX.
- `PracticeDesktop.jsx` contains no direct Tone.js or PatternList calls — only
  calls through the hook's returned interface.
- `lockIn()` is a named exported function from `usePractice`, not inline in any
  keyboard handler.
