import React, { useLayoutEffect, useRef, useState } from 'react';
import { useLocation, type Location } from 'react-router-dom';
import { getAppLanguage } from '@/utils/languageStorage';
import { resolveTransition, transitionMs, type TransitionKind } from '@/utils/pageTransition';

type LeaveState = {
  location: Location;
  scroll: number;
};

export const PageTransition: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const location = useLocation();
  const liveRef = useRef(location);
  const [live, setLive] = useState(location);
  const [leave, setLeave] = useState<LeaveState | null>(null);
  const [kind, setKind] = useState<TransitionKind>('none');
  const lang = getAppLanguage();
  const rtl = lang === 'ar' || lang === 'fa' || lang === 'ur';

  useLayoutEffect(() => {
    const prev = liveRef.current;
    if (prev.pathname === location.pathname && prev.search === location.search) return;

    const nextKind = resolveTransition(prev.pathname, location.pathname);

    if (nextKind === 'none') {
      liveRef.current = location;
      setLive(location);
      setLeave(null);
      setKind('none');
      return;
    }

    const scroll = window.scrollY;
    setLeave({ location: prev, scroll });
    liveRef.current = location;
    setLive(location);
    setKind(nextKind);
    window.scrollTo(0, 0);

    const timer = window.setTimeout(() => {
      setLeave(null);
      setKind('none');
    }, transitionMs(nextKind));

    return () => window.clearTimeout(timer);
  }, [location]);

  const animating = Boolean(leave && kind !== 'none');

  return (
    <div
      className={`pt-stage${rtl ? ' pt-rtl' : ''}${animating ? ' pt-stage--busy' : ''}`}
      data-pt={kind}
    >
      {leave ? (
        <div
          className={`pt-layer pt-layer--leave pt-${kind}`}
          style={{ top: -leave.scroll }}
          aria-hidden
        >
          {React.cloneElement(children, { location: leave.location })}
        </div>
      ) : null}
      <div
        key={animating ? `${kind}:${live.key}:${live.pathname}` : 'live'}
        className={`pt-layer pt-layer--enter${animating ? ` pt-${kind}` : ''}`}
      >
        {React.cloneElement(children, { location: live })}
      </div>
    </div>
  );
};
