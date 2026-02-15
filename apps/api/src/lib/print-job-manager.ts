/**
 * Print Job Manager Module
 * Manages print job creation, item tracking, and line updates
 */

import prisma from './prisma.js';
import { registerEvento } from './event-registry.js';
import { onLineaImpresa } from './route-state-manager.js';
import { LineaConDatos } from './pdf-generator.js';

export type PrintJobTipo = 'OPERARIO_INICIAL' | 'OPERARIO_NUEVOS' | 'COLECTA_NUEVOS' | 'REIMPRESION';
export type PrintJobStatus = 'CREADO' | 'PDF_GENERADO' | 'ENVIADO' | 'FALLIDO';

export interface CreatePrintJobData {
  tipo: PrintJobTipo;
  actor_user_id: string | null;
  ruta_norm: string;
  turno_id: string;
  lineas: LineaConDatos[];
  pdf_path: string;
  cutoff_lote_id?: string | null;
  from_lote_id?: string | null;
  to_lote_id?: string | null;
}

export interface PrintJobResult {
  id: string;
  tipo: PrintJobTipo;
  actor_user_id: string | null;
  ruta_norm: string;
  turno_id: string;
  status: PrintJobStatus;
  pdf_path: string;
  lineas_count: number;
  created_at: Date;
}

/**
 * Create a print job and associated items in a transaction
 * Updates linea.printed_at and print_count
 */
export async function createPrintJob(data: CreatePrintJobData): Promise<PrintJobResult> {
  const {
    tipo,
    actor_user_id,
    ruta_norm,
    turno_id,
    lineas,
    pdf_path,
    cutoff_lote_id,
    from_lote_id,
    to_lote_id,
  } = data;

  // Use transaction for atomicity
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create the print job
    const printJob = await tx.printJob.create({
      data: {
        turno_id,
        ruta_norm,
        actor_user_id,
        tipo,
        cutoff_lote_id: cutoff_lote_id || null,
        from_lote_id: from_lote_id || null,
        to_lote_id: to_lote_id || null,
        status: 'PDF_GENERADO',
        pdf_path,
        meta: {
          lineas_count: lineas.length,
          generated_at: new Date().toISOString(),
        },
      },
    });

    // 2. Create print job items for each line
    const lineaIds = lineas.map(l => l.id);
    for (const lineaId of lineaIds) {
      await tx.printJobItem.create({
        data: {
          print_job_id: printJob.id,
          linea_id: lineaId,
        },
      });
    }

    // 3. Update lineas: set printed_at (first time) or increment print_count
    const now = new Date();
    for (const lineaId of lineaIds) {
      const linea = await tx.linea.findUnique({
        where: { id: lineaId },
        select: { printed_at: true, print_count: true },
      });

      if (linea?.printed_at === null) {
        // First time printing
        await tx.linea.update({
          where: { id: lineaId },
          data: {
            printed_at: now,
            print_count: 1,
          },
        });
      } else {
        // Reprint - only increment count
        await tx.linea.update({
          where: { id: lineaId },
          data: {
            print_count: {
              increment: 1,
            },
          },
        });
      }
    }

    return printJob;
  });

  // 4. Register event (outside transaction)
  await registerEvento({
    tipo: 'IMPRESION_REALIZADA',
    entidad_tipo: 'print_job',
    entidad_id: result.id,
    actor_user_id,
    payload: {
      print_job_id: result.id,
      tipo,
      ruta_norm,
      turno_id,
      lineas_count: lineas.length,
      pdf_path,
    },
  });

  // 5. Update route state (may trigger VERDE state)
  await onLineaImpresa(turno_id, ruta_norm, actor_user_id || undefined);

  return {
    id: result.id,
    tipo: tipo,
    actor_user_id,
    ruta_norm,
    turno_id,
    status: 'PDF_GENERADO',
    pdf_path,
    lineas_count: lineas.length,
    created_at: result.created_at,
  };
}

/**
 * Get print job by ID
 */
export async function getPrintJob(printJobId: string): Promise<PrintJobResult | null> {
  const printJob = await prisma.printJob.findUnique({
    where: { id: printJobId },
    include: {
      _count: {
        select: {
          items: true,
        },
      },
    },
  });

  if (!printJob) return null;

  return {
    id: printJob.id,
    tipo: printJob.tipo as PrintJobTipo,
    actor_user_id: printJob.actor_user_id,
    ruta_norm: printJob.ruta_norm,
    turno_id: printJob.turno_id,
    status: printJob.status as PrintJobStatus,
    pdf_path: printJob.pdf_path || '',
    lineas_count: printJob._count.items,
    created_at: printJob.created_at,
  };
}

/**
 * Get print jobs for a route in a turno
 */
export async function getPrintJobsForRuta(
  turnoId: string,
  rutaNorm: string
): Promise<PrintJobResult[]> {
  const printJobs = await prisma.printJob.findMany({
    where: {
      turno_id: turnoId,
      ruta_norm: rutaNorm,
    },
    include: {
      _count: {
        select: {
          items: true,
        },
      },
    },
    orderBy: {
      created_at: 'desc',
    },
  });

  return printJobs.map(pj => ({
    id: pj.id,
    tipo: pj.tipo as PrintJobTipo,
    actor_user_id: pj.actor_user_id,
    ruta_norm: pj.ruta_norm,
    turno_id: pj.turno_id,
    status: pj.status as PrintJobStatus,
    pdf_path: pj.pdf_path || '',
    lineas_count: pj._count.items,
    created_at: pj.created_at,
  }));
}

/**
 * Update print job status
 */
export async function updatePrintJobStatus(
  printJobId: string,
  status: PrintJobStatus,
  errorText?: string
): Promise<void> {
  await prisma.printJob.update({
    where: { id: printJobId },
    data: {
      status,
      error_text: errorText,
    },
  });
}
