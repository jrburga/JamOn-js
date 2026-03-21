/**
 * WaitingRoom.jsx — Waiting room scene.
 * Ports waiting_room.py — band member list + instrument set selection.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { INSTRUMENT_SETS } from '../game/Instrument.js';

const INST_COLORS = ['#e05c5c', '#5ce05c', '#5c8ce0', '#e0c05c', '#c05ce0', '#5ce0c0'];

export default function WaitingRoom({ client, roomId, isHost, onStart }) {
  const [bandMembers, setBandMembers] = useState([]);
  const [selectedInstSet, setSelectedInstSet] = useState(Object.keys(INSTRUMENT_SETS)[0]);
  const [starting, setStarting] = useState(false);

  // Fetch current band members on mount
  useEffect(() => {
    client.getBandMembers().then((members) => {
      if (members) setBandMembers(members);
    });

    const unsubscribe = client.onAction(({ event_type, action }) => {
      if (event_type === 'on_join') {
        // Re-fetch band members whenever someone joins
        client.getBandMembers().then((members) => {
          if (members) setBandMembers(members);
        });
      }
      if (event_type === 'on_scene_change') {
        onStart(action);
      }
    });

    return unsubscribe;
  }, [client, onStart]);

  // Register this client as a band member
  useEffect(() => {
    client.join();
    // Reflect back in local state immediately
    setBandMembers((prev) => {
      const alreadyPresent = prev.some((m) => m.id === client.id);
      if (alreadyPresent) return prev;
      return [...prev, client.info];
    });
  }, [client]);

  const handleStart = useCallback(() => {
    if (!isHost) return;
    setStarting(true);
    client.getBandMembers().then((members) => {
      client.sendAction('on_scene_change', {
        scene_name: 'practice',
        band_members: members || [],
        instrument_set: selectedInstSet,
      });
      onStart({ scene_name: 'practice', band_members: members || [], instrument_set: selectedInstSet });
    });
  }, [client, isHost, selectedInstSet, onStart]);

  const instSetNames = Object.keys(INSTRUMENT_SETS);

  return (
    <div className="scene waiting-room">
      <h2 className="scene-title">Waiting Room</h2>

      <div className="wr-layout">
        {/* Band members */}
        <section className="band-panel">
          <h3>The Band</h3>
          <p className="room-code">
            Room Code: <strong>{roomId}</strong>
            <span className="room-hint"> (share this with friends)</span>
          </p>
          {bandMembers.length === 0 ? (
            <p className="empty-hint">Waiting for players…</p>
          ) : (
            <ul className="band-list">
              {bandMembers.map((m, i) => (
                <li key={m.id || i} className={m.id === client.id ? 'me' : ''}>
                  <span className="member-name">{m.username}</span>
                  {m.id === client.id && <span className="me-badge">You</span>}
                  {m.is_host && <span className="host-badge">Host</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Instrument set selection (host only) */}
        {isHost && (
          <section className="inst-panel">
            <h3>Choose Instruments</h3>
            <div className="inst-buttons">
              {instSetNames.map((name, i) => (
                <button
                  key={name}
                  className={`inst-btn ${selectedInstSet === name ? 'selected' : ''}`}
                  style={{ '--accent': INST_COLORS[i % INST_COLORS.length] }}
                  onClick={() => setSelectedInstSet(name)}
                >
                  <span className="inst-name">{name}</span>
                  <span className="inst-insts">
                    {Object.keys(INSTRUMENT_SETS[name]).join(', ')}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      {isHost && (
        <button
          className="btn btn-host btn-start"
          onClick={handleStart}
          disabled={starting || bandMembers.length === 0}
        >
          {starting ? 'Starting…' : "Let's Jam!"}
        </button>
      )}

      {!isHost && (
        <p className="waiting-hint">Waiting for host to start the session…</p>
      )}
    </div>
  );
}
