FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

FROM node:22-alpine AS runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV UPLOADS_DIR=/app/uploads

RUN mkdir -p /app/uploads

COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/seed ./seed
# Bundled OG-card fonts (satori reads these at request time).
COPY --from=builder /app/assets ./assets
COPY --from=builder /app/astro.config.mjs ./

# Run as the unprivileged `node` user (uid 1000, matching the host uploads dir).
user node

EXPOSE 3000

CMD ["node", "./dist/server/entry.mjs"]
