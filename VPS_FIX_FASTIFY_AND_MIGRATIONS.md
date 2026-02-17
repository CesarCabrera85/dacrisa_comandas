# Fix Fastify + Ejecutar Migraciones

## Problema 1: Fastify version mismatch
API en boot loop debido a incompatibilidad de versiones:
```
FastifyError: @fastify/multipart - expected '5.x' fastify version, '4.29.1' is installed
```

## Problema 2: Base de datos sin schema
```
ERROR: column "rol" does not exist
```

## Solución

### 1. Pull del fix de Fastify
```bash
cd /opt/dacrisa_comandas
git pull origin main
```

### 2. Rebuild del API
```bash
docker compose build --no-cache api
```

### 3. Levantar servicios
```bash
docker compose up -d
```

### 4. Verificar que API inicia correctamente
```bash
docker compose logs -f api
```

**Buscar:**
- "Server listening on http://0.0.0.0:3001" ✓
- Sin errores de Fastify ✓

### 5. Ejecutar migraciones de Prisma
```bash
docker compose exec api npx prisma migrate deploy
```

**Salida esperada:**
```
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database
2 migrations found in prisma/migrations
Applying migration `20260215150857_init`
...
All migrations have been successfully applied.
```

### 6. Verificar schema en base de datos
```bash
docker compose exec db psql -U postgres -d dacrisa_comandas -c "\dt"
```

### 7. Ejecutar seed de usuarios
```bash
docker compose exec api npm run seed
```

### 8. Verificar usuarios creados
```bash
docker compose exec db psql -U postgres -d dacrisa_comandas -c "SELECT id, nombre, rol, estado FROM usuarios ORDER BY id;"
```

### 9. Probar login
```bash
curl -i -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"codigo":"270885"}'
```

### 10. Verificar en navegador
```
http://212.227.99.184/
Login con código: 270885
```

## Versiones Actualizadas
- `fastify`: ^5.2.0
- `@fastify/cookie`: ^10.0.1
- `@fastify/cors`: ^10.0.1
- `@fastify/multipart`: ^9.0.1
- `@fastify/static`: ^8.0.2
- `fastify-plugin`: ^5.0.1
- `@prisma/client`: ^6.2.0
- `prisma`: ^6.2.0
