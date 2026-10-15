# Production Dockerfile for CopperCore Industrial Supplies
FROM node:20-bookworm-slim

# Install build dependencies for native sqlite3 bindings and curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies cleanly
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Ensure persistent data directory exists and assign ownership to node user
RUN mkdir -p /app/data && chown -R node:node /app

# Use non-root user for security
USER node

# Default environment settings
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DATABASE_PATH=/app/data/coppercore.sqlite

EXPOSE 3000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
