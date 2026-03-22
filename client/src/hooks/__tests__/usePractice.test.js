/**
 * Tests for the practice reducer and usePractice hook.
 *
 * Covers: Gap 1 (reducer), T-R01a (reducer imported from usePractice),
 *         T-R01b (hook behaviour via renderHook).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { reducer, initialState, lockIn } from '../usePractice.js';
import usePractice from '../usePractice.js';

// ── Reducer tests ─────────────────────────────────────────────────────────────

describe('reducer', () => {
  it('SET_NOW updates now', () => {
    const s = reducer(initialState, { type: 'SET_NOW', now: 3.5 });
    expect(s.now).toBe(3.5);
    expect(s.patterns).toBe(initialState.patterns); // other fields untouched
  });

  it('ADD_PATTERN with own:true sets editingPatternId', () => {
    const pattern = { id: 'p1', inst: 'guitar', lockedIn: false, queued: false, notes: [] };
    const s = reducer(initialState, { type: 'ADD_PATTERN', pattern, own: true });
    expect(s.editingPatternId).toBe('p1');
    expect(s.patterns[0]).toBe(pattern);
  });

  it('ADD_PATTERN with own:false does not change editingPatternId', () => {
    const base = { ...initialState, editingPatternId: 'mine' };
    const pattern = { id: 'remote', inst: 'bass', lockedIn: true, queued: false, notes: [] };
    const s = reducer(base, { type: 'ADD_PATTERN', pattern, own: false });
    expect(s.editingPatternId).toBe('mine');
    expect(s.patterns[0]).toBe(pattern);
  });

  it('UPDATE_PATTERN only mutates the matched id', () => {
    const p1 = { id: 'p1', inst: 'guitar', lockedIn: false, queued: false, notes: [] };
    const p2 = { id: 'p2', inst: 'bass', lockedIn: false, queued: false, notes: [] };
    const base = { ...initialState, patterns: [p1, p2] };
    const s = reducer(base, { type: 'UPDATE_PATTERN', id: 'p1', updates: { lockedIn: true } });
    expect(s.patterns.find((p) => p.id === 'p1').lockedIn).toBe(true);
    expect(s.patterns.find((p) => p.id === 'p2')).toBe(p2); // unchanged reference
  });

  it('REMOVE_PATTERN for editingPatternId sets editingPatternId to null', () => {
    const p = { id: 'p1', inst: 'guitar', lockedIn: false, queued: false, notes: [] };
    const base = { ...initialState, patterns: [p], editingPatternId: 'p1' };
    const s = reducer(base, { type: 'REMOVE_PATTERN', id: 'p1' });
    expect(s.editingPatternId).toBeNull();
    expect(s.patterns).toHaveLength(0);
  });

  it('REMOVE_PATTERN for non-editing pattern leaves editingPatternId unchanged', () => {
    const p1 = { id: 'p1', inst: 'guitar', lockedIn: false, queued: false, notes: [] };
    const p2 = { id: 'p2', inst: 'bass', lockedIn: true, queued: false, notes: [] };
    const base = { ...initialState, patterns: [p1, p2], editingPatternId: 'p1' };
    const s = reducer(base, { type: 'REMOVE_PATTERN', id: 'p2' });
    expect(s.editingPatternId).toBe('p1');
    expect(s.patterns).toHaveLength(1);
  });

  it('NOTE_DOWN adds lane to activeNotes', () => {
    const s = reducer(initialState, { type: 'NOTE_DOWN', lane: 3, time: 1.5 });
    expect(s.activeNotes[3]).toBe(1.5);
  });

  it('NOTE_UP removes lane from activeNotes', () => {
    const base = { ...initialState, activeNotes: { 3: 1.5, 5: 0.2 } };
    const s = reducer(base, { type: 'NOTE_UP', lane: 3 });
    expect(s.activeNotes[3]).toBeUndefined();
    expect(s.activeNotes[5]).toBe(0.2);
  });

  it('NOTE_UP for lane not in activeNotes does not crash and returns unchanged state', () => {
    const s = reducer(initialState, { type: 'NOTE_UP', lane: 7 });
    expect(s.activeNotes).toEqual({});
  });

  it('ADD_VPLAYER deduplicates by id', () => {
    const player = { id: 'u1', username: 'Alice' };
    const base = { ...initialState, vplayers: [player] };
    const s = reducer(base, { type: 'ADD_VPLAYER', player: { id: 'u1', username: 'Alice2' } });
    expect(s.vplayers).toHaveLength(1);
    expect(s.vplayers[0].username).toBe('Alice2');
  });

  it('UPDATE_VPLAYER only mutates the matched id', () => {
    const v1 = { id: 'u1', username: 'Alice', notes: [] };
    const v2 = { id: 'u2', username: 'Bob', notes: [] };
    const base = { ...initialState, vplayers: [v1, v2] };
    const s = reducer(base, { type: 'UPDATE_VPLAYER', id: 'u1', updates: { notes: [1, 2] } });
    expect(s.vplayers.find((v) => v.id === 'u1').notes).toEqual([1, 2]);
    expect(s.vplayers.find((v) => v.id === 'u2')).toBe(v2);
  });

  it('unknown action type returns state unchanged', () => {
    const s = reducer(initialState, { type: 'UNKNOWN_ACTION' });
    expect(s).toBe(initialState);
  });
});

// ── usePractice hook tests ────────────────────────────────────────────────────

describe('usePractice', () => {
  it('sessionReady becomes true after init resolves', async () => {
    // In jsdom the no-client path resolves synchronously; renderHook flushes it.
    const { result } = renderHook(() => usePractice({}));
    await act(async () => {});
    expect(result.current.sessionReady).toBe(true);
  });

  it('audioActive starts false; activateAudio() calls Tone.start() and sets it true', async () => {
    const Tone = await import('tone');
    const { result } = renderHook(() => usePractice({}));
    await act(async () => {});
    expect(result.current.audioActive).toBe(false);
    await act(async () => {
      await result.current.activateAudio();
    });
    expect(Tone.start).toHaveBeenCalled();
    expect(result.current.audioActive).toBe(true);
  });

  it('createPattern dispatches ADD_PATTERN and sets editingPatternId', async () => {
    const { result } = renderHook(() => usePractice({}));
    await act(async () => {});
    act(() => {
      result.current.createPattern('guitar');
    });
    expect(result.current.state.patterns).toHaveLength(1);
    expect(result.current.state.patterns[0].inst).toBe('guitar');
    expect(result.current.state.editingPatternId).not.toBeNull();
  });

  it('createPattern is a no-op when sessionReady is false', async () => {
    // Use a client whose syncClock never resolves so the init stays pending.
    const syncClock = vi.fn(() => new Promise(() => {}));
    const client = {
      id: 'c1', info: {}, sendAction: vi.fn(),
      onAction: vi.fn(() => () => {}), syncClock,
    };
    const { result } = renderHook(() => usePractice({ client }));
    expect(result.current.sessionReady).toBe(false);
    act(() => {
      result.current.createPattern('guitar');
    });
    expect(result.current.state.patterns).toHaveLength(0);
  });

  it('noteOn dispatches NOTE_DOWN', async () => {
    const { result } = renderHook(() => usePractice({}));
    await act(async () => {});
    act(() => {
      result.current.noteOn(2);
    });
    expect(result.current.state.activeNotes[2]).toBeDefined();
  });

  it('noteOff dispatches NOTE_UP', async () => {
    const { result } = renderHook(() => usePractice({}));
    await act(async () => {});
    act(() => {
      result.current.noteOn(2);
    });
    act(() => {
      result.current.noteOff(2);
    });
    expect(result.current.state.activeNotes[2]).toBeUndefined();
  });

  it('lockIn is a no-op when no editingPatternId', async () => {
    const { result } = renderHook(() => usePractice({}));
    await act(async () => {});
    // No pattern created — editingPatternId is null
    act(() => {
      result.current.lockIn();
    });
    expect(result.current.state.patterns).toHaveLength(0);
  });

  it('lockIn calls pat.lockIn, dispatches UPDATE_PATTERN, sends on_pattern_publish', async () => {
    const sendAction = vi.fn();
    const client = {
      id: 'client1',
      info: { id: 'client1', username: 'Test' },
      sendAction,
      onAction: vi.fn(() => () => {}),
      syncClock: vi.fn(() => Promise.resolve({ session_start: Date.now() })),
    };
    const { result } = renderHook(() => usePractice({ client }));
    await act(async () => {});

    act(() => {
      result.current.createPattern('guitar');
    });

    act(() => {
      result.current.lockIn();
    });

    const pattern = result.current.state.patterns[0];
    expect(pattern.lockedIn).toBe(true);
    expect(sendAction).toHaveBeenCalledWith('on_pattern_publish', expect.objectContaining({
      inst: 'guitar',
    }));
  });

  it('removePattern dispatches REMOVE_PATTERN', async () => {
    const { result } = renderHook(() => usePractice({}));
    await act(async () => {});
    act(() => {
      result.current.createPattern('guitar');
    });
    const id = result.current.state.patterns[0].id;
    act(() => {
      result.current.removePattern(id);
    });
    expect(result.current.state.patterns).toHaveLength(0);
    expect(result.current.state.editingPatternId).toBeNull();
  });

  it('queuePattern toggles queued state', async () => {
    const { result } = renderHook(() => usePractice({}));
    await act(async () => {});

    act(() => {
      result.current.createPattern('guitar');
    });
    const id = result.current.state.patterns[0].id;

    // Lock in the pattern first
    act(() => {
      result.current.lockIn();
    });

    // Queue it
    act(() => {
      result.current.queuePattern(id);
    });
    expect(result.current.state.patterns.find((p) => p.id === id).queued).toBe(true);

    // Dequeue it
    act(() => {
      result.current.queuePattern(id);
    });
    expect(result.current.state.patterns.find((p) => p.id === id).queued).toBe(false);
  });

  it('on_player_join adds player without duplicates', async () => {
    let actionHandler = null;
    const client = {
      id: 'c1',
      info: { id: 'c1', username: 'Host' },
      sendAction: vi.fn(),
      onAction: vi.fn((handler) => {
        actionHandler = handler;
        return () => {};
      }),
      syncClock: vi.fn(() => Promise.resolve({ session_start: Date.now() })),
    };
    const { result } = renderHook(() => usePractice({ client }));
    await act(async () => {});

    act(() => {
      actionHandler({ event_type: 'on_player_join', action: { id: 'u2', username: 'Bob' } });
    });
    act(() => {
      actionHandler({ event_type: 'on_player_join', action: { id: 'u2', username: 'Bob' } });
    });
    expect(result.current.players.filter((p) => p.id === 'u2')).toHaveLength(1);
  });

  it('on_pattern_publish from another player adds pattern to state', async () => {
    let actionHandler = null;
    const client = {
      id: 'c1',
      info: { id: 'c1', username: 'Host' },
      sendAction: vi.fn(),
      onAction: vi.fn((handler) => {
        actionHandler = handler;
        return () => {};
      }),
      syncClock: vi.fn(() => Promise.resolve({ session_start: Date.now() })),
    };
    const { result } = renderHook(() => usePractice({ client }));
    await act(async () => {});

    act(() => {
      actionHandler({
        event_type: 'on_pattern_publish',
        action: {
          sender_id: 'other_client',
          pattern_id: 'remote_p1',
          inst: 'bass',
          isDrum: false,
          notes: [{ lane: 0, time: 0.5, length: 0.2 }],
          creator: { id: 'other_client', username: 'Remote' },
        },
      });
    });
    expect(result.current.state.patterns).toHaveLength(1);
    expect(result.current.state.patterns[0].id).toBe('remote_p1');
  });

  it('on_pattern_publish from own client.id is ignored', async () => {
    let actionHandler = null;
    const client = {
      id: 'c1',
      info: { id: 'c1', username: 'Host' },
      sendAction: vi.fn(),
      onAction: vi.fn((handler) => {
        actionHandler = handler;
        return () => {};
      }),
      syncClock: vi.fn(() => Promise.resolve({ session_start: Date.now() })),
    };
    const { result } = renderHook(() => usePractice({ client }));
    await act(async () => {});

    act(() => {
      actionHandler({
        event_type: 'on_pattern_publish',
        action: {
          sender_id: 'c1', // same as client.id
          pattern_id: 'own_p1',
          inst: 'guitar',
          isDrum: false,
          notes: [],
          creator: { id: 'c1', username: 'Host' },
        },
      });
    });
    expect(result.current.state.patterns).toHaveLength(0);
  });
});
