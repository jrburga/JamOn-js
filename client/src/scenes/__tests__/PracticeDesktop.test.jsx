/**
 * PracticeDesktop smoke tests (T-R02) and Practice thin-wrapper test (T-R03).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';

// Mock usePractice so tests don't spin up Tone.js / game loop
vi.mock('../../hooks/usePractice.js', () => {
  const noteOn = vi.fn();
  const noteOff = vi.fn();
  const lockIn = vi.fn();
  const createPattern = vi.fn();
  const removePattern = vi.fn();
  const queuePattern = vi.fn();

  const defaultResult = {
    state: {
      now: 0,
      patterns: [],
      activeNotes: {},
      editingPatternId: null,
      vplayers: [],
    },
    sessionReady: false,
    audioActive: false,
    players: [],
    seconds: 8,
    noteOn,
    noteOff,
    lockIn,
    createPattern,
    removePattern,
    queuePattern,
    activateAudio: vi.fn(),
    plRef: { current: null },
    instRef: { current: null },
    stateRef: { current: {} },
  };

  const usePractice = vi.fn(() => ({ ...defaultResult }));
  usePractice._mocks = { noteOn, noteOff, lockIn, createPattern, defaultResult };
  return { default: usePractice };
});

import PracticeDesktop from '../PracticeDesktop.jsx';
import Practice from '../Practice.jsx';
import usePractice from '../../hooks/usePractice.js';

function makeReadyState(overrides = {}) {
  return {
    state: {
      now: 0,
      patterns: [],
      activeNotes: {},
      editingPatternId: null,
      vplayers: [],
      ...overrides.state,
    },
    sessionReady: true,
    audioActive: true,
    players: [],
    seconds: 8,
    noteOn: vi.fn(),
    noteOff: vi.fn(),
    lockIn: vi.fn(),
    createPattern: vi.fn(),
    removePattern: vi.fn(),
    queuePattern: vi.fn(),
    activateAudio: vi.fn(),
    plRef: { current: null },
    instRef: { current: null },
    stateRef: { current: {} },
    ...overrides,
  };
}

describe('PracticeDesktop (T-R02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without throwing when sessionReady is false', () => {
    usePractice.mockReturnValue(makeReadyState({ sessionReady: false, audioActive: false }));
    expect(() => render(<PracticeDesktop />)).not.toThrow();
  });

  it('renders pattern list and instrument buttons when sessionReady is true', () => {
    usePractice.mockReturnValue(makeReadyState());
    render(<PracticeDesktop instSet="ROCK" />);
    expect(screen.getByText('Patterns')).toBeTruthy();
    // Instrument create buttons should be rendered
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('keydown "a" calls noteOn(0) from the hook', () => {
    const noteOn = vi.fn();
    usePractice.mockReturnValue(makeReadyState({ noteOn }));
    render(<PracticeDesktop />);
    fireEvent.keyDown(window, { key: 'a' });
    expect(noteOn).toHaveBeenCalledWith(0);
  });

  it('keydown SPACE calls lockIn() from the hook', () => {
    const lockIn = vi.fn();
    usePractice.mockReturnValue(makeReadyState({ lockIn }));
    render(<PracticeDesktop />);
    fireEvent.keyDown(window, { key: ' ' });
    expect(lockIn).toHaveBeenCalled();
  });

  it('keyup "a" calls noteOff(0) from the hook', () => {
    const noteOff = vi.fn();
    const noteOn = vi.fn();
    usePractice.mockReturnValue(makeReadyState({ noteOn, noteOff }));
    render(<PracticeDesktop />);
    // Press then release
    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.keyUp(window, { key: 'a' });
    expect(noteOff).toHaveBeenCalledWith(0);
  });

  it('same key held (repeat event) does not call noteOn twice', () => {
    const noteOn = vi.fn();
    usePractice.mockReturnValue(makeReadyState({ noteOn }));
    render(<PracticeDesktop />);
    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.keyDown(window, { key: 'a', repeat: true });
    expect(noteOn).toHaveBeenCalledTimes(1);
  });
});

// ── T-R03 — Practice thin wrapper ─────────────────────────────────────────────

describe('Practice thin wrapper (T-R03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePractice.mockReturnValue(makeReadyState());
  });

  it('renders PracticeDesktop (always, until mobile layout exists)', () => {
    render(<Practice />);
    // PracticeDesktop renders the Patterns heading
    expect(screen.getByText('Patterns')).toBeTruthy();
  });
});
