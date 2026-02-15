# DACRISA Comandas - Guía de Despliegue

## Índice

1. [Requisitos](#requisitos)
2. [Despliegue Local (Desarrollo)](#despliegue-local-desarrollo)
3. [Despliegue en Producción (VPS con HTTPS)](#despliegue-en-producción-vps-con-https)
4. [Comandos Útiles](#comandos-útiles)
5. [Troubleshooting](#troubleshooting)
6. [Monitoreo](#monitoreo)
7. [Seguridad](#seguridad)

---

## Requisitos

- **Docker** versión 20.10 o superior
- **Docker Compose** versión 2.0 o superior
- **Dominio** apuntando al servidor (para HTTPS en producción)
- **Puertos** 80 y 443 abiertos en el firewall

---

## Despliegue Local (Desarrollo)

### 1. Clonar repositorio

```bash
git clone <repo-url>
cd dacrisa_comandas
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con tus valores (para local, los defaults funcionan)
```

### 3. Levantar servicios

```bash
docker compose up -d --build
```

### 4. Ejecutar migraciones (primera vez)

```bash
docker compose exec api npx prisma migrate deploy
docker compose exec api npx prisma db seed
```

### 5. Acceder a la aplicación

- **Frontend:** https://localhost (aceptar certificado self-signed)
- **API:** https://localhost/api

### 6. Usuarios de prueba

| Rol | Código |
|-----|--------|
| DIOS | 9999 |
| JEFE | 1111 |
| CALIDAD | 2222 |
| OPERARIO | 3333 |
| COLECTA | 4444 |
| PANTALLA_TECHO | 5555 |

---

## Despliegue en Producción (VPS con HTTPS)

### 1. Preparar VPS (Ubuntu/Debian)

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
rm get-docker.sh

# Instalar Docker Compose (si no viene incluido)
sudo apt install docker-compose-plugin -y

# Agregar usuario al grupo docker
sudo usermod -aG docker $USER
# IMPORTANTE: Cerrar sesión y volver a entrar para aplicar cambios
```

### 2. Configurar DNS

Apuntar tu dominio al IP del VPS creando registros A:

| Tipo | Nombre | Valor |
|------|--------|-------|
| A | example.com | IP_DEL_VPS |
| A | www.example.com | IP_DEL_VPS |

*Esperar propagación DNS (puede tomar hasta 24h, normalmente minutos)*

### 3. Clonar y configurar

```bash
# Clonar repositorio
git clone <repo-url>
cd dacrisa_comandas

# Configurar variables de entorno
cp .env.example .env
nano .env
```

### 4. Configuración de .env para producción

**⚠️ IMPORTANTE: Cambiar TODOS los secrets!**

```env
# Domain (tu dominio real)
DOMAIN=comandas.tuempresa.com
ACME_EMAIL=admin@tuempresa.com

# URLs
BASE_URL=https://comandas.tuempresa.com
VITE_API_URL=/api

# Database (cambiar password!)
POSTGRES_PASSWORD=<contraseña-segura-generada>

# Security (generar nuevos valores!)
# Ejecutar: openssl rand -hex 32
CODE_ENC_KEY=<64-caracteres-hex>
# Ejecutar: openssl rand -hex 16
SESSION_SECRET=<32-caracteres-hex>
CODE_LOOKUP_SECRET=<32-caracteres-hex>

# IMAP (configurar con credenciales reales)
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=pedidos@tuempresa.com
IMAP_PASSWORD=<tu-app-password>
IMAP_FOLDER=INBOX
IMAP_POLL_SECONDS=15
IMAP_SECURE=true

# Environment
NODE_ENV=production
```

### 5. Generar secrets seguros

```bash
# Para CODE_ENC_KEY (64 caracteres hex = 32 bytes)
openssl rand -hex 32

# Para SESSION_SECRET y CODE_LOOKUP_SECRET (32 caracteres hex)
openssl rand -hex 16
```

### 6. Build y deploy

```bash
# Construir y levantar todos los servicios
docker compose up -d --build

# Ver logs para verificar que todo arranca correctamente
docker compose logs -f
```

### 7. Ejecutar migraciones y seed

```bash
# Aplicar migraciones de base de datos
docker compose exec api npx prisma migrate deploy

# Crear usuarios iniciales (opcional, solo primera vez)
docker compose exec api npx prisma db seed
```

### 8. Verificar HTTPS

Caddy obtendrá automáticamente certificados de Let's Encrypt.

1. Esperar 1-2 minutos después de iniciar
2. Verificar logs de Caddy: `docker compose logs caddy`
3. Acceder a: `https://tudominio.com`

---

## Comandos Útiles

### Ver logs

```bash
# Todos los servicios
docker compose logs -f

# Servicio específico
docker compose logs -f api
docker compose logs -f web
docker compose logs -f caddy
docker compose logs -f db
```

### Gestión de servicios

```bash
# Reiniciar un servicio
docker compose restart api
docker compose restart web

# Detener servicios
docker compose down

# Detener y eliminar volúmenes (⚠️ ELIMINA DATOS!)
docker compose down -v

# Ver estado
docker compose ps
```

### Actualizar aplicación

```bash
# Obtener últimos cambios
git pull

# Reconstruir y reiniciar
docker compose up -d --build

# Aplicar nuevas migraciones si las hay
docker compose exec api npx prisma migrate deploy
```

### Backup de base de datos

```bash
# Crear backup
docker compose exec db pg_dump -U postgres dacrisa_comandas > backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurar backup
docker compose exec -T db psql -U postgres dacrisa_comandas < backup.sql
```

### Acceso a base de datos

```bash
# Conectar con psql
docker compose exec db psql -U postgres -d dacrisa_comandas

# Ejemplos de queries útiles
# Ver últimos eventos
SELECT tipo, entidad_tipo, ts FROM eventos ORDER BY ts DESC LIMIT 10;

# Ver rutas del turno activo
SELECT r.ruta_norm, r.estado_visual, r.estado_logico 
FROM ruta_dia r 
JOIN turnos t ON r.turno_id = t.id 
WHERE t.estado = 'ACTIVO';

# Ver usuarios
SELECT nombre, rol_tag, estado FROM usuarios;
```

---

## Troubleshooting

### Error: "Address already in use"

Otro servicio está usando el puerto 80 o 443.

```bash
# Ver qué está usando el puerto
sudo lsof -i :80
sudo lsof -i :443

# Detener el servicio conflictivo (ej: nginx)
sudo systemctl stop nginx
sudo systemctl disable nginx
```

### Error: "Certificate not valid"

- Esperar 2-3 minutos para que Let's Encrypt emita el certificado
- Verificar que el dominio apunta correctamente al servidor
- Verificar logs de Caddy: `docker compose logs caddy`

### Error: "Cannot connect to database"

```bash
# Verificar que el servicio db está corriendo
docker compose ps db

# Ver logs de la base de datos
docker compose logs db

# Reiniciar base de datos
docker compose restart db
```

### SSE no funciona (eventos no llegan)

1. Verificar conexión en la UI (indicador verde/rojo)
2. Verificar que Caddy no está buffering:
   ```bash
   docker compose logs caddy | grep -i buffer
   ```
3. Probar endpoint directamente:
   ```bash
   curl -N https://tudominio.com/api/eventos/stream
   ```

### Error de autenticación

```bash
# Verificar cookies y sessions
docker compose exec api npx prisma studio
# Navegar a la tabla sessions
```

### Container se reinicia constantemente

```bash
# Ver logs detallados
docker compose logs --tail=100 api

# Verificar variables de entorno
docker compose exec api env | grep -E "(DATABASE|SECRET|KEY)"
```

---

## Monitoreo

### Ver eventos en tiempo real

```bash
# Conectar a la base de datos
docker compose exec db psql -U postgres -d dacrisa_comandas

# Últimos 10 eventos
SELECT tipo, entidad_tipo, entidad_id, ts 
FROM eventos 
ORDER BY ts DESC 
LIMIT 10;

# Eventos de las últimas 2 horas
SELECT tipo, COUNT(*) as cantidad 
FROM eventos 
WHERE ts > NOW() - INTERVAL '2 hours'
GROUP BY tipo 
ORDER BY cantidad DESC;
```

### Estado del turno activo

```sql
-- Turno activo
SELECT id, fecha, franja, estado, started_at 
FROM turnos 
WHERE estado = 'ACTIVO';

-- Resumen de rutas
SELECT estado_visual, COUNT(*) as cantidad 
FROM ruta_dia 
WHERE turno_id = (SELECT id FROM turnos WHERE estado = 'ACTIVO')
GROUP BY estado_visual;
```

### Healthcheck API

```bash
curl https://tudominio.com/api/health
# Debería devolver: {"status":"ok","timestamp":"..."}
```

---

## Seguridad

### 1. Secrets seguros

**NUNCA usar los valores de ejemplo en producción!**

```bash
# Generar nuevos secrets
openssl rand -hex 32  # CODE_ENC_KEY
openssl rand -hex 16  # SESSION_SECRET
openssl rand -hex 16  # CODE_LOOKUP_SECRET
openssl rand -base64 24  # POSTGRES_PASSWORD
```

### 2. Firewall

```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP (redirect to HTTPS)
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
sudo ufw status
```

### 3. Actualizaciones

```bash
# Sistema operativo (mensual)
sudo apt update && sudo apt upgrade -y

# Aplicación (cuando haya cambios)
git pull
docker compose up -d --build

# Imágenes Docker (mensual)
docker compose pull
docker compose up -d
```

### 4. Backups automáticos

Crear script `/opt/backup-dacrisa.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/opt/backups/dacrisa"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
cd /path/to/dacrisa_comandas

# Backup database
docker compose exec -T db pg_dump -U postgres dacrisa_comandas > $BACKUP_DIR/db_$DATE.sql

# Compress
gzip $BACKUP_DIR/db_$DATE.sql

# Delete backups older than 7 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: db_$DATE.sql.gz"
```

Agregar a cron:
```bash
# Ejecutar diariamente a las 3am
0 3 * * * /opt/backup-dacrisa.sh >> /var/log/dacrisa-backup.log 2>&1
```

---

## Arquitectura de Servicios

```
┌─────────────────────────────────────────────────────────┐
│                      Internet                            │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    Caddy (HTTPS)                         │
│                   Ports: 80, 443                         │
│            Auto-certificados Let's Encrypt               │
└─────────────────────────────────────────────────────────┘
                    │              │
          /api/*    │              │  /*
                    ▼              ▼
┌──────────────────────┐  ┌───────────────────────┐
│    API (Fastify)     │  │     Web (React)        │
│      Port: 3001      │  │      Port: 5173        │
│   - REST endpoints   │  │   - SPA estática       │
│   - SSE streaming    │  │   - Vite build         │
│   - IMAP worker      │  │                        │
└──────────────────────┘  └───────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────┐
│                PostgreSQL 16                             │
│                  Port: 5432                              │
│              Volume: postgres_data                       │
└─────────────────────────────────────────────────────────┘
```

---

## Soporte

Para problemas o preguntas:

1. Revisar esta documentación
2. Verificar logs: `docker compose logs -f`
3. Contactar al equipo de desarrollo

**Versión del documento:** 1.0  
**Última actualización:** Febrero 2026
