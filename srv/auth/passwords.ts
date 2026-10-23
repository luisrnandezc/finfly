import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(nodeScrypt);
const KEY_LENGTH = 64;
const MINIMUM_PASSWORD_LENGTH = 8;

export function validatePassword(password: unknown): asserts password is string {
  if (typeof password !== 'string' || password.length < MINIMUM_PASSWORD_LENGTH) {
    throw new Error(`Password must contain at least ${MINIMUM_PASSWORD_LENGTH} characters`);
  }
  if (password.length > 200) throw new Error('Password is too long');
}

export async function hashPassword(password: string): Promise<string> {
  validatePassword(password);
  const salt = randomBytes(16);
  const key = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, encodedSalt, encodedKey] = storedHash.split('$');
  if (algorithm !== 'scrypt' || !encodedSalt || !encodedKey) return false;

  try {
    const salt = Buffer.from(encodedSalt, 'base64');
    const expected = Buffer.from(encodedKey, 'base64');
    const actual = (await scrypt(password, salt, expected.length)) as Buffer;
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
