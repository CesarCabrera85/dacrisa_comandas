import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// HMAC for code lookup
function createCodeLookup(code: string): Buffer {
  const secret = process.env.CODE_LOOKUP_SECRET || 'lookupsecret123456789012345678901';
  return crypto.createHmac('sha256', secret).update(code).digest();
}

// AES-256-GCM encryption
function encryptCode(code: string): { encrypted: Buffer; iv: Buffer; tag: Buffer } {
  const keyHex = process.env.CODE_ENC_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(12);
  
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  
  return { encrypted, iv, tag };
}

interface UserSeed {
  codigo: string;
  nombre: string;
  rol_tag: string;
  estado: string;
}

const users: UserSeed[] = [
  { codigo: '1234', nombre: 'Operario Test', rol_tag: 'OPERARIO', estado: 'ACTIVO' },
  { codigo: '2345', nombre: 'Colecta Test', rol_tag: 'COLECTA', estado: 'ACTIVO' },
  { codigo: '3456', nombre: 'Jefe Test', rol_tag: 'JEFE', estado: 'ACTIVO' },
  { codigo: '4567', nombre: 'Calidad Test', rol_tag: 'CALIDAD', estado: 'ACTIVO' },
  { codigo: '9999', nombre: 'Admin Test', rol_tag: 'DIOS', estado: 'ACTIVO' },
  { codigo: '0000', nombre: 'Techo Monitor', rol_tag: 'PANTALLA_TECHO', estado: 'ACTIVO' },
];

async function main() {
  console.log('🌱 Seeding database...');
  
  for (const user of users) {
    const codigoHash = await argon2.hash(user.codigo);
    
    const codigoLookup = createCodeLookup(user.codigo);
    const { encrypted, iv, tag } = encryptCode(user.codigo);
    
    // Upsert to avoid duplicates
    await prisma.usuario.upsert({
      where: { codigo_lookup: codigoLookup },
      update: {
        nombre: user.nombre,
        rol_tag: user.rol_tag,
        estado: user.estado,
        codigo_hash: codigoHash,
        codigo_enc: encrypted,
        codigo_enc_iv: iv,
        codigo_enc_tag: tag,
      },
      create: {
        nombre: user.nombre,
        rol_tag: user.rol_tag,
        estado: user.estado,
        codigo_lookup: codigoLookup,
        codigo_hash: codigoHash,
        codigo_enc: encrypted,
        codigo_enc_iv: iv,
        codigo_enc_tag: tag,
      },
    });
    
    console.log(`  ✓ Created user: ${user.nombre} (${user.rol_tag}) - code: ${user.codigo}`);
  }
  
  // Seed codigo_funcional_def (Product Families)
  const funcionalDefs = [
    { codigo_funcional: 1, nombre: 'FRESCO', descripcion: 'Productos frescos y refrigerados' },
    { codigo_funcional: 2, nombre: 'CONGELADO', descripcion: 'Productos congelados' },
    { codigo_funcional: 3, nombre: 'SECO', descripcion: 'Productos secos y de despensa' },
    { codigo_funcional: 4, nombre: 'BEBIDAS', descripcion: 'Bebidas y líquidos' },
    { codigo_funcional: 5, nombre: 'LIMPIEZA', descripcion: 'Productos de limpieza e higiene' },
    { codigo_funcional: 6, nombre: 'OTROS', descripcion: 'Otros productos' },
  ];
  
  for (const def of funcionalDefs) {
    await prisma.codigoFuncionalDef.upsert({
      where: { codigo_funcional: def.codigo_funcional },
      update: def,
      create: def,
    });
  }
  console.log('  ✓ Created codigo_funcional_def entries');
  
  // Seed turno_horario
  const horarios = [
    { franja: 'MANANA', start_time: new Date('1970-01-01T06:00:00'), end_time: new Date('1970-01-01T14:00:00') },
    { franja: 'TARDE', start_time: new Date('1970-01-01T14:00:00'), end_time: new Date('1970-01-01T22:00:00') },
    { franja: 'NOCHE', start_time: new Date('1970-01-01T22:00:00'), end_time: new Date('1970-01-01T06:00:00') },
  ];
  
  for (const horario of horarios) {
    const existing = await prisma.turnoHorario.findFirst({
      where: { franja: horario.franja, activo: true },
    });
    
    if (!existing) {
      await prisma.turnoHorario.create({
        data: horario,
      });
    }
  }
  console.log('  ✓ Created turno_horario entries');
  
  console.log('✅ Seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
