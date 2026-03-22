/**
 * Client.js — WebSocket client wrapping Socket.io.
 *
 * Mirrors the Python server/client.py + server/networking.py API:
 *   connect(serverUrl, roomId) → join a room
 *   post(info_name, info)      → store data on server
 *   get(info_name, id)         → fetch data from server
 *   delete(info_name, id)      → remove data from server
 *   sendAction(event_type, data) → broadcast to other clients
 *   onAction(callback)         → receive broadcasts
 */

import { io } from 'socket.io-client';

const MEMBER_NAMES = [
  'Rudolph', 'Dasher', 'Prancer', 'Eran', 'Barry',
  'Dancer', 'Vixen', 'Donner', 'Cupid',
];

function randomName() {
  return MEMBER_NAMES[Math.floor(Math.random() * MEMBER_NAMES.length)];
}

export class Client {
  constructor() {
    this._socket = null;
    this.id = null;
    this.isHost = false;
    this.username = randomName();
    this.current_scene = null;
    this._actionListeners = [];
  }

  get info() {
    return {
      id: this.id,
      username: this.username,
      is_host: this.isHost,
    };
  }

  /** Connect to the server and join the given room. */
  connect(serverUrl, roomId) {
    return new Promise((resolve, reject) => {
      this._socket = io(serverUrl, { transports: ['websocket'] });

      this._socket.on('connect', () => {
        this._socket.emit(
          'join',
          { roomId, info: { username: this.username } },
          (res) => {
            if (res.success) {
              this.id = res.id;
              this.isHost = res.isHost;
              this.current_scene = res.current_scene || null;
              resolve(res);
            } else {
              reject(new Error(res.error || 'join_failed'));
            }
          },
        );
      });

      this._socket.on('connect_error', reject);

      // Listen for incoming broadcast actions
      this._socket.on('action', (actionData) => {
        for (const cb of this._actionListeners) {
          cb(actionData);
        }
      });
    });
  }

  disconnect() {
    if (this._socket) {
      this._socket.disconnect();
      this._socket = null;
    }
  }

  /** Register a callback for incoming action broadcasts. */
  onAction(callback) {
    this._actionListeners.push(callback);
    return () => {
      this._actionListeners = this._actionListeners.filter((cb) => cb !== callback);
    };
  }

  /** Post (store) data on the server. Returns the stored id. */
  post(info_name, info) {
    return new Promise((resolve, reject) => {
      this._socket.emit('post', { info_name, info }, (res) => {
        if (res.success) resolve(res.result);
        else reject(new Error('Post failed'));
      });
    });
  }

  /** Get data from the server store. Pass null id to get all. */
  get(info_name, identifier = null) {
    return new Promise((resolve, reject) => {
      this._socket.emit('get', { info_name, identifier }, (res) => {
        if (res.success) resolve(res.result);
        else reject(new Error('Get failed'));
      });
    });
  }

  /** Delete data from the server store. */
  delete(info_name, identifier) {
    return new Promise((resolve, reject) => {
      this._socket.emit('delete', { info_name, identifier }, (res) => {
        if (res.success) resolve(res.result);
        else reject(new Error('Delete failed'));
      });
    });
  }

  /** Broadcast an action to all other clients in the room. */
  sendAction(event_type, action = {}) {
    if (!this._socket) return;
    this._socket.emit('action', { event_type, action });
  }

  // Convenience wrappers (mirrors ClientObject in networking.py)
  addBandMember(memberInfo) {
    return this.post('band_members', { ...memberInfo, socket_id: this.id });
  }

  getBandMembers() {
    return this.get('band_members', null);
  }

  join() {
    return this.addBandMember(this.info);
  }

  /** Request a shared session clock reference from the server. */
  syncClock() {
    return new Promise((resolve, reject) => {
      this._socket.emit('sync_clock', (res) => {
        if (res.success) resolve(res);
        else reject(new Error('sync_clock failed'));
      });
    });
  }
}
