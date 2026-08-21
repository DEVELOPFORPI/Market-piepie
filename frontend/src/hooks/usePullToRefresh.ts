import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { getAppScrollTop } from '@/utils/appScroll';

const THRESHOLD = 72;
const MAX_PULL = 128;
const REFRESH_REST = 52;

function rubberBand(overscroll: number): number {
  if (overscroll <= 0) return 0;
  return MAX_PULL * (1 - Math.exp(-overscroll / (MAX_PULL * 1.15)));
}

export function usePullToRefresh(onRefresh: () => Promise<void>, enabled = true) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [dragging, setDragging] = useState(false);
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
      setDragging(false);
      setPull(0);
    };

    const atTop = () => getAppScrollTop() <= 1;

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current || !atTop()) return;
      startY.current = e.touches[0].clientY;
      pullingRef.current = true;
      setDragging(true);
    };

    const onMove = (e: TouchEvent) => {
      if (!pullingRef.current || refreshingRef.current) return;
      if (!atTop()) {
        resetPull();
        return;
      }
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        pullRef.current = 0;
        setPull(0);
        return;
      }
      const dist = rubberBand(dy);
      pullRef.current = dist;
      setPull(dist);
      if (dy > 8) e.preventDefault();
    };

    const onEnd = async () => {
      if (!pullingRef.current || refreshingRef.current) return;
      pullingRef.current = false;
      setDragging(false);
      const dist = pullRef.current;
      if (dist >= THRESHOLD) {
        setRefreshing(true);
        setPull(REFRESH_REST);
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

  const contentStyle: CSSProperties = {
    transform: pull > 0 ? `translateY(${pull}px)` : undefined,
    transition: dragging ? 'none' : 'transform 0.22s ease-out',
  };

  return { pull, refreshing, contentStyle };
}
