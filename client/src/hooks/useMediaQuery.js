import { useState, useEffect } from 'react';

/**
 * Returns responsive breakpoint flags based on window width and orientation.
 *
 * @returns {{ isMobile: boolean, isTablet: boolean, isLandscape: boolean }}
 *   isMobile   — width < 768px
 *   isTablet   — 768px ≤ width < 1024px
 *   isLandscape — window.innerWidth > window.innerHeight
 */
export default function useMediaQuery() {
  const [state, setState] = useState(() => getFlags());

  useEffect(() => {
    function handleResize() {
      setState(getFlags());
    }

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return state;
}

function getFlags() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    isMobile: w < 768,
    isTablet: w >= 768 && w < 1024,
    isLandscape: w > h,
  };
}
