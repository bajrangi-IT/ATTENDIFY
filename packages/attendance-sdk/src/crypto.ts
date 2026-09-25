import { DynamicQrPayload } from '@campusattend/shared-types';

/**
 * Standard rotation interval for dynamic attendance QR codes in seconds.
 * 15 seconds prevents students from taking screenshot & sharing via WhatsApp/Telegram
 * while giving students in the room sufficient time to point camera.
 */
export const DEFAULT_ROTATION_INTERVAL_SECONDS = 15;

/**
 * Calculates current epoch window counter based on timestamp and interval.
 */
export function getEpochWindow(
  timestampMs: number = Date.now(),
  intervalSeconds: number = DEFAULT_ROTATION_INTERVAL_SECONDS
): number {
  return Math.floor(timestampMs / (intervalSeconds * 1000));
}

/**
 * Portable HMAC-SHA256 hashing using Web Crypto API (supported natively in modern browsers, Node 18+, and React Native).
 */
async function hmacSha256(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const keyData = enc.encode(secret);
  const msgData = enc.encode(message);

  // In environments where crypto.subtle exists (browsers, Node 18+, modern React Native / Expo)
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback hash implementation for environments lacking crypto.subtle
  let hash = 0;
  const combined = `${message}:${secret}`;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}

/**
 * Generates dynamic payload for a session smart display.
 * Includes epoch window and HMAC signature.
 */
export async function generateDynamicQrPayload(
  sessionId: string,
  classroomId: string,
  secretSeed: string,
  intervalSeconds: number = DEFAULT_ROTATION_INTERVAL_SECONDS,
  nowMs: number = Date.now()
): Promise<DynamicQrPayload> {
  const epochWindow = getEpochWindow(nowMs, intervalSeconds);
  const message = `${sessionId}:${classroomId}:${epochWindow}`;
  const token = await hmacSha256(message, secretSeed);

  return {
    session_id: sessionId,
    classroom_id: classroomId,
    timestamp: nowMs,
    epoch_window: epochWindow,
    token,
  };
}

/**
 * Validates dynamic QR token.
 * Allows current window and (optionally) the previous window (to absorb 15s transit/latency margin).
 */
export async function verifyDynamicQrToken(
  payload: {
    sessionId: string;
    classroomId: string;
    epochWindow: number;
    token: string;
  },
  secretSeed: string,
  intervalSeconds: number = DEFAULT_ROTATION_INTERVAL_SECONDS,
  nowMs: number = Date.now(),
  allowedWindowDrift: number = 1
): Promise<{ isValid: boolean; reason?: string }> {
  const currentWindow = getEpochWindow(nowMs, intervalSeconds);

  // Check window drift
  const drift = Math.abs(currentWindow - payload.epochWindow);
  if (drift > allowedWindowDrift) {
    return {
      isValid: false,
      reason: `QR Code has expired or timestamp out of sync (Drift: ${drift} windows). Please scan the live display.`,
    };
  }

  // Recompute expected token for the declared window
  const message = `${payload.sessionId}:${payload.classroomId}:${payload.epochWindow}`;
  const expectedToken = await hmacSha256(message, secretSeed);

  if (payload.token !== expectedToken) {
    return {
      isValid: false,
      reason: 'Invalid cryptographic token signature. Check-in rejected.',
    };
  }

  return { isValid: true };
}
