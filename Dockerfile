# syntax=docker/dockerfile:1

# Imagem da API do FragLens. A CLI é distribuída pelo npm, não por esta imagem.
# Debian slim (glibc) em vez de Alpine: o parser de demos usa addon nativo (ADR 0005).

FROM node:24-slim AS base
ENV CI=true
RUN npm install --global pnpm@10.28.1
WORKDIR /repo

FROM base AS build
# Baixa as dependências só com o lockfile, para aproveitar o cache de camadas do Docker.
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch
COPY . .
RUN pnpm install --offline --frozen-lockfile
RUN pnpm build
RUN pnpm deploy --filter @fraglens/api --prod --legacy /out

FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "dist/server.js"]
