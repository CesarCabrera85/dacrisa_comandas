/**
 * PDF Generator Module
 * Generates thermal (80mm) and A4 PDFs for comandas printing
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PDF Configuration
const THERMAL_WIDTH_MM = parseInt(process.env.PDF_THERMAL_WIDTH_MM || '80', 10);
const THERMAL_PAGE_HEIGHT_MM = parseInt(process.env.PDF_THERMAL_PAGE_HEIGHT_MM || '300', 10);
const A4_WIDTH_MM = parseInt(process.env.PDF_A4_WIDTH_MM || '210', 10);
const A4_HEIGHT_MM = parseInt(process.env.PDF_A4_HEIGHT_MM || '297', 10);
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

// Convert mm to points (1mm = 2.83465 points)
const MM_TO_POINTS = 2.83465;

const THERMAL_WIDTH = THERMAL_WIDTH_MM * MM_TO_POINTS; // ~226.77 points
const THERMAL_HEIGHT = THERMAL_PAGE_HEIGHT_MM * MM_TO_POINTS; // ~850.39 points
const THERMAL_MARGIN = 5 * MM_TO_POINTS; // 5mm margin ~14.17 points

const A4_WIDTH = A4_WIDTH_MM * MM_TO_POINTS; // ~595 points
const A4_HEIGHT = A4_HEIGHT_MM * MM_TO_POINTS; // ~842 points
const A4_MARGIN = 20 * MM_TO_POINTS; // 20mm margin ~56.69 points

// Types
export interface LineaConDatos {
  id: string;
  lote_id: string;
  pedido_cliente_id: string;
  cliente_nombre: string;
  cliente_codigo: string;
  observaciones: string | null;
  producto_nombre: string;
  producto_norm: string;
  cantidad: number;
  unidad: string;
  precio: number | null;
  linea_observacion: string | null;
}

export interface PDFMetadata {
  tipo: 'OPERARIO_INICIAL' | 'OPERARIO_NUEVOS' | 'COLECTA_NUEVOS';
  usuario_nombre?: string;
  ruta_nombre: string;
  fecha: string;
}

// Ensure PDF directory exists
function ensurePdfDirectory(): string {
  const pdfDir = path.join(__dirname, '../../../uploads/pdf');
  if (!fs.existsSync(pdfDir)) {
    fs.mkdirSync(pdfDir, { recursive: true });
  }
  return pdfDir;
}

// Generate unique filename
function generateFilename(prefix: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const uuid = crypto.randomUUID();
  return `${prefix}_${timestamp}_${uuid}.pdf`;
}

/**
 * Generate a thermal PDF (80mm x 300mm) for operario printing
 * @param lineas Array of lines with product, client, quantity data
 * @param metadata PDF metadata (type, user, route, date)
 * @returns URL path to the generated PDF
 */
export async function generateThermalPDF(
  lineas: LineaConDatos[],
  metadata: PDFMetadata
): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfDir = ensurePdfDirectory();
    const filename = generateFilename(`thermal_${metadata.tipo.toLowerCase()}`);
    const filePath = path.join(pdfDir, filename);
    const urlPath = `/uploads/pdf/${filename}`;

    const doc = new PDFDocument({
      size: [THERMAL_WIDTH, THERMAL_HEIGHT],
      margins: {
        top: THERMAL_MARGIN,
        bottom: THERMAL_MARGIN,
        left: THERMAL_MARGIN,
        right: THERMAL_MARGIN,
      },
      bufferPages: true,
    });

    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    const contentWidth = THERMAL_WIDTH - (THERMAL_MARGIN * 2);
    const pageHeight = THERMAL_HEIGHT - (THERMAL_MARGIN * 2);
    let currentY = THERMAL_MARGIN;
    let pageNum = 1;
    
    // Calculate total pages needed (estimate)
    const headerHeight = 80;
    const lineHeight = 60;
    const estimatedPagesNeeded = Math.ceil((lineas.length * lineHeight + headerHeight) / pageHeight);

    // Function to draw header
    function drawHeader() {
      currentY = THERMAL_MARGIN;
      
      // Title
      doc.font('Helvetica-Bold').fontSize(12);
      doc.text('DACRISA COMANDAS', THERMAL_MARGIN, currentY, { width: contentWidth, align: 'center' });
      currentY += 16;

      // Route
      doc.font('Helvetica').fontSize(9);
      doc.text(`Ruta: ${metadata.ruta_nombre}`, THERMAL_MARGIN, currentY, { width: contentWidth });
      currentY += 12;

      // Operator (if exists)
      if (metadata.usuario_nombre) {
        doc.text(`Operario: ${metadata.usuario_nombre}`, THERMAL_MARGIN, currentY, { width: contentWidth });
        currentY += 12;
      }

      // Date
      doc.text(`Fecha: ${metadata.fecha}`, THERMAL_MARGIN, currentY, { width: contentWidth });
      currentY += 12;

      // Page number
      doc.text(`Página: ${pageNum}/${estimatedPagesNeeded}`, THERMAL_MARGIN, currentY, { width: contentWidth });
      currentY += 14;

      // Separator line
      doc.moveTo(THERMAL_MARGIN, currentY).lineTo(THERMAL_WIDTH - THERMAL_MARGIN, currentY).stroke();
      currentY += 8;
    }

    // Function to check if we need a new page
    function checkNewPage(requiredHeight: number): boolean {
      if (currentY + requiredHeight > THERMAL_HEIGHT - THERMAL_MARGIN) {
        doc.addPage();
        pageNum++;
        drawHeader();
        return true;
      }
      return false;
    }

    // Draw first header
    drawHeader();

    // Group lines by client for better organization
    const clientGroups = new Map<string, LineaConDatos[]>();
    for (const linea of lineas) {
      const key = linea.pedido_cliente_id;
      if (!clientGroups.has(key)) {
        clientGroups.set(key, []);
      }
      clientGroups.get(key)!.push(linea);
    }

    // Draw each client and their lines
    for (const [clienteId, clienteLineas] of clientGroups) {
      const primeraLinea = clienteLineas[0];
      
      // Estimate height needed for this client block
      const clientBlockHeight = 24 + (clienteLineas.length * 26) + (primeraLinea.observaciones ? 14 : 0);
      checkNewPage(clientBlockHeight);

      // Client name
      doc.font('Helvetica-Bold').fontSize(9);
      const clienteName = primeraLinea.cliente_nombre || primeraLinea.cliente_codigo;
      doc.text(`Cliente: ${clienteName}`, THERMAL_MARGIN, currentY, { width: contentWidth });
      currentY += 12;

      // Client observations (if any)
      if (primeraLinea.observaciones) {
        doc.font('Helvetica-Oblique').fontSize(7);
        doc.text(`Obs: ${primeraLinea.observaciones}`, THERMAL_MARGIN, currentY, { width: contentWidth });
        currentY += 10;
      }

      // Draw lines for this client
      for (const linea of clienteLineas) {
        checkNewPage(30);

        // Product line: quantity unit - product
        doc.font('Helvetica').fontSize(8);
        const lineText = `${linea.cantidad} ${linea.unidad} - ${linea.producto_nombre}`;
        doc.text(lineText, THERMAL_MARGIN + 4, currentY, { width: contentWidth - 4 });
        currentY += 12;

        // Line observation if any
        if (linea.linea_observacion) {
          doc.font('Helvetica-Oblique').fontSize(7);
          doc.text(`  Obs: ${linea.linea_observacion}`, THERMAL_MARGIN + 4, currentY, { width: contentWidth - 4 });
          currentY += 10;
        }
      }

      // Separator after client
      currentY += 4;
      doc.strokeColor('#aaaaaa').lineWidth(0.5);
      doc.moveTo(THERMAL_MARGIN, currentY).lineTo(THERMAL_WIDTH - THERMAL_MARGIN, currentY).stroke();
      doc.strokeColor('#000000').lineWidth(1);
      currentY += 8;
    }

    // Update page numbers in all pages
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      // Re-draw page number (overwrite)
      const pageY = THERMAL_MARGIN + 16 + 12 + (metadata.usuario_nombre ? 12 : 0) + 12;
      doc.font('Helvetica').fontSize(9);
      doc.fillColor('#ffffff').rect(THERMAL_MARGIN, pageY - 2, contentWidth, 14).fill();
      doc.fillColor('#000000');
      doc.text(`Página: ${i + 1}/${pages.count}`, THERMAL_MARGIN, pageY, { width: contentWidth });
    }

    doc.end();

    writeStream.on('finish', () => {
      resolve(urlPath);
    });

    writeStream.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Generate an A4 PDF for colecta printing
 * @param lineas Array of lines with product, client, quantity, price data
 * @param metadata PDF metadata (type, route, date)
 * @returns URL path to the generated PDF
 */
export async function generateA4PDF(
  lineas: LineaConDatos[],
  metadata: PDFMetadata
): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfDir = ensurePdfDirectory();
    const filename = generateFilename('a4_colecta');
    const filePath = path.join(pdfDir, filename);
    const urlPath = `/uploads/pdf/${filename}`;

    const doc = new PDFDocument({
      size: 'A4',
      margins: {
        top: A4_MARGIN,
        bottom: A4_MARGIN,
        left: A4_MARGIN,
        right: A4_MARGIN,
      },
      bufferPages: true,
    });

    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    const contentWidth = A4_WIDTH - (A4_MARGIN * 2);
    const pageHeight = A4_HEIGHT - (A4_MARGIN * 2);
    let currentY = A4_MARGIN;
    let pageNum = 1;

    // Column widths for the table
    const colWidths = {
      cliente: contentWidth * 0.25,
      producto: contentWidth * 0.35,
      cantidad: contentWidth * 0.10,
      unidad: contentWidth * 0.12,
      precio: contentWidth * 0.18,
    };

    // Function to draw header
    function drawHeader() {
      currentY = A4_MARGIN;

      // Title
      doc.font('Helvetica-Bold').fontSize(16);
      doc.text('DACRISA COMANDAS - COLECTA', A4_MARGIN, currentY, { width: contentWidth, align: 'center' });
      currentY += 24;

      // Route and date
      doc.font('Helvetica').fontSize(11);
      doc.text(`Ruta: ${metadata.ruta_nombre}`, A4_MARGIN, currentY);
      doc.text(`Fecha: ${metadata.fecha}`, A4_MARGIN + contentWidth / 2, currentY);
      currentY += 18;

      // Double line separator
      doc.lineWidth(2);
      doc.moveTo(A4_MARGIN, currentY).lineTo(A4_WIDTH - A4_MARGIN, currentY).stroke();
      currentY += 12;

      // Table header
      drawTableHeader();
    }

    // Function to draw table header
    function drawTableHeader() {
      doc.font('Helvetica-Bold').fontSize(10);
      let x = A4_MARGIN;

      doc.text('Cliente', x, currentY, { width: colWidths.cliente });
      x += colWidths.cliente;
      doc.text('Producto', x, currentY, { width: colWidths.producto });
      x += colWidths.producto;
      doc.text('Cant.', x, currentY, { width: colWidths.cantidad, align: 'right' });
      x += colWidths.cantidad;
      doc.text('Unidad', x, currentY, { width: colWidths.unidad, align: 'center' });
      x += colWidths.unidad;
      doc.text('Precio', x, currentY, { width: colWidths.precio, align: 'right' });

      currentY += 14;

      // Header separator line
      doc.lineWidth(0.5);
      doc.moveTo(A4_MARGIN, currentY).lineTo(A4_WIDTH - A4_MARGIN, currentY).stroke();
      currentY += 6;
    }

    // Function to check if we need a new page
    function checkNewPage(requiredHeight: number): boolean {
      if (currentY + requiredHeight > A4_HEIGHT - A4_MARGIN) {
        doc.addPage();
        pageNum++;
        drawHeader();
        return true;
      }
      return false;
    }

    // Draw first header
    drawHeader();

    // Group lines by client
    const clientGroups = new Map<string, LineaConDatos[]>();
    for (const linea of lineas) {
      const key = linea.pedido_cliente_id;
      if (!clientGroups.has(key)) {
        clientGroups.set(key, []);
      }
      clientGroups.get(key)!.push(linea);
    }

    let grandTotal = 0;

    // Draw each client and their lines
    for (const [clienteId, clienteLineas] of clientGroups) {
      const primeraLinea = clienteLineas[0];
      let clientTotal = 0;

      for (let i = 0; i < clienteLineas.length; i++) {
        const linea = clienteLineas[i];
        checkNewPage(16);

        doc.font('Helvetica').fontSize(9);
        let x = A4_MARGIN;

        // Client name only on first line
        const clienteName = i === 0 
          ? (primeraLinea.cliente_nombre || primeraLinea.cliente_codigo)
          : '';
        doc.text(clienteName, x, currentY, { width: colWidths.cliente - 4, lineBreak: false });
        x += colWidths.cliente;

        // Product
        doc.text(linea.producto_nombre.substring(0, 35), x, currentY, { width: colWidths.producto - 4, lineBreak: false });
        x += colWidths.producto;

        // Quantity
        doc.text(linea.cantidad.toString(), x, currentY, { width: colWidths.cantidad - 4, align: 'right' });
        x += colWidths.cantidad;

        // Unit
        doc.text(linea.unidad, x, currentY, { width: colWidths.unidad - 4, align: 'center' });
        x += colWidths.unidad;

        // Price
        const linePrice = linea.precio ? linea.precio * linea.cantidad : 0;
        clientTotal += linePrice;
        doc.text(linePrice > 0 ? linePrice.toFixed(2) + ' €' : '-', x, currentY, { width: colWidths.precio - 4, align: 'right' });

        currentY += 14;
      }

      // Client subtotal
      if (clientTotal > 0) {
        checkNewPage(20);
        doc.font('Helvetica-Bold').fontSize(9);
        doc.text(
          `Subtotal ${primeraLinea.cliente_nombre || primeraLinea.cliente_codigo}: ${clientTotal.toFixed(2)} €`,
          A4_MARGIN,
          currentY,
          { width: contentWidth, align: 'right' }
        );
        currentY += 16;
      }

      grandTotal += clientTotal;

      // Light separator between clients
      doc.strokeColor('#cccccc').lineWidth(0.3);
      doc.moveTo(A4_MARGIN, currentY).lineTo(A4_WIDTH - A4_MARGIN, currentY).stroke();
      doc.strokeColor('#000000');
      currentY += 8;
    }

    // Grand total
    checkNewPage(30);
    currentY += 8;
    doc.lineWidth(1);
    doc.moveTo(A4_MARGIN, currentY).lineTo(A4_WIDTH - A4_MARGIN, currentY).stroke();
    currentY += 8;

    doc.font('Helvetica-Bold').fontSize(12);
    doc.text(`TOTAL GENERAL: ${grandTotal.toFixed(2)} €`, A4_MARGIN, currentY, { width: contentWidth, align: 'right' });
    currentY += 20;

    // Total lines count
    doc.font('Helvetica').fontSize(10);
    doc.text(`Total líneas: ${lineas.length}`, A4_MARGIN, currentY);
    doc.text(`Total clientes: ${clientGroups.size}`, A4_MARGIN + 150, currentY);

    // Page numbers on all pages
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(8);
      doc.text(
        `Página ${i + 1} de ${pages.count}`,
        A4_MARGIN,
        A4_HEIGHT - A4_MARGIN + 10,
        { width: contentWidth, align: 'center' }
      );
    }

    doc.end();

    writeStream.on('finish', () => {
      resolve(urlPath);
    });

    writeStream.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Get full URL for a PDF path
 */
export function getPdfFullUrl(pdfPath: string): string {
  return `${BASE_URL}${pdfPath}`;
}
