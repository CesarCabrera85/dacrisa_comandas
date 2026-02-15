import { prisma } from './prisma.js';

/**
 * Invalidates all sessions for a specific user
 * Used when changing code, disabling user, etc.
 */
export async function invalidateUserSessions(userId: string): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { user_id: userId }
  });
  
  return result.count;
}

/**
 * Gets count of active sessions for a user
 */
export async function getUserSessionCount(userId: string): Promise<number> {
  const count = await prisma.session.count({
    where: {
      user_id: userId,
      revoked_at: null,
      expires_at: {
        gt: new Date()
      }
    }
  });
  
  return count;
}
