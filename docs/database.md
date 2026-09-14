# Banco de dados

PostgreSQL com **Prisma ORM 7** ([ADR 0006](decisions/0006-prisma-7.md)). Código em [`packages/db`](../packages/db).

## O que é guardado

Somente **dados próprios** do FragLens. Dados da Leetify **nunca** são gravados ([ADR 0001](decisions/0001-leetify-fonte-ao-vivo.md)).

| Tabela                    | Conteúdo                                                                                                                          | Por quê                                                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `players`                 | Uma linha por SteamID64 consultada                                                                                                | Âncora das demais tabelas                                                                                                       |
| `steam_profile_snapshots` | Uma foto do perfil Steam a cada busca: nome, URL, avatar, visibilidade, país, data de criação da conta, horas de CS2 e banimentos | O mais recente serve de **cache**; os anteriores formam o **histórico** (mudança de nome, horas e banimentos ao longo do tempo) |
| `sync_jobs`               | Cada sincronização com a Steam: tipo, status (`RUNNING`, `SUCCEEDED`, `FAILED`), erro, início e fim                               | Observabilidade e base para, no futuro, mover as sincronizações para uma fila assíncrona                                        |

Tabelas de partidas (`matches`, `match_players`) só serão criadas na Fase 6, para estatísticas extraídas de demos processadas pelo próprio FragLens.

## Modelo

```text
players (1) ──< steam_profile_snapshots (N)
        (1) ──< sync_jobs (N)
```

| Item                | Decisão                                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Chaves              | UUID gerado pelo Prisma                                                                                                                        |
| Unicidade           | `players.steam_id64` (único)                                                                                                                   |
| Chaves estrangeiras | `ON DELETE CASCADE`: apagar o jogador apaga snapshots e jobs                                                                                   |
| Índices             | `(player_id, fetched_at DESC)` para buscar o último snapshot; `(player_id, started_at DESC)` para o último job; `(status)` para consultar jobs |
| Datas               | `TIMESTAMPTZ(3)` (UTC, milissegundos)                                                                                                          |
| Nomes               | Tabelas e colunas em `snake_case` no banco, `camelCase` no código                                                                              |
| Banimentos          | Colunas nulas = a Steam não retornou dados de banimento naquela busca                                                                          |

Schema completo: [`packages/db/prisma/schema.prisma`](../packages/db/prisma/schema.prisma).

## Cache do perfil Steam

```text
fraglens profile <jogador>
        │
        ▼
último snapshot existe, tem menos de STEAM_PROFILE_CACHE_TTL segundos
e foi gravado na versão atual do formato (data_version)?
        ├── sim → retorna do banco (marcado como "cache")
        └── não → busca na Steam → grava novo snapshot → registra o job
```

- **Validade:** `STEAM_PROFILE_CACHE_TTL` (padrão 86400 s = 24 h).
- **`--refresh`** ou **`fraglens refresh`**: ignoram o cache e sempre buscam na Steam.
- **`data_version`:** ao mudar o formato do perfil, a constante `PROFILE_DATA_VERSION` é incrementada e snapshots antigos deixam de valer como cache, sem migração de dados.
- **Registro de datas:** `fetched_at` (quando os dados foram obtidos) e `data_version` ficam em cada snapshot. `lastAnalyzedAt` entrará junto com as análises (Fase 7).

### Banco indisponível

O cache nunca derruba uma consulta:

| Comando              | Com o banco fora do ar                                            |
| -------------------- | ----------------------------------------------------------------- |
| `profile`, `matches` | Funcionam normalmente, buscando na Steam/Leetify; nada é guardado |
| `refresh`            | Busca na Steam, avisa que não salvou e sai com código 1           |
| `cache`              | Erro `DATABASE_UNAVAILABLE` com dicas                             |
| `doctor`             | Falha em "Banco de dados"                                         |

Após a primeira falha, o FragLens não tenta o banco de novo na mesma execução (cada tentativa esperaria o timeout de conexão de 5 s).

Sem `DATABASE_URL`, o cache fica desativado e `refresh`/`cache` informam que o banco não está configurado.

## Comandos

Executados na raiz do repositório:

| Comando               | O que faz                                                                |
| --------------------- | ------------------------------------------------------------------------ |
| `pnpm db:up`          | Sobe o PostgreSQL local (Docker Compose)                                 |
| `pnpm db:migrate`     | Aplica as migrations pendentes (`prisma migrate deploy`)                 |
| `pnpm db:migrate:dev` | Cria uma nova migration a partir de mudanças no schema (desenvolvimento) |
| `pnpm db:generate`    | Gera o client do Prisma (roda sozinho após `pnpm install`)               |
| `pnpm test:db`        | Testes de integração com PostgreSQL real                                 |

O client gerado fica em `packages/db/src/generated/` e **não é versionado**.

O Prisma 7 não carrega `.env` sozinho: o [`prisma.config.ts`](../packages/db/prisma.config.ts) lê o `.env` da raiz. Variáveis já definidas no ambiente têm prioridade.

## Primeira configuração local

```bash
pnpm db:up        # PostgreSQL 17 em localhost:5432 (usuário/senha/banco: fraglens)
pnpm db:migrate   # cria as tabelas
fraglens doctor   # deve mostrar "Banco de dados conectado (migrations em dia)"
```

`DATABASE_URL` no `.env`:

```env
DATABASE_URL=postgresql://fraglens:fraglens@localhost:5432/fraglens
```

## Testes

| Tipo       | Banco                                  | Como rodar     |
| ---------- | -------------------------------------- | -------------- |
| Unitários  | Nenhum (banco em memória)              | `pnpm test`    |
| Integração | PostgreSQL real, banco `fraglens_test` | `pnpm test:db` |

O banco `fraglens_test` é criado automaticamente na primeira vez que o volume do Docker é iniciado ([`scripts/db/create-test-database.sql`](../scripts/db/create-test-database.sql)). Em um volume já existente:

```bash
docker compose exec postgres psql -U fraglens -c "CREATE DATABASE fraglens_test;"
```

Depois aplique as migrations nele e rode os testes, com `TEST_DATABASE_URL` definido no `.env`:

```bash
# bash
DATABASE_URL=postgresql://fraglens:fraglens@localhost:5432/fraglens_test pnpm db:migrate
pnpm test:db
```

```powershell
# PowerShell
$env:DATABASE_URL="postgresql://fraglens:fraglens@localhost:5432/fraglens_test"; pnpm db:migrate; Remove-Item Env:DATABASE_URL
pnpm test:db
```

Sem `TEST_DATABASE_URL`, os testes de integração são ignorados.

## Crescimento dos dados

Com a validade padrão de 24 h, cada jogador gera no máximo um snapshot por dia **quando é consultado** (mais os `--refresh`). Um snapshot ocupa poucos KB, o que cabe com folga no plano gratuito do Neon (0,5 GB). Uma rotina de limpeza de snapshots antigos pode ser adicionada se o volume crescer.

Consultas a SteamID64 que não correspondem a nenhuma conta também criam uma linha em `players`, com o job registrado como `FAILED` (`NOT_FOUND`).
