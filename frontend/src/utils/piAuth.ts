import { API_BASE } from '@/utils/apiConfig';

type PiSdk = {
  init: (config: { version: string; sandbox?: boolean }) => void;
  authenticate: (
    scopes: string[],
    onIncompletePaymentFound: (payment: any) => void
  ) => Promise<{ accessToken: string; user: { uid: string; username?: string } }>;
  createPayment: (data: any, callbacks: any) => Promise<any>;
};

function getPi(): PiSdk | undefined {
  return (window as unknown as { Pi?: PiSdk }).Pi;
}

export interface PiAuthResult {
  uid: string;
  username?: string;
  accessToken: string;
}

async function postJson(path: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function handleIncompletePayment(payment: any) {
  await postJson('/api/payments/incomplete', { payment });
}

export async function piAuthenticate(): Promise<PiAuthResult> {
  const Pi = getPi();
  if (!Pi) {
    throw new Error('Pi SDK not available. Please open in Pi Browser.');
  }
  const scopes = ['username', 'payments'];
  const auth = await Pi.authenticate(scopes, handleIncompletePayment);
  return {
    uid: auth.user.uid,
    username: auth.user.username,
    accessToken: auth.accessToken,
  };
}

/**
 * Run a Pi payment flow. Resolves true only if both server approve and complete succeed.
 * If approve fails, completion is short-circuited so we don't record a half-finished payment.
 */
function runPiPayment(paymentData: {
  amount: number;
  memo: string;
  metadata: Record<string, unknown>;
}): Promise<boolean> {
  const Pi = getPi();
  if (!Pi) return Promise.reject(new Error('Pi SDK not available'));

  return new Promise((resolve) => {
    let approveOk = false;

    const callbacks = {
      onReadyForServerApproval: async (paymentId: string) => {
        approveOk = await postJson('/api/payments/approve', { paymentId });
      },
      onReadyForServerCompletion: async (paymentId: string, txid: string) => {
        if (!approveOk) {
          resolve(false);
          return;
        }
        const ok = await postJson('/api/payments/complete', { paymentId, txid });
        resolve(ok);
      },
      onCancel: () => resolve(false),
      onError: () => resolve(false),
    };

    Pi.createPayment(paymentData, callbacks);
  });
}

export function piVerificationPayment(): Promise<boolean> {
  return runPiPayment({
    amount: 0.01,
    memo: 'MarketPiePie identity verification',
    metadata: { type: 'verification' },
  });
}

export function piBadgePurchasePayment(badgeId: string, badgeLabel: string): Promise<boolean> {
  return runPiPayment({
    amount: 0.01,
    memo: `Unlock badge: ${badgeLabel}`,
    metadata: { type: 'badge_purchase', badgeId },
  });
}

export async function verifyPiAuth(accessToken: string): Promise<{
  uid: string;
  username?: string;
  piVerified?: boolean;
  sessionToken?: string;
}> {
  const res = await fetch(API_BASE + '/api/auth/pi/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken }),
  });
  if (!res.ok) throw new Error('Pi auth verification failed');
  return res.json();
}

export function isPiBrowser(): boolean {
  return typeof window !== 'undefined' && !!getPi();
}
