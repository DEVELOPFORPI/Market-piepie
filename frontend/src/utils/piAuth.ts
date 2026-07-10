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

const PI_AUTH_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
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
  const auth = await withTimeout(
    Pi.authenticate(scopes, handleIncompletePayment),
    PI_AUTH_TIMEOUT_MS,
    'Pi login timed out. Please close and reopen Pi Browser, then try again.',
  );
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

export const PI_VERIFICATION_AMOUNT = 3.14;

export function piVerificationPayment(piUsername?: string): Promise<boolean> {
  return runPiPayment({
    amount: PI_VERIFICATION_AMOUNT,
    memo: 'MarketPiePie identity verification',
    metadata: {
      type: 'profile_verification',
      ...(piUsername?.trim() ? { username: piUsername.trim() } : {}),
    },
  });
}

export function piBadgePurchasePayment(badgeId: string, badgeLabel: string): Promise<boolean> {
  return runPiPayment({
    amount: 0.01,
    memo: `Unlock badge: ${badgeLabel}`,
    metadata: { type: 'badge_purchase', badgeId },
  });
}

export async function verifyPiAuth(
  accessToken: string,
  guestId?: string | null,
): Promise<{
  uid: string;
  username?: string;
  piVerified?: boolean;
  sessionToken?: string;
}> {
  const res = await withTimeout(
    fetch(API_BASE + '/api/auth/pi/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken,
        guestId: guestId && guestId.startsWith('guest_') ? guestId : undefined,
      }),
    }),
    PI_AUTH_TIMEOUT_MS,
    'Server verification timed out. Please try again.',
  );
  if (!res.ok) throw new Error('Pi auth verification failed');
  return res.json();
}

export function isPiBrowser(): boolean {
  return typeof window !== 'undefined' && !!getPi();
}
