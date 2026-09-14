# FragLens

**Inteligência de jogadores de Counter-Strike 2 direto no terminal.**

O FragLens analisa jogadores de CS2 a partir de uma Steam ID ou URL de perfil: busca dados públicos, calcula métricas próprias, identifica tendências e (opcionalmente) gera uma interpretação com IA. Tudo pelo terminal, sem interface web.

```bash
fraglens analyze https://steamcommunity.com/id/usuario
```

> **Status:** em desenvolvimento — **Fase 7 concluída** (`fraglens analyze`, ainda sem IA). A Fase 6 (demos) foi adiada; veja o [roadmap](#15-roadmap).

---

## Sumário

1. [O que é o FragLens](#1-o-que-é-o-fraglens)
2. [Arquitetura](#2-arquitetura)
3. [Instalação](#3-instalação)
4. [Configuração](#4-configuração)
5. [Como criar a chave da Steam API](#5-como-criar-a-chave-da-steam-api)
6. [Executando localmente](#6-executando-localmente)
7. [Usando a CLI](#7-usando-a-cli)
8. [Executando a API](#8-executando-a-api)
9. [Testes e qualidade](#9-testes-e-qualidade)
10. [Docker](#10-docker)
11. [Deploy](#11-deploy)
12. [Limitações conhecidas](#12-limitações-conhecidas)
13. [Fontes de dados](#13-fontes-de-dados)
14. [Licenças das dependências](#14-licenças-das-dependências)
15. [Roadmap](#15-roadmap)

---

## 1. O que é o FragLens

Uma pequena plataforma de _player intelligence_ para CS2, acessível inicialmente pela linha de comando. Princípio central:

> **Código calcula. IA interpreta.**

- **Dados** vêm de fontes externas (Steam, Leetify, demos).
- **Métricas** são calculadas de forma determinística pelo FragLens.
- **Interpretação** é gerada pela IA, somente a partir das métricas calculadas — e é opcional.

## 2. Arquitetura

Monorepo pnpm com interfaces finas sobre uma camada de domínio compartilhada:

```text
CLI ───────┐
           ├── core (serviços de aplicação) ──► steam · sources · analysis · ai · demos · db
API ───────┘
```

| Pacote               | Responsabilidade                                               | Status                                                                            |
| -------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `apps/cli`           | Comando `fraglens` (Commander)                                 | `analyze`, `profile`, `matches`, `maps`, `progress`, `refresh`, `cache`, `doctor` |
| `apps/api`           | API HTTP (Fastify)                                             | Esqueleto + `/health`                                                             |
| `packages/shared`    | Configuração, logs, erros, cliente HTTP resiliente             | ✅                                                                                |
| `packages/contracts` | Schemas compartilhados CLI/API                                 | Fase 9                                                                            |
| `packages/core`      | Domínio: resolver de Steam ID, serviços de perfil e partidas   | ✅ (cresce a cada fase)                                                           |
| `packages/steam`     | Cliente da Steam Web API                                       | ✅                                                                                |
| `packages/sources`   | Cliente da Leetify Public API                                  | ✅                                                                                |
| `packages/db`        | Prisma 7 + PostgreSQL: cache e histórico do perfil Steam, jobs | ✅                                                                                |
| `packages/analysis`  | Motor de métricas (funções puras): resumo, mapas, tendências   | ✅                                                                                |
| `packages/demos`     | Parser de demos                                                | Fase 6                                                                            |
| `packages/ai`        | Provedores de IA                                               | Fase 8                                                                            |

Detalhes e decisões: [docs/technical-research.md](docs/technical-research.md), [docs/metrics.md](docs/metrics.md), [docs/database.md](docs/database.md) e [docs/decisions/](docs/decisions/).

## 3. Instalação

Requisitos para desenvolvimento:

- Node.js **22.18 ou superior**
- pnpm **10** (`npm install --global pnpm@10`)
- Docker (opcional, para PostgreSQL local e imagem da API)

```bash
git clone <url-do-repositorio> fraglens
cd fraglens
pnpm install
```

> A instalação global pelo npm (`npm install -g fraglens`) estará disponível na Fase 10.

## 4. Configuração

```bash
cp .env.example .env
```

| Variável                  | Obrigatória      | Descrição                                                                               |
| ------------------------- | ---------------- | --------------------------------------------------------------------------------------- |
| `STEAM_API_KEY`           | Sim (modo local) | Chave da Steam Web API                                                                  |
| `DATABASE_URL`            | Não              | PostgreSQL; sem ele o cache do perfil fica desativado e `refresh`/`cache` não funcionam |
| `TEST_DATABASE_URL`       | Não              | Banco dos testes de integração (`pnpm test:db`)                                         |
| `LEETIFY_API_KEY`         | Não              | Sem chave a Leetify funciona com limites menores                                        |
| `STEAM_PROFILE_CACHE_TTL` | Não              | Cache do perfil Steam em segundos (padrão 86400)                                        |
| `AI_PROVIDER`             | Não              | `none` por enquanto                                                                     |
| `PORT`, `HOST`            | Não              | Endereço da API (padrão `0.0.0.0:3000`)                                                 |
| `LOG_LEVEL`               | Não              | `info` por padrão                                                                       |

O arquivo `.env` nunca deve ser versionado (já está no `.gitignore`).

## 5. Como criar a chave da Steam API

1. Entre na sua conta Steam em https://steamcommunity.com/dev/apikey
2. Informe um nome de domínio (pode ser `localhost` para uso pessoal) e aceite os termos.
3. Copie a chave para `STEAM_API_KEY` no `.env`.

Regras importantes dos termos da Steam: a chave é pessoal e não pode ser compartilhada; o limite é de 100.000 chamadas por dia.

## 6. Executando localmente

```bash
# Banco de dados local (PostgreSQL no Docker) e criação das tabelas
pnpm db:up
pnpm db:migrate

# CLI a partir do código-fonte
pnpm dev:cli doctor

# API em modo desenvolvimento (recarrega ao salvar)
pnpm dev:api
```

## 7. Usando a CLI

Disponível hoje (a partir do código-fonte, use `pnpm dev:cli` no lugar de `fraglens`):

```bash
fraglens analyze usuario                                  # relatório completo: perfil, desempenho, mapas e tendência
fraglens analyze usuario --no-ai --limit 30 --json        # sem IA, últimas 30 partidas, em JSON
fraglens profile 76561198012345678                        # por SteamID64
fraglens profile https://steamcommunity.com/id/usuario    # por URL
fraglens profile usuario --json                           # por nome, em JSON
fraglens profile usuario --refresh                        # ignora o cache (24 h) e busca na Steam
fraglens matches usuario                                  # últimas 20 partidas (Leetify)
fraglens matches usuario --limit 50 --json                # até 100 partidas, em JSON
fraglens refresh usuario                                  # atualiza o perfil guardado no banco
fraglens cache usuario                                    # mostra o que está guardado e se expirou
fraglens maps usuario                                     # desempenho por mapa (até 100 partidas)
fraglens progress usuario                                 # resumo, recente × anterior, sequências e evolução
fraglens doctor                                           # diagnóstico do ambiente
fraglens --help                                           # ajuda
```

Exemplo de `fraglens profile`:

```text
 FRAGLENS  Jogador · 76561198012345678
 https://steamcommunity.com/id/usuario/

── CONTA ───────────────────────────────────────────────────────────────────────
  Visibilidade  Público
  País          Brasil
  Conta criada  27/11/2010

── CS2 ─────────────────────────────────────────────────────────────────────────
  Horas totais       1.523,5 h
  Últimas 2 semanas  18,2 h

── BANIMENTOS ──────────────────────────────────────────────────────────────────
  ✓ Nenhum banimento registrado

 dados da Steam obtidos em 14/09/2026, 14:37
```

Exemplo de `fraglens matches` (trecho):

```text
── FORMA RECENTE · últimas 10 ──────────────────────────────────────────────────
  ■ ■ ■ ■ ■ ■ ■ ■ ■ ■   6V 3D 1E  (mais recente à esquerda)

── PARTIDAS · 20 de 100 ────────────────────────────────────────────────────────
  Data        Mapa     Origem       Placar  Res.    K-D-A   K/D   ADR    HS%
  13/09/2026  Mirage   Matchmaking   13-11  V     21-15-4  1,40  88,2  47,6%
  12/09/2026  Inferno  Competitivo    9-13  D     14-18-3  0,78  64,5  35,7%

 Dados fornecidos pela Leetify (Data Provided by Leetify)
 K/D, ADR e HS% calculados pelo FragLens · consultado em 14/09/2026, 14:37
```

Enquanto consulta, a CLI mostra um indicador de carregamento (só em terminal interativo), e as linhas se ajustam à largura do terminal. Detalhes em [docs/cli.md](docs/cli.md#aparência-no-terminal).

Formatos de jogador aceitos: SteamID64, `STEAM_0:X:Y`, `[U:1:Z]`, URL `/profiles/`, URL `/id/` e o nome da URL personalizada. URLs de outros sites são recusadas.

Opções globais:

| Opção       | Efeito                                                             |
| ----------- | ------------------------------------------------------------------ |
| `--json`    | Escreve somente JSON no stdout, inclusive erros                    |
| `--verbose` | Exibe logs de processamento e detalhes técnicos de erros no stderr |

Códigos de saída: `0` sucesso · `1` falha · `2` uso incorreto.

Referência completa: [docs/cli.md](docs/cli.md). Fórmulas de todas as métricas: [docs/metrics.md](docs/metrics.md).

Comandos planejados: `compare`, `config` — ver [roadmap](#15-roadmap).

## 8. Executando a API

```bash
pnpm build
node apps/api/dist/server.js
curl http://localhost:3000/health
```

Endpoints disponíveis hoje:

| Método | Rota      | Descrição       |
| ------ | --------- | --------------- |
| GET    | `/health` | Status e versão |

## 9. Testes e qualidade

```bash
pnpm lint          # ESLint com regras baseadas em tipos
pnpm typecheck     # TypeScript strict em todos os pacotes
pnpm test          # Vitest (testes unitários)
pnpm test:db       # testes de integração com PostgreSQL real (requer TEST_DATABASE_URL)
pnpm build         # compila todos os pacotes
pnpm format:check  # Prettier
pnpm check         # lint + typecheck + test + build
```

Os testes unitários não dependem de serviços externos: Steam, Leetify e banco são simulados. Os testes de integração usam um banco separado (`fraglens_test`); veja [docs/database.md](docs/database.md#testes).

## 10. Docker

```bash
docker build -t fraglens-api .
docker run --rm -p 3000:3000 --env-file .env fraglens-api

# ou API + PostgreSQL juntos
docker compose up --build
```

## 11. Deploy

Objetivo: **custo zero** ([ADR 0003](docs/decisions/0003-hospedagem-custo-zero.md)).

```text
GitHub → Render (plano Free, Dockerfile) → API Node → PostgreSQL no Neon (plano Free)
```

1. Crie um banco gratuito em https://neon.com e copie a connection string.
2. No Render, crie um _Blueprint_ apontando para o repositório (usa o `render.yaml`).
3. Preencha `DATABASE_URL`, `STEAM_API_KEY` e, se quiser, `LEETIFY_API_KEY`.

Atenção: no plano gratuito do Render a API "dorme" após 15 minutos sem uso e leva cerca de 1 minuto para responder na primeira requisição.

## 12. Limitações conhecidas

- A Steam **não fornece** histórico de partidas, estatísticas por partida nem Premier rating.
- Dados de desempenho dependem da **Leetify**: jogadores que ela não acompanha ficam sem estatísticas. Para ter seus dados, entre em [leetify.com](https://leetify.com) com a Steam e informe o código de autenticação de partidas.
- Notas próprias da Leetify (Leetify Rating, aim, utility…) aparecem apenas no `--json`, sem alteração, até confirmarmos como a Leetify as exibe.
- A origem "Matchmaking" informada pela Leetify não é identificada oficialmente como Premier; o FragLens não faz essa suposição.
- A Leetify pede para **não armazenar** seus dados: o FragLens não guarda nenhum dado da Leetify (nem em cache) e não tem histórico além das últimas 100 partidas.
- **Premier rating** pode estar indisponível (campo nulo na Leetify).
- **K/D por lado (T/CT) e clutches** só serão possíveis com demos (Fase 6).
- Demos do matchmaking da Valve **não** são baixadas automaticamente (exigiriam credenciais de terceiros).
- FACEIT está fora do escopo ([ADR 0002](docs/decisions/0002-faceit-fora-do-escopo.md)).

Detalhes: [docs/technical-research.md](docs/technical-research.md).

## 13. Fontes de dados

| Fonte                                                              | Uso                                         | Termos                                                                                        |
| ------------------------------------------------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [Steam Web API](https://partner.steamgames.com/doc/webapi)         | Steam ID, perfil, banimentos, horas jogadas | [Steam Web API Terms](https://steamcommunity.com/dev/apiterms)                                |
| [Leetify Public API](https://api-public-docs.cs-prod.leetify.com/) | Premier, partidas e estatísticas            | [Diretrizes para desenvolvedores](https://leetify.com/blog/leetify-api-developer-guidelines/) |
| Demos `.dem` do usuário                                            | Estatísticas avançadas (Fase 6)             | —                                                                                             |

_Dados de desempenho fornecidos pela Leetify (Data Provided by Leetify). O FragLens não é afiliado à Valve nem à Leetify._

## 14. Licenças das dependências

Todas as dependências de execução atuais usam licenças permissivas:

| Dependência                        | Licença    |
| ---------------------------------- | ---------- |
| commander                          | MIT        |
| fastify                            | MIT        |
| picocolors                         | ISC        |
| pino                               | MIT        |
| zod                                | MIT        |
| @prisma/client, @prisma/adapter-pg | Apache-2.0 |
| pg (dependência do adapter)        | MIT        |

Ferramentas de desenvolvimento (TypeScript e Prisma CLI: Apache-2.0; ESLint, Prettier, Vitest, tsx: MIT). A tabela será atualizada a cada fase.

## 15. Roadmap

| Fase | Entrega                                                       | Status                            |
| ---- | ------------------------------------------------------------- | --------------------------------- |
| 0    | Pesquisa técnica                                              | ✅                                |
| 1    | Bootstrap: monorepo, TypeScript, lint, testes, Docker, README | ✅                                |
| 2    | Resolver de Steam ID + `fraglens profile`                     | ✅                                |
| 3    | Integração Leetify + `fraglens matches`                       | ✅                                |
| 4    | Banco de dados (Prisma 7 + PostgreSQL)                        | ✅                                |
| 5    | Motor de métricas determinísticas + `maps` e `progress`       | ✅                                |
| 6    | Processamento de demos enviadas pelo usuário                  | ⏸️ adiada (sem demos para testar) |
| 7    | `fraglens analyze --no-ai`                                    | ✅                                |
| 8    | Análise com IA                                                | ⏳                                |
| 9    | API HTTP `/v1`                                                | ⏳                                |
| 10   | CLI remota (`npm install -g fraglens`)                        | ⏳                                |
| 11   | Deploy Render + Neon                                          | ⏳                                |
| 12   | Polimento: erros, logs, cache, docs, desempenho               | ⏳                                |

Futuro: servidor MCP, dashboard Next.js, vínculo opcional de conta por share code.
