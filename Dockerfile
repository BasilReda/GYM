# ── Stage 1: Build native modules ──────────────────────────────────────────
FROM node:20-alpine AS builder

# better-sqlite3 requires Python, make, and g++ to compile its C++ bindings
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files first (layer cache: only re-installs when deps change)
COPY package*.json ./

RUN npm install --omit=dev

# ── Stage 2: Production image ───────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Copy compiled node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application source
COPY . .

# The SQLite database will be stored in /app/db — mount a volume there
# so data survives container restarts
VOLUME ["/app/db"]

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "server.js"]
