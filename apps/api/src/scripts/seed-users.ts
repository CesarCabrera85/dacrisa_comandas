import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

// Load env variables
dotenv.config();

const prisma = new PrismaClient();

// HMAC for code lookup
function createCodeLookup(code: string): Buffer {
  const secret = process.env.CODE_LOOKUP_SECRET;
  if (!secret) throw new Error('CODE_LOOKUP_SECRET not set');
  return crypto.createHmac('sha256', secret).update(code).digest();
}

// AES-256-GCM encryption
function encryptCode(code: string): { encrypted: Buffer; iv: Buffer; tag: Buffer } {
  const keyHex = process.env.CODE_ENC_KEY;
  if (!keyHex) throw new Error('CODE_ENC_KEY not set');
  
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(12);
  
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  
  return { encrypted, iv, tag };
}

interface UserSeed {
  nombre: string;
  codigo: string;
  rol: string;
}

const users: UserSeed[] = [
  { nombre: 'Operario 1', codigo: process.env.CODE_OPERARIO_1!, rol: 'OPERARIO' },
  { nombre: 'Operario 2', codigo: process.env.CODE_OPERARIO_2!, rol: 'OPERARIO' },
  { nombre: 'Operario 3', codigo: process.env.CODE_OPERARIO_3!, rol: 'OPERARIO' },
  { nombre: 'Operario 4', codigo: process.env.CODE_OPERARIO_4!, rol: 'OPERARIO' },
  { nombre: 'Operario 5', codigo: process.env.CODE_OPERARIO_5!, rol: 'OPERARIO' },
  { nombre: 'Operario 6', codigo: process.env.CODE_OPERARIO_6!, rol: 'OPERARIO' },
  { nombre: 'Jefe Mañana', codigo: process.env.CODE_JEFE_MANANA!, rol: 'JEFE' },
  { nombre: 'Jefe Tarde', codigo: process.env.CODE_JEFE_TARDE!, rol: 'JEFE' },
  { nombre: 'Jefe Noche', codigo: process.env.CODE_JEFE_NOCHE!, rol: 'JEFE' },
  { nombre: 'Colecta 1', codigo: process.env.CODE_COLECTA_1!, rol: 'COLECTA' },
  { nombre: 'Calidad 1', codigo: process.env.CODE_CALIDAD_1!, rol: 'CALIDAD' },
  { nombre: 'Administrador', codigo: process.env.CODE_DIOS!, rol: 'DIOS' },
];

async function seedUsers() {
  console.log('🌱 Iniciando seed de usuarios...');
  
  try {
    for (const user of users) {
      if (!user.codigo) {
        console.log(`⚠️  Código no definido para "${user.nombre}", saltando...`);
        continue;
      }
      
      // Create lookup hash for the code
      const codigoLookup = createCodeLookup(user.codigo);
      
      // Check if user already exists (by lookup or name)
      const existingByLookup = await prisma.usuario.findFirst({
        where: { codigo_lookup: codigoLookup }
      });
      
      const existingByName = await prisma.usuario.findFirst({
        where: { nombre: user.nombre }
      });
      
      if (existingByLookup || existingByName) {
        console.log(`⏭️  Usuario "${user.nombre}" ya existe, saltando...`);
        continue;
      }
      
      // Hash password with Argon2id
      const codigoHash = await argon2.hash(user.codigo);
      
      // Encrypt with AES-256-GCM
      const { encrypted, iv, tag } = encryptCode(user.codigo);
      
      // Create user
      await prisma.usuario.create({
        data: {
          nombre: user.nombre,
          codigo_lookup: codigoLookup,
          codigo_hash: codigoHash,
          codigo_enc: encrypted,
          codigo_enc_iv: iv,
          codigo_enc_tag: tag,
          rol_tag: user.rol,
          estado: 'ACTIVO'
        }
      });
      
      console.log(`✅ Usuario "${user.nombre}" creado (rol: ${user.rol})`);
    }
    
    console.log('🎉 Seed completado exitosamente');
  } catch (error) {
    console.error('❌ Error en seed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedUsers();
