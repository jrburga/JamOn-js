/**
 * MainMenu.jsx — Main menu scene.
 * Ports main_menu.py — Host / Join buttons.
 */

import React, { useState } from 'react';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.PROD ? '' : 'http://localhost:3001');

export default function MainMenu({ onHost, onJoin }) {
  const [joining, setJoining] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleHost() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${SERVER_URL}/rooms`, { method: 'POST' });
      const data = await res.json();
      onHost(data.roomId);
    } catch (e) {
      setError('Could not reach server. Is it running?');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    if (!roomCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${SERVER_URL}/rooms/${roomCode.trim().toUpperCase()}`);
      if (res.ok) {
        onJoin(roomCode.trim().toUpperCase());
      } else {
        setError('Room not found. Check the code and try again.');
      }
    } catch (e) {
      setError('Could not reach server. Is it running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="scene main-menu">
      <header className="main-title">
        <h1>Jam On!</h1>
        <p className="subtitle">Online Collaborative Jam Session</p>
      </header>

      {!joining ? (
        <div className="menu-buttons">
          <button
            className="btn btn-host"
            onClick={handleHost}
            disabled={loading}
          >
            {loading ? 'Creating…' : 'Host'}
            <span className="btn-hint">Start a new session</span>
          </button>
          <button
            className="btn btn-join"
            onClick={() => setJoining(true)}
            disabled={loading}
          >
            Join
            <span className="btn-hint">Enter a room code</span>
          </button>
        </div>
      ) : (
        <form className="join-form" onSubmit={handleJoin}>
          <label htmlFor="roomCode">Enter Room Code</label>
          <input
            id="roomCode"
            type="text"
            placeholder="e.g. A1B2C3"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            maxLength={6}
            autoFocus
          />
          <div className="join-actions">
            <button type="submit" className="btn btn-host" disabled={loading}>
              {loading ? 'Joining…' : 'Join'}
            </button>
            <button
              type="button"
              className="btn btn-back"
              onClick={() => { setJoining(false); setError(''); }}
            >
              Back
            </button>
          </div>
        </form>
      )}

      {error && <p className="error-msg">{error}</p>}
    </div>
  );
}
