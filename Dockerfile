# Multi-stage build for Suna (Frontend + Backend)
FROM node:22-slim AS frontend-builder

WORKDIR /app/frontend

# Install frontend dependencies
COPY frontend/package.json frontend/yarn.lock* frontend/package-lock.json* frontend/pnpm-lock.yaml* ./

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    build-essential \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Copy frontend source and build
COPY frontend/ .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_OUTPUT=standalone

RUN \
  if [ -f yarn.lock ]; then yarn run build; \
  elif [ -f package-lock.json ]; then npm run build; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Backend stage
FROM ghcr.io/astral-sh/uv:python3.11-alpine AS backend-builder

WORKDIR /app/backend

# Install Python dependencies
COPY backend/pyproject.toml backend/uv.lock ./
ENV UV_LINK_MODE=copy
RUN --mount=type=cache,target=/root/.cache/uv uv sync --locked --quiet

# Copy backend code
COPY backend/ .

# Final stage
FROM node:22-slim AS runner

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy frontend build
COPY --from=frontend-builder /app/frontend/.next/standalone ./frontend
COPY --from=frontend-builder /app/frontend/.next/static ./frontend/.next/static
COPY --from=frontend-builder /app/frontend/public ./frontend/public

# Copy backend
COPY --from=backend-builder /app/backend ./backend
COPY --from=backend-builder /root/.cache/uv /root/.cache/uv

# Install uv for Python package management
RUN pip install uv

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PYTHONPATH=/app/backend
ENV PORT=3000
ENV BACKEND_PORT=8000

# Create start script
RUN echo '#!/bin/bash\n\
# Start backend in background\n\
cd /app/backend\n\
uv run gunicorn api:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 --timeout 1800 &\n\
\n\
# Start frontend\n\
cd /app/frontend\n\
node server.js\n\
' > /app/start.sh && chmod +x /app/start.sh

EXPOSE 3000 8000

CMD ["/app/start.sh"] 