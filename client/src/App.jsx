/**
 * App.jsx — Root component and scene manager.
 *
 * Mirrors jamon/main.py: manages scene transitions and holds the
 * single Client instance for networking.
 *
 * Scenes: main_menu → waiting_room → practice
 */

import React, { useState, useRef, useCallback } from 'react';
import { Client } from './networking/Client.js';
import MainMenu from './scenes/MainMenu.jsx';
import WaitingRoom from './scenes/WaitingRoom.jsx';
import Practice from './scenes/Practice.jsx';

// In production (Railway) the client is served from the same origin as the
// server, so we use window.location.origin.  In local dev we fall back to
// the Vite proxy / explicit env var.
const SERVER_URL = import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.PROD ? window.location.origin : 'http://localhost:3001');

export default function App() {
  const [scene, setScene] = useState('main_menu');
  const [roomId, setRoomId] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [bandMembers, setBandMembers] = useState([]);
  const [instSet, setInstSet] = useState('ROCK');
  const [error, setError] = useState('');

  const clientRef = useRef(null);

  function getClient() {
    if (!clientRef.current) {
      clientRef.current = new Client();
    }
    return clientRef.current;
  }

  // ── Host: create room → connect → waiting room ──

  const handleHost = useCallback(async (newRoomId) => {
    setError('');
    const client = getClient();
    try {
      await client.connect(SERVER_URL, newRoomId);
      setRoomId(newRoomId);
      setIsHost(true);
      setScene('waiting_room');
    } catch (e) {
      setError('Failed to connect to server.');
      console.error(e);
    }
  }, []);

  // ── Join: verify room → connect → waiting room ──

  const handleJoin = useCallback(async (existingRoomId) => {
    setError('');
    const client = getClient();
    try {
      await client.connect(SERVER_URL, existingRoomId);
      setRoomId(existingRoomId);
      setIsHost(false);
      setScene('waiting_room');
    } catch (e) {
      setError('Failed to connect to server.');
      console.error(e);
    }
  }, []);

  // ── Start session → practice scene ──

  const handleStart = useCallback(({ band_members, instrument_set }) => {
    setBandMembers(band_members || []);
    setInstSet(instrument_set || 'ROCK');
    setScene('practice');
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  const client = clientRef.current;

  return (
    <div className="app">
      {error && (
        <div className="global-error">
          {error}
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}

      {scene === 'main_menu' && (
        <MainMenu onHost={handleHost} onJoin={handleJoin} />
      )}

      {scene === 'waiting_room' && client && (
        <WaitingRoom
          client={client}
          roomId={roomId}
          isHost={isHost}
          onStart={handleStart}
        />
      )}

      {scene === 'practice' && client && (
        <Practice
          client={client}
          bandMembers={bandMembers}
          instSet={instSet}
        />
      )}
    </div>
  );
}
