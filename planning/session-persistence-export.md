# Feature: Session Persistence & Export

## Overview
Players can save a session snapshot (all locked-in patterns) to a JSON file and reload it in a future session. The host can also render the current mix to a `.wav` file entirely in the browser using the Web Audio API's `OfflineAudioContext`. No server-side storage is required for either feature.

---

## User Stories

- **As a host**, I want to save the session after a jam so that we can continue from where we left off next time without re-recording everything.
- **As a host**, I want to load a saved session in the WaitingRoom so that the patterns are available to everyone immediately when Practice starts.
- **As any player**, I want to export the current mix as an audio file so that I can share what we created.
- **As any player**, I want to choose which patterns are included in the export so that I get the mix I want rather than everything indiscriminately.
- **As a host**, I want saved sessions to include instrument set and scale settings so that the session is fully reproducible.

---

## UI/UX

### WaitingRoom — Host Controls
A **Session** section in the host panel:
```
[ 💾 Save Session ]   [ 📂 Load Session ]
```
- **Save Session**: downloads a `.jamon` file (JSON with a custom extension) of the current session configuration. In the WaitingRoom, this saves only the session settings (instSet, scale, phrase length). Saving from Practice saves the full pattern library.
- **Load Session**: opens a file picker. The host selects a `.jamon` file. Session settings are applied (instSet, scale, phrase length). Patterns in the file are offered to be published to the room when Practice starts (host can deselect individual patterns before loading).

### Practice — Export & Save Toolbar
A small toolbar at the top of the Practice scene:
```
[ 💾 Save ]   [ 🎧 Export Mix ]   [ room: AB12CD ]
```
- **Save**: downloads the current session as a `.jamon` file (all locked-in patterns + settings).
- **Export Mix**: opens an **Export Panel** overlay.

### Export Panel
```
┌─── Export Mix ──────────────────────────────────────────┐
│  Include in mix:                                        │
│  ☑ piano v1 (Alice)                                    │
│  ☑ bass v1 (Bob)                                       │
│  ☑ drum v1 (Alice)                                     │
│  ☐ guitar v2 (Bob)  ← unchecked, won't be in export   │
│                                                         │
│  Duration: ● 1 phrase (8 bars)   ○ 2 phrases  ○ 4...  │
│  Format:   ● WAV  ○ MP3 (not supported in all browsers)│
│                                                         │
│  [ Render & Download ]    [ Cancel ]                    │
└─────────────────────────────────────────────────────────┘
```
- Rendering happens client-side via `OfflineAudioContext`. A progress bar shows render progress.
- Only the local player's client renders (other players are not involved). Each player can export their own mix independently.

---

## State Changes

### Session Snapshot Format (`.jamon` file — JSON)
```json
{
  "version": 1,
  "savedAt": "2025-03-22T00:00:00Z",
  "session": {
    "instrumentSet": "ROCK",
    "scaleKey": "C",
    "scaleType": "minor_pentatonic",
    "phraseLength": 8,
    "tempo": 120
  },
  "patterns": [
    {
      "id": "alice_1234",
      "inst": "piano",
      "isDrum": false,
      "bars": 4,
      "tempo": 120,
      "instSet": "ROCK",
      "offsetBars": 0,
      "version": 1,
      "creator": { "username": "Alice" },
      "effects": { "reverb": { "wet": 0.3, "size": 0.5 }, "delay": { "wet": 0 }, "filter": { "cutoff": 1.0, "type": "lowpass" } },
      "notes": [
        { "lane": 0, "time": 0.0, "length": 0.25 },
        { "lane": 2, "time": 0.5, "length": 0.25 }
      ]
    }
  ]
}
```
This format uses `Pattern.toJSON()` (already exists) extended with `offsetBars`, `effects`, and `version`.

### Practice component state
- `exportPanelOpen: boolean`
- `exportSelectedIds: Set<string>` — which patterns are checked in the export panel.
- `renderProgress: number | null` — 0.0–1.0 during render, null otherwise.

---

## New Content / Assets

### `client/src/game/SessionIO.js` — new utility module
```js
// Serialize the current session to a .jamon JSON blob
export function exportSession(sessionMeta, patterns) { ... }

// Parse a .jamon file and validate its schema
export function importSession(jsonString) { ... }

// Trigger a browser file download
export function downloadFile(blob, filename) { ... }
```

### `client/src/game/AudioRenderer.js` — new utility module
```js
// Render the mix offline and return a WAV Blob
export async function renderMix(patterns, instSet, sessionMeta, onProgress) {
  const ctx = new OfflineAudioContext(2, sampleRate * durationSecs, sampleRate);
  // Re-create all synths/samplers in the offline context
  // Schedule all note events from each pattern's buildSequence()
  // ctx.startRendering() → AudioBuffer → encodeWAV()
  return wavBlob;
}
```
This is entirely client-side — no server involved.

---

## Network Protocol Changes

### New event: `on_session_load` (host → room)
When the host loads a `.jamon` file in WaitingRoom (or early in Practice), saved patterns can be published to the room so all players receive them:

```js
// Host publishes each saved pattern as if it were just locked in:
for (const patData of savedSession.patterns) {
  client.sendAction('on_pattern_publish', {
    ...patData,
    creator: client.info,  // attributed to host (original creator unavailable)
  });
}
```

No new event type needed — loaded patterns use the existing `on_pattern_publish` flow. Each player receives them and can queue them as normal.

### Server changes
None. Session files are downloaded to and uploaded from the client's file system. The server is not involved in persistence or rendering.

---

## Open Questions
- **Pattern attribution on load**: Loaded patterns show the host as creator (since the original player may not be present). Should the original creator's username be preserved in the file and displayed (read-only) even if they're not connected? Recommendation: yes — store `original_creator: { username }` in the JSON and display it in the pattern list as "piano by Alice (saved)".
- **OfflineAudioContext sample loading**: Drum samples must be re-fetched and decoded for the offline render context (they can't be shared with the live context). This adds latency to the render start. Show a "Loading samples…" state before the progress bar.
- **WAV encoding**: The Web Audio API's `OfflineAudioContext` produces an `AudioBuffer`, not a WAV file. A small WAV encoder (< 100 lines, no dependency) is needed to produce a downloadable blob. MP3 encoding in the browser requires a WASM codec (heavier — skip for now).
- **File size**: A 30-second 44.1kHz stereo WAV = ~10MB. Reasonable for a browser download. Consider a sample rate option (44.1kHz / 22kHz) to reduce size.
- **Auto-save**: Should the session auto-save periodically to `localStorage` so it survives accidental page refresh? Yes — this is a good safety net. Store the last-known session JSON in `localStorage` under a key like `jamon_autosave` and offer to restore it on next visit.
