FROM node:20-bookworm-slim AS deps
WORKDIR /app

# Prisma needs openssl. Some native deps (e.g. argon2) may need build tooling in linux/arm64.
RUN apt-get update && apt-get install -y --no-install-recommends \
  openssl ca-certificates \
  python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# Don't run lifecycle scripts here (postinstall runs `prisma generate` but prisma/schema.prisma
# isn't copied into this stage). Prisma generate will run during the build stage after source is copied.
RUN npm ci --ignore-scripts

FROM node:20-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
  openssl ca-certificates \
  python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
# Build native deps (argon2) and generate Prisma client now that prisma/schema.prisma is present.
RUN npm rebuild argon2 --build-from-source
RUN npm run db:generate
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# App Router code lives under /app (and /src for some libs)
COPY --from=builder /app/app ./app
COPY --from=builder /app/src ./src
COPY --from=builder /app/types ./types
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/tsconfig.json ./tsconfig.json

EXPOSE 3000

# Note: run migrations as a one-off ECS task (recommended). If you want the container to do it,
# set RUN_MIGRATIONS=1 (only safe for single-instance deploys).
CMD ["bash", "-lc", "if [ \"${RUN_MIGRATIONS:-0}\" = \"1\" ]; then npm run db:migrate; fi; npm run start -- --port ${PORT}"]

