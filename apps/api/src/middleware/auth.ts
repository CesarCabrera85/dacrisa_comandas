import { FastifyRequest, FastifyReply } from 'fastify';
import { validateSession } from '../lib/sessions.js';

type RolTag = 'OPERARIO' | 'COLECTA' | 'JEFE' | 'CALIDAD' | 'DIOS' | 'PANTALLA_TECHO';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      nombre: string;
      rol_tag: string;
      estado: string;
    };
    sessionId?: string;
  }
}

/**
 * Middleware that requires authentication
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const token = request.cookies.session_token;
  
  if (!token) {
    return reply.status(401).send({
      code: 'AUTH_REQUIRED',
      message: 'Authentication required',
    });
  }
  
  const sessionData = await validateSession(token);
  
  if (!sessionData) {
    return reply.status(401).send({
      code: 'AUTH_REQUIRED',
      message: 'Invalid or expired session',
    });
  }
  
  const { user, session } = sessionData;
  
  // Check if user is active
  if (user.estado !== 'ACTIVO') {
    return reply.status(403).send({
      code: 'AUTH_USER_INACTIVE',
      message: 'User account is inactive',
    });
  }
  
  request.user = {
    id: user.id,
    nombre: user.nombre,
    rol_tag: user.rol_tag,
    estado: user.estado,
  };
  request.sessionId = session.id;
}

/**
 * Middleware factory that checks for specific roles
 */
export function requireRole(...allowedRoles: RolTag[]) {
  return async function(request: FastifyRequest, reply: FastifyReply) {
    // First ensure authenticated
    await requireAuth(request, reply);
    if (reply.sent) return;
    
    const userRole = request.user?.rol_tag as RolTag;
    
    if (!allowedRoles.includes(userRole)) {
      return reply.status(403).send({
        code: 'FORBIDDEN',
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
      });
    }
  };
}

// Specific role guards
export const requireOperario = requireRole('OPERARIO');
export const requireColecta = requireRole('COLECTA');
export const requireJefe = requireRole('JEFE', 'DIOS');
export const requireCalidad = requireRole('CALIDAD', 'DIOS');
export const requireDios = requireRole('DIOS');
export const requireTecho = requireRole('PANTALLA_TECHO');
