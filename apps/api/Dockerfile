# DACRISA Comandas API - Production Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for native modules (argon2)
RUN apk add --no-cache python3 make g++

# Copy root package files
COPY package*.json ./
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

# Production image
FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies for argon2
RUN apk add --no-cache libstdc++

# Copy built artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/

# Copy Prisma schema and migrations
COPY apps/api/prisma ./apps/api/prisma

# Regenerate Prisma client for production
RUN cd apps/api && npx prisma generate

WORKDIR /app/apps/api

# Create uploads directory
RUN mkdir -p /app/uploads/pdf

EXPOSE 3001

# Run migrations and start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
