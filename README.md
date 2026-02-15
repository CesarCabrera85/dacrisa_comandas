# DACRISA Comandas

Sistema web industrial para gestión de pedidos con ingesta IMAP, asignación determinista a operarios, y generación de comandas en PDF.

## Stack Tecnológico

- **Backend:** Node.js 20 + TypeScript + Fastify
- **Base de datos:** PostgreSQL 16 + Prisma ORM
- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS
- **Autenticación:** Server-side sessions en PostgreSQL, httpOnly cookie

## Estructura del Monorepo

```
dacrisa_comandas/
├── apps/
│   ├── api/          # Backend Fastify
│   │   ├── src/
│   │   │   ├── lib/       # Prisma, crypto, sessions
│   │   │   ├── middleware/ # Auth middleware
│   │   │   └── routes/    # API routes
│   │   └── prisma/        # Schema y migraciones
│   └── web/          # Frontend React Vite
│       └── src/
│           ├── components/
│           ├── context/   # AuthContext
│           └── pages/     # LockScreen, role views
└── packages/
    └── shared/       # Tipos TypeScript compartidos
```

## Configuración

### Variables de Entorno (apps/api/.env)

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dacrisa_comandas
NODE_ENV=development
CODE_ENC_KEY=<64 caracteres hex para AES-256>
SESSION_SECRET=<32+ caracteres>
CODE_LOOKUP_SECRET=<32+ caracteres>
```

## Inicio Rápido

### 1. Instalar dependencias
```bash
npm install
```

### 2. Iniciar PostgreSQL con Docker
```bash
docker compose up db -d
```

### 3. Ejecutar migraciones
```bash
cd apps/api
npx prisma migrate dev
```

### 4. Sembrar datos de prueba
```bash
npm run prisma:seed -w @dacrisa/api
```

### 5. Iniciar en modo desarrollo
```bash
# Terminal 1 - API
npm run dev:api

# Terminal 2 - Web
npm run dev:web
```

## Usuarios de Prueba

| Rol | Código | Nombre |
|-----|--------|--------|
| OPERARIO | 1234 | Operario Test |
| COLECTA | 2345 | Colecta Test |
| JEFE | 3456 | Jefe Test |
| CALIDAD | 4567 | Calidad Test |
| DIOS | 9999 | Admin Test |
| PANTALLA_TECHO | 0000 | Techo Monitor |

## API Endpoints

### Autenticación

#### POST /api/auth/login
Iniciar sesión con código numérico.

**Request:**
```json
{ "code": "1234" }
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "nombre": "Operario Test",
    "rol_tag": "OPERARIO",
    "estado": "ACTIVO"
  }
}
```

**Errores:**
- `401 AUTH_INVALID` - Código inválido
- `403 AUTH_USER_INACTIVE` - Usuario inactivo o de baja temporal

#### POST /api/auth/logout
Cerrar sesión actual.

#### GET /api/auth/me
Obtener usuario actual (requiere autenticación).

### Health Check

#### GET /api/health
```json
{
  "status": "ok",
  "timestamp": "2024-02-15T10:30:00.000Z"
}
```

## Roles del Sistema

| Rol | Acceso |
|-----|--------|
| OPERARIO | Ver y imprimir sus comandas asignadas |
| COLECTA | Gestionar recolección por ruta |
| JEFE | Supervisión + funciones de OPERARIO y COLECTA |
| CALIDAD | Configuración de turnos y catálogos |
| DIOS | Acceso total al sistema |
| PANTALLA_TECHO | Vista de monitoreo (solo lectura) |

## Docker

### Levantar todos los servicios
```bash
docker compose up -d
```

### Servicios
- **db:** PostgreSQL 16 en puerto 5432
- **api:** Backend en puerto 3001
- **web:** Frontend en puerto 5173

## Base de Datos (25 tablas)

1. usuarios
2. usuario_familia_permitida
3. turno_horario
4. turnos
5. turno_usuario_familia_habilitada
6. codigo_funcional_def
7. rutas_master_version
8. rutas_master
9. productos_master_version
10. productos_master
11. ruta_dia
12. colecta_asignacion
13. lote
14. pedido_cliente
15. linea
16. owner_afinidad
17. rr_cursor
18. operario_ruta_progress
19. colecta_ruta_progress
20. print_jobs
21. print_job_items
22. eventos
23. sessions
24. feature_flags
25. imap_state

## Licencia

Privado - DACRISA
