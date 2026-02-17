# DACRISA Comandas Web - Production Dockerfile
# Using Debian bookworm-slim for consistency with API

# ============================================
# Builder stage
# ============================================
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Copy root package files and tsconfig
COPY package*.json ./
COPY tsconfig.json ./
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

# ============================================
# Production stage
# ============================================
FROM node:20-bookworm-slim AS production

# Create non-root user for security
RUN groupadd -r nodejs && useradd -r -g nodejs nodejs

WORKDIR /app

# Install serve for static file serving
RUN npm install -g serve

# Copy built static files
COPY --from=builder /app/apps/web/dist ./dist

# Change ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 5173

# Serve static files
CMD ["serve", "-s", "dist", "-l", "5173"]
