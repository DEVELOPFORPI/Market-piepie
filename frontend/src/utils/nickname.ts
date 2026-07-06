import { api } from '@/utils/api';

/** PiePie + 7자리 숫자 (클라이언트 폴백용) */
export function randomPiePieNickname(): string {
  const digits = String(Math.floor(1_000_000 + Math.random() * 9_000_000));
  return `PiePie${digits}`;
}

/** 서버에서 중복 없는 닉네임 제안; 실패 시 로컬 랜덤 */
export async function suggestPiePieNickname(): Promise<string> {
  try {
    const res = await api.get<{ nickname: string }>('/api/nicknames/suggest');
    if (res.ok && res.data?.nickname) return res.data.nickname;
  } catch {
    /* offline fallback */
  }
  return randomPiePieNickname();
}
