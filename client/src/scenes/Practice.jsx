/**
 * Practice.jsx — Thin layout wrapper for the Practice scene.
 *
 * Picks the appropriate layout component based on viewport width:
 *   - Mobile / tablet (<1024px): PracticeMobile
 *   - Desktop (≥1024px):        PracticeDesktop
 */

import React from 'react';
import PracticeDesktop from './PracticeDesktop.jsx';
import PracticeMobile from './PracticeMobile.jsx';
import useMediaQuery from '../hooks/useMediaQuery.js';

export default function Practice({ client, bandMembers = [], instSet = 'ROCK' }) {
  const { isMobile, isTablet } = useMediaQuery();

  if (isMobile || isTablet) {
    return <PracticeMobile client={client} bandMembers={bandMembers} instSet={instSet} />;
  }
  return <PracticeDesktop client={client} bandMembers={bandMembers} instSet={instSet} />;
}
