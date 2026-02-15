import * as argon2 from 'argon2';
import * as crypto from 'crypto';

/**
 * Hash a code using Argon2id
 */
export async function hashPassword(code: string): Promise<string> {
  return argon2.hash(code);
}

/**
 * Verify a code against an Argon2id hash
 */
export async function verifyPassword(code: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, code);
  } catch {
    return false;
  }
}

/**
 * Create HMAC-SHA256 lookup key for fast user lookup
 */
export function createCodeLookup(code: string): Buffer {
  const secret = process.env.CODE_LOOKUP_SECRET;
  if (!secret) throw new Error('CODE_LOOKUP_SECRET not set');
  return crypto.createHmac('sha256', secret).update(code).digest();
}

/**
 * Encrypt a code using AES-256-GCM
 */
export function encryptCode(code: string): { encrypted: Buffer; iv: Buffer; tag: Buffer } {
  const keyHex = process.env.CODE_ENC_KEY;
  if (!keyHex) throw new Error('CODE_ENC_KEY not set');
  
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(12);
  
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  
  return { encrypted, iv, tag };
}

/**
 * Decrypt a code using AES-256-GCM
 */
export function decryptCode(encrypted: Buffer, iv: Buffer, tag: Buffer): string {
  const keyHex = process.env.CODE_ENC_KEY;
  if (!keyHex) throw new Error('CODE_ENC_KEY not set');
  
  const key = Buffer.from(keyHex, 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  
  return decipher.update(encrypted) + decipher.final('utf8');
}

/**
 * Generate a secure random session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a session token for storage
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
