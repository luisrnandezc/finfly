import { describe, expect, it } from 'vitest';
import { hashPassword, validatePassword, verifyPassword } from '../srv/auth/passwords.ts';
import { cookieValue, newSessionToken, sessionTokenHash } from '../srv/auth/session.ts';

describe('Authentication security primitives', () => {
  it('stores a salted hash that verifies only the correct password', async () => {
    const password = 'A secure beta password 42!';
    const firstHash = await hashPassword(password);
    const secondHash = await hashPassword(password);

    expect(firstHash).not.toContain(password);
    expect(firstHash).not.toEqual(secondHash);
    await expect(verifyPassword(password, firstHash)).resolves.toBe(true);
    await expect(verifyPassword('incorrect password', firstHash)).resolves.toBe(false);
  });

  it('accepts passwords from eight characters', () => {
    expect(() => validatePassword('12345678')).not.toThrow();
    expect(() => validatePassword('1234567')).toThrow('Password must contain at least 8 characters');
  });

  it('uses random session tokens and stores only their deterministic hash', () => {
    const token = newSessionToken();
    const otherToken = newSessionToken();

    expect(token).not.toEqual(otherToken);
    expect(sessionTokenHash(token)).toHaveLength(64);
    expect(sessionTokenHash(token)).toEqual(sessionTokenHash(token));
    expect(cookieValue(`theme=light; finfly_session=${token}`, 'finfly_session')).toEqual(token);
  });
});
