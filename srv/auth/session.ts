import { createHash, randomBytes } from 'node:crypto';

export const SESSION_COOKIE = 'finfly_session';
export const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function sessionTokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function cookieValue(header: string | undefined, name: string): string | undefined {
  for (const item of (header ?? '').split(';')) {
    const separator = item.indexOf('=');
    if (separator < 0) continue;
    if (item.slice(0, separator).trim() === name) {
      return decodeURIComponent(item.slice(separator + 1).trim());
    }
  }
  return undefined;
}
