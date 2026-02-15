import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { horariosRoutes } from './routes/horarios.js';
import { turnosRoutes } from './routes/turnos.js';
import { usersRoutes } from './routes/users.js';
import { startTurnoScheduler } from './services/scheduler.js';

const fastify = Fastify({
  logger: true,
});

// Register plugins
await fastify.register(cors, {
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
});

await fastify.register(cookie, {
  secret: process.env.SESSION_SECRET || 'supersecretkey123456789012345678',
});

// Register routes
await fastify.register(healthRoutes);
await fastify.register(authRoutes);
await fastify.register(horariosRoutes, { prefix: '/api/horarios' });
await fastify.register(turnosRoutes, { prefix: '/api/turnos' });
await fastify.register(usersRoutes, { prefix: '/api/users' });

// Start server
const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

try {
  await fastify.listen({ port: PORT, host: HOST });
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  
  // Iniciar scheduler de cierre automático de turnos
  startTurnoScheduler();
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
