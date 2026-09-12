FROM node:20-alpine

WORKDIR /app

# 1. Install build tools needed for native C++ addons (argon2)
RUN apk add --no-cache python3 make g++

# 2. Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 3. Copy dependency manifests
COPY package.json pnpm-lock.yaml ./

# 4. Install dependencies and allow native compilation
RUN pnpm install --frozen-lockfile --config.ignore-scripts=false

# 5. Copy application source
COPY . .

# 6. Clean and build TypeScript
RUN pnpm run build --if-present

EXPOSE 5000

CMD ["pnpm", "run", "start:core"]