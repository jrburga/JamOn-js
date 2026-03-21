import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Client } from '../Client.js';

// ── Mock socket.io-client ──────────────────────────────────────────────────
// We build a minimal EventEmitter-style mock socket so we can test
// the Client class without a real network connection.

let mockSocket;

vi.mock('socket.io-client', () => {
  return {
    io: vi.fn(() => mockSocket),
  };
});

function makeSocket() {
  const handlers = {};
  const emittedEvents = [];

  const socket = {
    on(event, cb) {
      handlers[event] = cb;
      return socket;
    },
    emit(event, ...args) {
      emittedEvents.push({ event, args });
      // Auto-call acknowledgement callbacks for known events
      const lastArg = args[args.length - 1];
      if (typeof lastArg === 'function') {
        if (event === 'join') {
          lastArg({ success: true, id: 'socket-123', isHost: true });
        } else if (event === 'post') {
          lastArg({ success: true, result: 'stored-id-456' });
        } else if (event === 'get') {
          lastArg({ success: true, result: [{ id: 'member-1', username: 'Rudolph' }] });
        } else if (event === 'delete') {
          lastArg({ success: true, result: args[0]?.identifier });
        }
      }
      return socket;
    },
    disconnect: vi.fn(),
    /** Simulate a server-push event (for testing onAction). */
    _trigger(event, data) {
      if (handlers[event]) handlers[event](data);
    },
    _emitted: emittedEvents,
  };
  return socket;
}

describe('Client', () => {
  let client;

  beforeEach(() => {
    mockSocket = makeSocket();
    client = new Client();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial state ──────────────────────────────────────────────────────────

  it('starts with no id and not a host', () => {
    expect(client.id).toBeNull();
    expect(client.isHost).toBe(false);
  });

  it('has a random username from the known list', () => {
    const NAMES = ['Rudolph','Dasher','Prancer','Eran','Barry','Dancer','Vixen','Donner','Cupid'];
    expect(NAMES).toContain(client.username);
  });

  // ── connect ────────────────────────────────────────────────────────────────

  it('sets id and isHost after a successful join', async () => {
    const connectPromise = client.connect('http://localhost:3001', 'ROOM1');
    // Simulate the socket connect event
    mockSocket._trigger('connect', {});
    await connectPromise;
    expect(client.id).toBe('socket-123');
    expect(client.isHost).toBe(true);
  });

  it('emits a join event with the room id and username info', async () => {
    const connectPromise = client.connect('http://localhost:3001', 'ABCDEF');
    mockSocket._trigger('connect', {});
    await connectPromise;

    const joinEmit = mockSocket._emitted.find((e) => e.event === 'join');
    expect(joinEmit).toBeDefined();
    expect(joinEmit.args[0]).toMatchObject({ roomId: 'ABCDEF' });
    expect(joinEmit.args[0].info).toMatchObject({ username: client.username });
  });

  // ── post / get / delete ────────────────────────────────────────────────────

  it('post emits the right event and resolves with the returned id', async () => {
    const connectPromise = client.connect('http://localhost:3001', 'ROOM1');
    mockSocket._trigger('connect', {});
    await connectPromise;

    const result = await client.post('band_members', { username: 'Jake' });
    expect(result).toBe('stored-id-456');
    const postEmit = mockSocket._emitted.find((e) => e.event === 'post');
    expect(postEmit.args[0]).toMatchObject({ info_name: 'band_members' });
  });

  it('get emits the right event and resolves with the result', async () => {
    const connectPromise = client.connect('http://localhost:3001', 'ROOM1');
    mockSocket._trigger('connect', {});
    await connectPromise;

    const result = await client.get('band_members', null);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toMatchObject({ username: 'Rudolph' });
  });

  it('delete emits the right event', async () => {
    const connectPromise = client.connect('http://localhost:3001', 'ROOM1');
    mockSocket._trigger('connect', {});
    await connectPromise;

    await expect(client.delete('patterns', 'pat-1')).resolves.not.toThrow();
    const delEmit = mockSocket._emitted.find((e) => e.event === 'delete');
    expect(delEmit.args[0]).toMatchObject({ info_name: 'patterns', identifier: 'pat-1' });
  });

  // ── sendAction ────────────────────────────────────────────────────────────

  it('sendAction emits an action event with type and payload', async () => {
    const connectPromise = client.connect('http://localhost:3001', 'ROOM1');
    mockSocket._trigger('connect', {});
    await connectPromise;

    client.sendAction('on_pattern_create', { pattern_id: 'p1', inst: 'piano' });
    const actionEmit = mockSocket._emitted.find((e) => e.event === 'action');
    expect(actionEmit).toBeDefined();
    expect(actionEmit.args[0]).toMatchObject({
      event_type: 'on_pattern_create',
      action: { pattern_id: 'p1', inst: 'piano' },
    });
  });

  it('sendAction is a no-op when not connected', () => {
    expect(() => client.sendAction('foo', {})).not.toThrow();
  });

  // ── onAction ──────────────────────────────────────────────────────────────

  it('onAction callback is invoked when the socket emits an action event', async () => {
    const connectPromise = client.connect('http://localhost:3001', 'ROOM1');
    mockSocket._trigger('connect', {});
    await connectPromise;

    const received = [];
    client.onAction((data) => received.push(data));

    mockSocket._trigger('action', { event_type: 'on_join', action: {} });
    expect(received).toHaveLength(1);
    expect(received[0].event_type).toBe('on_join');
  });

  it('onAction unsubscribe removes the listener', async () => {
    const connectPromise = client.connect('http://localhost:3001', 'ROOM1');
    mockSocket._trigger('connect', {});
    await connectPromise;

    const received = [];
    const unsub = client.onAction((data) => received.push(data));
    unsub();

    mockSocket._trigger('action', { event_type: 'on_join', action: {} });
    expect(received).toHaveLength(0);
  });

  it('multiple listeners all receive the action', async () => {
    const connectPromise = client.connect('http://localhost:3001', 'ROOM1');
    mockSocket._trigger('connect', {});
    await connectPromise;

    const a = [], b = [];
    client.onAction((d) => a.push(d));
    client.onAction((d) => b.push(d));

    mockSocket._trigger('action', { event_type: 'x', action: {} });
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  // ── info ──────────────────────────────────────────────────────────────────

  it('info returns the client identity object', async () => {
    const connectPromise = client.connect('http://localhost:3001', 'ROOM1');
    mockSocket._trigger('connect', {});
    await connectPromise;

    const info = client.info;
    expect(info.id).toBe('socket-123');
    expect(info.username).toBe(client.username);
    expect(info.is_host).toBe(true);
  });

  // ── disconnect ────────────────────────────────────────────────────────────

  it('disconnect calls socket.disconnect and nulls the socket', async () => {
    const connectPromise = client.connect('http://localhost:3001', 'ROOM1');
    mockSocket._trigger('connect', {});
    await connectPromise;

    client.disconnect();
    expect(mockSocket.disconnect).toHaveBeenCalled();
    expect(client._socket).toBeNull();
  });
});
