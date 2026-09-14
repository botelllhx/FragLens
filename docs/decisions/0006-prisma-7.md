# ADR 0006 — ORM: Prisma 7

- **Status:** aceita
- **Data:** 14/09/2026

## Decisão

Usar **Prisma ORM 7** (versão estável) com o driver adapter `@prisma/adapter-pg`, isolado no pacote `packages/db`.

## Motivo

- Migrations versionadas, tipos gerados e boa integração com TypeScript.
- O Prisma 7 não usa mais o binário de query engine em Rust, o que simplifica a imagem Docker.
- O Prisma 8 ainda é release candidate (GA previsto para outubro/2026) e não tem recursos como nested writes e códigos de erro P2002.

## Trade-offs

- Driver adapter obrigatório e configuração em `prisma.config.ts`.
- Migração para o Prisma 8 será necessária no futuro.

## Alternativas consideradas

- **Prisma 8 RC:** API ainda pode mudar.
- **Drizzle ORM:** mais leve e próximo do SQL, mas o requisito do projeto prioriza Prisma.
