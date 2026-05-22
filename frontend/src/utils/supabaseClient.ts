import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '[supabaseClient] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 비어 있습니다. frontend/.env.example 참고.'
  );
}

/** Realtime·채팅 없이 나머지 화면은 띄우기 위해, 미설정 시 무한 .on() 체이닝되는 noop 채널 */
function createNoopRealtimeChannel(): ReturnType<SupabaseClient['channel']> {
  const chain = {
    on: () => chain,
    subscribe: (cb?: (status: string) => void) => {
      if (cb) queueMicrotask(() => cb('SUBSCRIBED'));
      return chain;
    },
    send: () => Promise.resolve({ error: null }),
  };
  return chain as unknown as ReturnType<SupabaseClient['channel']>;
}

export const supabase: SupabaseClient = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : new Proxy({} as SupabaseClient, {
      get: (_t, prop) => {
        if (prop === 'channel') return () => createNoopRealtimeChannel();
        if (prop === 'removeChannel') return () => {};
        return () => {};
      },
    });

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
