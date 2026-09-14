# ADR 0007 — Estrutura do monorepo

- **Status:** aceita
- **Data:** 14/09/2026

## Decisão

Monorepo com **pnpm workspaces** e **TypeScript project references**:

```text
apps/cli, apps/api
packages/shared, contracts, core, steam, sources, analysis, ai, demos, db
```

Mudanças em relação à estrutura sugerida no requisito:

| Sugestão          | Decisão                    | Motivo                                                                                                                                                                                                        |
| ----------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/cs2`    | `packages/sources`         | Os dados de CS2 vêm de provedores terceiros atrás da mesma porta `MatchDataSource`; nomear pelo papel evita um pacote "genérico".                                                                             |
| `prisma/` na raiz | `packages/db`              | Mantém o Prisma fora do domínio e deixa a CLI publicada no npm sem depender dele.                                                                                                                             |
| —                 | `packages/contracts`       | CLI remota, API, futuro MCP e dashboard precisam do mesmo schema validado; se ficasse no `core`, a CLI teria que levar código de domínio.                                                                     |
| `turbo.json`      | Sem Turborepo por enquanto | `pnpm -r` + `tsc -b` bastam para ~11 pacotes. Adicionar quando o tempo de build justificar.                                                                                                                   |
| Redis/BullMQ      | Não usar no MVP            | Uma análise faz ~5 chamadas externas. Tabela `SyncJob` + interface `JobRunner` (execução no próprio processo) permitem migrar para fila (pg-boss ou BullMQ) quando houver processamento de demos no servidor. |

## Motivo

Separação clara entre interfaces (CLI/API), aplicação (core), regras puras (analysis) e infraestrutura (steam, sources, db, ai, demos), sem ferramentas que ainda não resolvem um problema real.

## Trade-offs

- Mais pacotes para configurar no início.
- Sem cache de build distribuído do Turborepo.
