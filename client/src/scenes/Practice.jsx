/**
 * Practice.jsx — Thin layout wrapper for the Practice scene.
 *
 * Picks the appropriate layout component based on viewport width.
 * Currently always renders PracticeDesktop; PracticeMobile is created
 * separately as part of the mobile feature work.
 */

import React from 'react';
import PracticeDesktop from './PracticeDesktop.jsx';

export default function Practice({ client, bandMembers = [], instSet = 'ROCK' }) {
  return (
    <PracticeDesktop client={client} bandMembers={bandMembers} instSet={instSet} />
  );
}
