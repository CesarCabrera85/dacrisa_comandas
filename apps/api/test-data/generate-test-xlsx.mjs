/**
 * Script to generate test XLSX files for masterdata
 * Run with: node generate-test-xlsx.mjs
 */

import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function generateProductosXLSX() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Productos');
  
  // Add header
  worksheet.addRow(['Producto', 'Familia']);
  
  // Add sample data
  const productos = [
    ['Leche Entera', '1'],
    ['Yogur Natural', '1'],
    ['Queso Fresco', '1'],
    ['Helado Vainilla', '2'],
    ['Pizza Congelada', '2'],
    ['Verduras Congeladas', '2'],
    ['Pan Integral', '3'],
    ['Arroz Blanco', '3'],
    ['Pasta Spaghetti', '3'],
    ['Café Molido', '3'],
    ['Agua Mineral', '4'],
    ['Zumo de Naranja', '4'],
    ['Refresco Cola', '4'],
    ['Cerveza', '4'],
    ['Detergente Líquido', '5'],
    ['Jabón de Manos', '5'],
    ['Lejía', '5'],
    ['Papel Higiénico', '6'],
    ['Servilletas', '6'],
    ['Bolsas Basura', '6'],
  ];
  
  for (const row of productos) {
    worksheet.addRow(row);
  }
  
  // Style header
  worksheet.getRow(1).font = { bold: true };
  worksheet.columns = [
    { width: 30 },
    { width: 15 },
  ];
  
  const filepath = path.join(__dirname, 'productos_ejemplo.xlsx');
  await workbook.xlsx.writeFile(filepath);
  console.log(`✓ Created: ${filepath}`);
}

async function generateProductosConflictoXLSX() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Productos');
  
  worksheet.addRow(['Producto', 'Familia']);
  
  // Add data with family conflict (same product, different families)
  const productos = [
    ['Leche', '1'],        // FRESCO
    ['Yogur', '1'],
    ['Leche', '2'],        // CONFLICT: Same product in CONGELADO
    ['Pan', '3'],
  ];
  
  for (const row of productos) {
    worksheet.addRow(row);
  }
  
  const filepath = path.join(__dirname, 'productos_conflicto.xlsx');
  await workbook.xlsx.writeFile(filepath);
  console.log(`✓ Created: ${filepath}`);
}

async function generateRutasXLSX() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Rutas');
  
  worksheet.addRow(['Ruta', 'Orden']);
  
  const rutas = [
    ['Ruta Norte', '1'],
    ['Ruta Sur', '2'],
    ['Ruta Este', '3'],
    ['Ruta Oeste', '4'],
    ['Ruta Centro', '5'],
    ['Zona Industrial', '6'],
    ['Polígono A', '7'],
    ['Polígono B', '8'],
    ['Mercado Central', '9'],
    ['Supermercados XL', '10'],
  ];
  
  for (const row of rutas) {
    worksheet.addRow(row);
  }
  
  worksheet.getRow(1).font = { bold: true };
  worksheet.columns = [
    { width: 25 },
    { width: 10 },
  ];
  
  const filepath = path.join(__dirname, 'rutas_ejemplo.xlsx');
  await workbook.xlsx.writeFile(filepath);
  console.log(`✓ Created: ${filepath}`);
}

async function generateRutasVaciaXLSX() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Rutas');
  
  // Only header, no data
  worksheet.addRow(['Ruta', 'Orden']);
  
  const filepath = path.join(__dirname, 'rutas_vacia.xlsx');
  await workbook.xlsx.writeFile(filepath);
  console.log(`✓ Created: ${filepath}`);
}

async function main() {
  console.log('Generating test XLSX files...\n');
  
  await generateProductosXLSX();
  await generateProductosConflictoXLSX();
  await generateRutasXLSX();
  await generateRutasVaciaXLSX();
  
  console.log('\n✅ All test files generated!');
}

main().catch(console.error);
