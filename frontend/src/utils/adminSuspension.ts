import { api } from '@/utils/api';
import { adminPasswordHeaders } from '@/utils/adminApi';

export type AdminAccountStatus = 'active' | 'suspended';

export interface ToggleSuspensionResult {
  /** 정지 상태가 실제로 바뀐 경우 */
  changed: boolean;
  /** 서버 기준 최신 상태 (확인 실패 시 null) */
  status: AdminAccountStatus | null;
}

async function fetchAccountStatus(userId: string): Promise<AdminAccountStatus | null> {
  const res = await api.get<{ account_status?: string }>(`/api/users/${userId}`);
  if (!res.ok) return null;
  return res.data?.account_status === 'suspended' ? 'suspended' : 'active';
}

/**
 * 정지/해제 토글. 화면에 남아 있던 옛 상태로 반대 동작이 나가지 않도록,
 * 서버의 최신 상태를 기준으로 확인창을 띄우고 그 상태를 조건으로 요청한다.
 */
export async function toggleUserSuspension(
  userId: string,
  nickname: string | null | undefined,
  knownStatus: AdminAccountStatus,
): Promise<ToggleSuspensionResult> {
  const label = nickname || '이 사용자';
  const serverStatus = await fetchAccountStatus(userId);
  const current = serverStatus ?? knownStatus;

  if (serverStatus && serverStatus !== knownStatus) {
    alert(
      `${label}의 상태가 이미 ${serverStatus === 'suspended' ? '정지' : '정상'}으로 바뀌었습니다.\n최신 상태로 다시 확인해 주세요.`,
    );
    return { changed: false, status: serverStatus };
  }

  const isSuspended = current === 'suspended';
  let reason = '';
  if (isSuspended) {
    if (!confirm(`${label}의 정지를 해제할까요?`)) return { changed: false, status: current };
  } else {
    const entered = window.prompt(`${label}를 정지할 사유를 입력하세요. (선택)`);
    if (entered === null) return { changed: false, status: current };
    reason = entered.trim();
  }

  const res = await api.patch<{ account_status?: string }>(
    `/api/admin/users/${userId}/suspension`,
    { suspended: !isSuspended, reason, expectedStatus: current },
    { headers: adminPasswordHeaders() },
  );

  if (res.status === 409) {
    const latest = await fetchAccountStatus(userId);
    alert(`${label}의 상태가 방금 바뀌어 처리하지 않았습니다. 다시 확인해 주세요.`);
    return { changed: false, status: latest };
  }

  if (!res.ok) {
    alert(`처리 실패: ${res.error || `HTTP ${res.status}`}`);
    return { changed: false, status: current };
  }

  return { changed: true, status: isSuspended ? 'active' : 'suspended' };
}
