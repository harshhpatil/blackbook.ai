FROM node:20-bookworm-slim

WORKDIR /app

# Enable pnpm matching your local environment
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Change pnpm@latest to match your local v10 version
RUN corepack enable && corepack prepare pnpm@10.33.3 --activate

# PDF conversion is performed inside this container, never on the host machine.
RUN apt-get update \
  && apt-get install -y --no-install-recommends libreoffice-writer \
  && rm -rf /var/lib/apt/lists/*

# Copy lockfile and package manifests
COPY package.json pnpm-lock.yaml ./

# Install production dependencies using frozen lockfile
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --prod --frozen-lockfile

COPY . .

# Ensure any implicit temporary file creation by system libraries (like LibreOffice) is forced into in-memory tmpfs
ENV TMPDIR=/dev/shm
ENV PORT=5002
EXPOSE 5002

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5002/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]