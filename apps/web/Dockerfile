# DACRISA Comandas Web - Production Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm ci --workspace=apps/web --workspace=packages/shared --include-workspace-root

# Copy source code
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# Build shared package
RUN npm run build -w packages/shared

# Build web app
RUN npm run build -w apps/web

# Production image - use lightweight server
FROM node:20-alpine

WORKDIR /app

# Install serve for static file serving
RUN npm install -g serve

# Copy built static files
COPY --from=builder /app/apps/web/dist ./dist

EXPOSE 5173

# Serve static files
CMD ["serve", "-s", "dist", "-l", "5173"]
