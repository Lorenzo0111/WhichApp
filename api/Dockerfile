FROM oven/bun:1 AS base

FROM base AS turbo-cli

RUN bun install -g turbo

FROM turbo-cli AS builder
WORKDIR /app

COPY . .

RUN turbo prune api app --docker

FROM base AS installer
WORKDIR /app

COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/bun.lock ./bun.lock
RUN bun install --frozen-lockfile --production

COPY --from=builder /app/out/full/ .

FROM installer AS runner

WORKDIR /app/api

COPY --from=builder /app/api/start.sh .
RUN chmod +x start.sh

ENV NODE_ENV=production

EXPOSE 3000

CMD ["./start.sh"]