/**
 * IMAP Worker Service
 * Handles IMAP email ingestion with idempotency and backlog processing
 */

import { ImapFlow } from 'imapflow';
import { prisma } from '../lib/prisma.js';
import { getCursor, saveCursor, resetCursor, updateLastPollTime } from '../lib/imap-cursor.js';

// IMAP Configuration from environment
const IMAP_CONFIG = {
  host: process.env.IMAP_HOST || 'imap.example.com',
  port: parseInt(process.env.IMAP_PORT || '993', 10),
  user: process.env.IMAP_USER || 'pedidos@example.com',
  password: process.env.IMAP_PASSWORD || '',
  folder: process.env.IMAP_FOLDER || 'INBOX',
  pollSeconds: parseInt(process.env.IMAP_POLL_SECONDS || '15', 10),
  secure: process.env.IMAP_SECURE !== 'false',
};

// Backoff configuration
const MIN_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60000;

export interface ImapWorkerStatus {
  isRunning: boolean;
  isConnected: boolean;
  lastError: string | null;
  lastPollTime: Date | null;
  cursor: {
    lastUid: number;
    uidValidity: number | null;
  };
}

export class ImapWorker {
  private client: ImapFlow | null = null;
  private isRunning: boolean = false;
  private isConnected: boolean = false;
  private lastError: string | null = null;
  private lastPollTime: Date | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private backoffDelay: number = MIN_BACKOFF_MS;
  private reconnecting: boolean = false;

  /**
   * Start the IMAP worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[IMAP Worker] Worker ya está corriendo');
      return;
    }

    this.isRunning = true;
    console.log('[IMAP Worker] Iniciando IMAP Worker...');

    // Initial connection
    await this.connect();

    // Start polling
    this.pollInterval = setInterval(async () => {
      await this.poll();
    }, IMAP_CONFIG.pollSeconds * 1000);

    console.log(`[IMAP Worker] Worker iniciado - polling cada ${IMAP_CONFIG.pollSeconds}s`);
  }

  /**
   * Stop the IMAP worker
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('[IMAP Worker] Deteniendo IMAP Worker...');
    this.isRunning = false;

    // Clear polling interval
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    // Close IMAP connection
    await this.disconnect();

    console.log('[IMAP Worker] IMAP Worker detenido');
  }

  /**
   * Connect to IMAP server
   */
  private async connect(): Promise<void> {
    if (this.isConnected || this.reconnecting) {
      return;
    }

    this.reconnecting = true;

    try {
      // Create ImapFlow client
      this.client = new ImapFlow({
        host: IMAP_CONFIG.host,
        port: IMAP_CONFIG.port,
        secure: IMAP_CONFIG.secure,
        auth: {
          user: IMAP_CONFIG.user,
          pass: IMAP_CONFIG.password,
        },
        logger: false, // Disable verbose logging
      });

      // Connect
      await this.client.connect();
      this.isConnected = true;
      this.lastError = null;
      this.backoffDelay = MIN_BACKOFF_MS; // Reset backoff on successful connection

      console.log(`[IMAP Worker] Conectado a IMAP: ${IMAP_CONFIG.host}:${IMAP_CONFIG.port}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.lastError = errorMessage;
      this.isConnected = false;
      console.error(`[IMAP Worker] Error de conexión IMAP: ${errorMessage}`);

      // Apply backoff and retry if still running
      if (this.isRunning) {
        console.log(`[IMAP Worker] Reintentando en ${this.backoffDelay / 1000}s...`);
        await this.sleep(this.backoffDelay);
        this.backoffDelay = Math.min(this.backoffDelay * 2, MAX_BACKOFF_MS);
        this.reconnecting = false;
        await this.connect();
        return;
      }
    }

    this.reconnecting = false;
  }

  /**
   * Disconnect from IMAP server
   */
  private async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.logout();
      } catch {
        // Ignore logout errors
      }
      this.client = null;
    }
    this.isConnected = false;
  }

  /**
   * Poll for new messages (only if there's an active shift)
   */
  async poll(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Check for active shift
      const turnoActivo = await prisma.turno.findFirst({
        where: { estado: 'ACTIVO' },
      });

      if (!turnoActivo) {
        console.log('[IMAP Worker] No hay turno activo, skip polling');
        await updateLastPollTime();
        this.lastPollTime = new Date();
        return;
      }

      // Ensure connection
      if (!this.isConnected) {
        await this.connect();
        if (!this.isConnected) {
          return; // Still not connected
        }
      }

      // Ingest new messages
      await this.ingestNewMessages(turnoActivo.id);
      
      this.lastPollTime = new Date();
      await updateLastPollTime();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.lastError = errorMessage;
      console.error(`[IMAP Worker] Error en polling: ${errorMessage}`);

      // Reconnect on error
      this.isConnected = false;
      await this.connect();
    }
  }

  /**
   * Ingest new messages from IMAP
   */
  async ingestNewMessages(turnoId: string): Promise<number> {
    if (!this.client || !this.isConnected) {
      console.error('[IMAP Worker] No hay conexión IMAP activa');
      return 0;
    }

    let processedCount = 0;

    try {
      // Select mailbox
      const mailbox = await this.client.mailboxOpen(IMAP_CONFIG.folder);
      const currentUidValidity = Number(mailbox.uidValidity);

      // Get current cursor
      const cursor = await getCursor();

      // Check if uidValidity changed
      if (cursor.uidValidity !== null && cursor.uidValidity !== currentUidValidity) {
        console.log(`[IMAP Worker] UIDValidity cambió (${cursor.uidValidity} -> ${currentUidValidity}), reseteando cursor`);
        await resetCursor();
        cursor.lastUid = 0;
        cursor.uidValidity = null;
      }

      // Search for messages with UID > lastUid
      const searchQuery = cursor.lastUid > 0 ? `${cursor.lastUid + 1}:*` : '1:*';
      
      let lastProcessedUid = cursor.lastUid;

      // Fetch messages
      for await (const msg of this.client.fetch(searchQuery, {
        uid: true,
        envelope: true,
        bodyStructure: true,
        source: true, // Get full message source
      })) {
        const msgUid = Number(msg.uid);

        // Skip if already processed (shouldn't happen but safety check)
        if (msgUid <= cursor.lastUid) {
          continue;
        }

        try {
          // Check for idempotency - verify if this message already exists
          const existingLote = await prisma.lote.findUnique({
            where: {
              imap_uidvalidity_imap_uid: {
                imap_uidvalidity: BigInt(currentUidValidity),
                imap_uid: BigInt(msgUid),
              },
            },
          });

          if (existingLote) {
            // Register duplicate event and skip
            await this.registerEvent('DUPLICADO_IMAP_IGNORADO', turnoId, null, {
              imap_uid: msgUid,
              imap_uidvalidity: currentUidValidity,
              lote_id: existingLote.id,
            });
            console.log(`[IMAP Worker] Mensaje duplicado ignorado: UID ${msgUid}`);
            lastProcessedUid = Math.max(lastProcessedUid, msgUid);
            continue;
          }

          // Extract message data
          const subject = msg.envelope?.subject || '(Sin asunto)';
          const receivedAt = msg.envelope?.date || new Date();
          
          // Get body text
          let bodyText = '';
          if (msg.source) {
            // Parse body from source - simple extraction
            bodyText = this.extractBodyFromSource(msg.source.toString());
          }

          // Create lote
          const lote = await prisma.lote.create({
            data: {
              imap_uid: BigInt(msgUid),
              imap_uidvalidity: BigInt(currentUidValidity),
              subject_raw: subject,
              body_raw: bodyText,
              received_at: receivedAt,
              parse_status: 'OK', // Will be parsed in TASK 05
              original_turno_id: turnoId,
            },
          });

          // Register event
          await this.registerEvent('NUEVO_CORREO_RECIBIDO', turnoId, lote.id, {
            imap_uid: msgUid,
            subject: subject.substring(0, 100),
          });

          processedCount++;
          lastProcessedUid = Math.max(lastProcessedUid, msgUid);
          console.log(`[IMAP Worker] Nuevo lote creado: ${lote.id} (UID: ${msgUid})`);

        } catch (msgError) {
          const errorMessage = msgError instanceof Error ? msgError.message : String(msgError);
          console.error(`[IMAP Worker] Error procesando mensaje UID ${msgUid}: ${errorMessage}`);

          // Try to create lote with error status
          try {
            const errorLote = await prisma.lote.create({
              data: {
                imap_uid: BigInt(msgUid),
                imap_uidvalidity: BigInt(currentUidValidity),
                subject_raw: '(Error al leer)',
                body_raw: '',
                received_at: new Date(),
                parse_status: 'ERROR_PARSE',
                parse_error: errorMessage,
                original_turno_id: turnoId,
              },
            });

            await this.registerEvent('ERROR_EN_LECTURA_DE_CORREO', turnoId, errorLote.id, {
              imap_uid: msgUid,
              error: errorMessage,
            });
          } catch {
            // If we can't even create an error lote, just register the event
            await this.registerEvent('ERROR_EN_LECTURA_DE_CORREO', turnoId, null, {
              imap_uid: msgUid,
              error: errorMessage,
            });
          }

          lastProcessedUid = Math.max(lastProcessedUid, msgUid);
          // Continue with next message
        }
      }

      // Save cursor
      if (lastProcessedUid > cursor.lastUid) {
        await saveCursor(lastProcessedUid, currentUidValidity);
      }

      if (processedCount > 0) {
        console.log(`[IMAP Worker] Polling completado: ${processedCount} mensajes nuevos`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[IMAP Worker] Error en ingestNewMessages: ${errorMessage}`);
      this.lastError = errorMessage;
      throw error;
    }

    return processedCount;
  }

  /**
   * Execute backlog - process all unread messages since last cursor
   */
  async executeBacklog(turnoId: string): Promise<number> {
    console.log(`[IMAP Worker] Ejecutando backlog para turno ${turnoId}...`);
    
    // Ensure connection
    if (!this.isConnected) {
      await this.connect();
      if (!this.isConnected) {
        console.error('[IMAP Worker] No se pudo conectar para backlog');
        return 0;
      }
    }

    try {
      const count = await this.ingestNewMessages(turnoId);
      console.log(`[IMAP Worker] Backlog ejecutado: ${count} mensajes procesados`);
      return count;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[IMAP Worker] Error ejecutando backlog: ${errorMessage}`);
      return 0;
    }
  }

  /**
   * Get current worker status
   */
  async getStatus(): Promise<ImapWorkerStatus> {
    const cursor = await getCursor();
    
    return {
      isRunning: this.isRunning,
      isConnected: this.isConnected,
      lastError: this.lastError,
      lastPollTime: this.lastPollTime,
      cursor,
    };
  }

  /**
   * Extract body text from raw email source
   */
  private extractBodyFromSource(source: string): string {
    try {
      // Find the boundary between headers and body (double newline)
      const headerBodySplit = source.indexOf('\r\n\r\n');
      if (headerBodySplit === -1) {
        const altSplit = source.indexOf('\n\n');
        if (altSplit === -1) {
          return source; // Return full source if no clear separation
        }
        return source.substring(altSplit + 2);
      }
      
      const body = source.substring(headerBodySplit + 4);
      
      // Try to decode if it's base64 or quoted-printable (basic handling)
      // For now, just return the raw body - more sophisticated parsing can be added later
      return body;
    } catch {
      return source;
    }
  }

  /**
   * Register an event in the eventos table
   */
  private async registerEvent(
    tipo: string,
    turnoId: string,
    loteId: string | null,
    payload: Record<string, unknown>
  ): Promise<void> {
    try {
      await prisma.evento.create({
        data: {
          tipo,
          entidad_tipo: loteId ? 'LOTE' : 'TURNO',
          entidad_id: loteId || turnoId,
          actor_user_id: null, // System event
          payload: payload as object,
        },
      });
    } catch (error) {
      console.error(`[IMAP Worker] Error registrando evento ${tipo}:`, error);
    }
  }

  /**
   * Sleep helper for backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const imapWorker = new ImapWorker();
