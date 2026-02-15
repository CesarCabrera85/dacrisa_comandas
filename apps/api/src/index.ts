import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { horariosRoutes } from './routes/horarios.js';
import { turnosRoutes } from './routes/turnos.js';
import { usersRoutes } from './routes/users.js';
import { masterdataProductosRoutes } from './routes/masterdata-productos.js';
import { masterdataRutasRoutes } from './routes/masterdata-rutas.js';
import { imapRoutes } from './routes/imap.js';
import { rutasRoutes } from './routes/rutas.js';
import { printRoutes } from './routes/print.js';
import { eventosRoutes } from './routes/eventos.js';
import { featureFlagsRoutes } from './routes/feature-flags.js';
import { startTurnoScheduler, stopTurnoScheduler } from './services/scheduler.js';
import { imapWorker } from './services/imap-worker.js';

// Get __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

await fastify.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

// Create PDF directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads');
const pdfDir = path.join(uploadsDir, 'pdf');
if (!fs.existsSync(pdfDir)) {
  fs.mkdirSync(pdfDir, { recursive: true });
}

// Register static files plugin for serving PDFs
await fastify.register(fastifyStatic, {
  root: uploadsDir,
  prefix: '/uploads/',
});

// Register routes
await fastify.register(healthRoutes);
await fastify.register(authRoutes);
await fastify.register(horariosRoutes, { prefix: '/api/horarios' });
await fastify.register(turnosRoutes, { prefix: '/api/turnos' });
await fastify.register(usersRoutes, { prefix: '/api/users' });
await fastify.register(masterdataProductosRoutes, { prefix: '/api/masterdata/productos' });
await fastify.register(masterdataRutasRoutes, { prefix: '/api/masterdata/rutas' });
await fastify.register(imapRoutes, { prefix: '/api/imap' });
await fastify.register(rutasRoutes, { prefix: '/api/rutas' });
await fastify.register(printRoutes, { prefix: '/api/print' });
await fastify.register(eventosRoutes, { prefix: '/api/eventos' });
await fastify.register(featureFlagsRoutes, { prefix: '/api/feature-flags' });

// Start server
const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  console.log(`\n[Server] Recibida señal ${signal}, cerrando...`);
  
  // Stop IMAP worker
  await imapWorker.stop();
  
  // Stop turno scheduler
  stopTurnoScheduler();
  
  // Close Fastify server
  await fastify.close();
  
  console.log('[Server] Servidor cerrado correctamente');
  process.exit(0);
}

// Register signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

try {
  await fastify.listen({ port: PORT, host: HOST });
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  
  // Iniciar scheduler de cierre automático de turnos
  startTurnoScheduler();
  
  // Iniciar IMAP worker
  await imapWorker.start();
  
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
