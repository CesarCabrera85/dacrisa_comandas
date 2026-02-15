import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { verifyPassword, createCodeLookup } from '../lib/crypto.js';
import { createSession, invalidateSession } from '../lib/sessions.js';
import { requireAuth } from '../middleware/auth.js';

interface LoginBody {
  code: string;
}

export async function authRoutes(fastify: FastifyInstance) {
  // POST /api/auth/login
  fastify.post<{ Body: LoginBody }>('/api/auth/login', async (request, reply) => {
    const { code } = request.body;
    
    if (!code || typeof code !== 'string') {
      return reply.status(400).send({
        code: 'INVALID_REQUEST',
        message: 'Code is required',
      });
    }
    
    // Find user by code lookup (HMAC)
    const codeLookup = createCodeLookup(code);
    
    const user = await prisma.usuario.findFirst({
      where: {
        codigo_lookup: codeLookup,
      },
    });
    
    if (!user) {
      return reply.status(401).send({
        code: 'AUTH_INVALID',
        message: 'Invalid code',
      });
    }
    
    // Verify password with Argon2
    const isValid = await verifyPassword(code, user.codigo_hash);
    
    if (!isValid) {
      return reply.status(401).send({
        code: 'AUTH_INVALID',
        message: 'Invalid code',
      });
    }
    
    // Check user status
    if (user.estado !== 'ACTIVO') {
      return reply.status(403).send({
        code: 'AUTH_USER_INACTIVE',
        message: 'User account is inactive or on temporary leave',
      });
    }
    
    // Create session
    const sessionData = await createSession(user.id);
    
    // Set httpOnly cookie
    reply.setCookie('session_token', sessionData.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });
    
    return {
      user: {
        id: user.id,
        nombre: user.nombre,
        rol_tag: user.rol_tag,
        estado: user.estado,
      },
    };
  });
  
  // POST /api/auth/logout
  fastify.post('/api/auth/logout', async (request, reply) => {
    const token = request.cookies.session_token;
    
    if (token) {
      await invalidateSession(token);
    }
    
    reply.clearCookie('session_token', {
      path: '/',
    });
    
    return { success: true };
  });
  
  // GET /api/auth/me
  fastify.get('/api/auth/me', { preHandler: requireAuth }, async (request, reply) => {
    return {
      user: request.user,
    };
  });
}
