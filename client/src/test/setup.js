// Global test setup for Vitest + jsdom

// Mock HTMLCanvasElement.getContext — jsdom has no real canvas implementation.
// Tests can verify that draw methods are called; pixel output is manual-only.
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fillText: vi.fn(),
  set fillStyle(_) {},
  set strokeStyle(_) {},
  set lineWidth(_) {},
  set font(_) {},
  set globalAlpha(_) {},
}));

// Mock Tone.js — it requires a real Web Audio context which jsdom can't provide.
// Each test can override specific methods via vi.mocked() if needed.
vi.mock('tone', () => {
  const makeSynth = () => ({
    triggerAttack: vi.fn(),
    triggerRelease: vi.fn(),
    triggerAttackRelease: vi.fn(),
    dispose: vi.fn(),
    toDestination() { return this; },
  });

  return {
    PolySynth: vi.fn(() => makeSynth()),
    Synth: vi.fn(),
    MembraneSynth: vi.fn(() => makeSynth()),
    NoiseSynth: vi.fn(() => makeSynth()),
    MetalSynth: vi.fn(() => makeSynth()),
    getTransport: vi.fn(() => ({ bpm: { value: 120 } })),
    start: vi.fn(() => Promise.resolve()),
    now: vi.fn(() => 0),
    context: { state: 'running' },
  };
});
