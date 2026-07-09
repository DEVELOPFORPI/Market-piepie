import { useState, useEffect, useRef } from 'react';

const THRESHOLD = 70;
const MAX_PULL = 88;

export function usePullToRefresh(onRefresh: () => Promise<void>, enabled = true) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pullRef = useRef(0);
  const pullingRef = useRef(false);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  onRefreshRef.current = onRefresh;
  refreshingRef.current = refreshing;

  useEffect(() => {
    if (!enabled) return;

    const resetPull = () => {
      pullingRef.current = false;
      pullRef.current = 0;
      setPull(0);
    };

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current || window.scrollY > 1) return;
      startY.current = e.touches[0].clientY;
      pullingRef.current = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!pullingRef.current || refreshingRef.current) return;
      if (window.scrollY > 1) {
        resetPull();
        return;
      }
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        pullRef.current = 0;
        setPull(0);
        return;
      }
      const dist = Math.min(dy * 0.45, MAX_PULL);
      pullRef.current = dist;
      setPull(dist);
      if (dy > 10) e.preventDefault();
    };

    const onEnd = async () => {
      if (!pullingRef.current || refreshingRef.current) return;
      pullingRef.current = false;
      const dist = pullRef.current;
      if (dist >= THRESHOLD) {
        setRefreshing(true);
        setPull(36);
        try {
          await onRefreshRef.current();
        } finally {
          setRefreshing(false);
          setPull(0);
        }
      } else {
        resetPull();
      }
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }, [enabled]);

  return { pull, refreshing };
}
