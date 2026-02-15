import { prisma } from './prisma.js';
import { generateSessionToken, hashSessionToken } from './crypto.js';

const SESSION_TTL_DAYS = 30;

export interface SessionData {
  userId: string;
  sessionId: string;
  token: string;
}

/**
 * Create a new session for a user
 */
export async function createSession(userId: string, deviceId?: string): Promise<SessionData> {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_TTL_DAYS);
  
  const session = await prisma.session.create({
    data: {
      user_id: userId,
      session_token_hash: tokenHash,
      device_id: deviceId,
      expires_at: expiresAt,
    },
  });
  
  return {
    userId,
    sessionId: session.id,
    token,
  };
}

/**
 * Validate a session token and return the user if valid
 */
export async function validateSession(token: string) {
  const tokenHash = hashSessionToken(token);
  
  const session = await prisma.session.findFirst({
    where: {
      session_token_hash: tokenHash,
      revoked_at: null,
      expires_at: { gt: new Date() },
    },
    include: {
      user: true,
    },
  });
  
  if (!session) return null;
  
  return {
    session,
    user: session.user,
  };
}

/**
 * Invalidate a session
 */
export async function invalidateSession(token: string): Promise<boolean> {
  const tokenHash = hashSessionToken(token);
  
  const result = await prisma.session.updateMany({
    where: {
      session_token_hash: tokenHash,
      revoked_at: null,
    },
    data: {
      revoked_at: new Date(),
    },
  });
  
  return result.count > 0;
}

/**
 * Invalidate all sessions for a user (e.g., when code is changed)
 */
export async function invalidateAllUserSessions(userId: string): Promise<number> {
  const result = await prisma.session.updateMany({
    where: {
      user_id: userId,
      revoked_at: null,
    },
    data: {
      revoked_at: new Date(),
    },
  });
  
  return result.count;
}
