# DACRISA Comandas API - Production Dockerfile
# Using Debian bookworm-slim to resolve Prisma OpenSSL compatibility issues

# ============================================
# Builder stage
# ============================================
FROM node:20-bookworm-slim AS builder

# Install dependencies required for Prisma and native modules (argon2)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    openssl \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root package files and tsconfig
COPY package*.json ./
COPY tsconfig.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/

# Install all dependencies
RUN npm ci --workspace=apps/api --workspace=packages/shared --include-workspace-root

# Copy source code
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Build shared package
RUN npm run build -w packages/shared

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build API
RUN npm run build -w apps/api

# ============================================
# Production stage
# ============================================
FROM node:20-bookworm-slim AS production

# Install runtime dependencies for Prisma
RUN apt-get update && apt-get install -y \
    ca-certificates \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r nodejs && useradd -r -g nodejs nodejs

WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/

# Copy Prisma schema and migrations
COPY apps/api/prisma ./apps/api/prisma

# Regenerate Prisma client for production (ensures correct binaries)
RUN cd apps/api && npx prisma generate

WORKDIR /app/apps/api

# Create uploads directory with correct ownership
RUN mkdir -p /app/uploads/pdf && chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3001

# Run migrations and start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
