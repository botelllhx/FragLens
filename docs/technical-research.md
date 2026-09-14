# FragLens — Pesquisa Técnica (Fase 0)

> Data da pesquisa: **14/09/2026**. Projeto anteriormente chamado "CS Watch" (renomeado — ver [ADR 0004](decisions/0004-nome-fraglens.md)).
>
> Cada afirmação indica como foi obtida:
>
> - **[verificado]** — confirmado com requisição real feita durante a pesquisa.
> - **[docs]** — informado na documentação oficial.
> - **[terceiros]** — relatado por comunidade ou sites de terceiros, sem confirmação oficial.
> - **[não verificado]** — plausível, mas precisa ser validado na fase de implementação.

---

## 0. Resumo executivo

1. **A Steam Web API não fornece histórico de partidas, estatísticas por partida nem Premier rating do CS2.** Ela fornece identidade (resolução de SteamID), perfil, banimentos, horas jogadas e — com código de autorização do próprio jogador — uma cadeia de _share codes_ (não estatísticas).
2. **A Leetify Public API é a fonte gratuita mais completa** para dados de desempenho no CS2: Premier rating, estatísticas por partida (kills, mortes, dano, HS, trades, multi-kills, utilitários, flash assists, rating por lado) das **últimas 100 partidas**. Funciona **sem chave de API** (com limites mais rígidos). **Porém as diretrizes pedem para não armazenar os dados** → decisão: fonte ao vivo, sem cache ([ADR 0001](decisions/0001-leetify-fonte-ao-vivo.md)).
3. **FACEIT foi pesquisado e ficou fora do escopo** ([ADR 0002](decisions/0002-faceit-fora-do-escopo.md)). A Leetify já inclui partidas FACEIT dos jogadores que ela acompanha.
4. **Demos do matchmaking da Valve** só podem ser obtidas pelo Game Coordinator com uma conta Steam logada e o **código de autorização de cada jogador**. Inviável para "analisar qualquer jogador". **Fora do MVP.** Demos `.dem` fornecidas pelo usuário são viáveis.
5. **Parser de demos:** `@laihoe/demoparser2` (núcleo em Rust, bindings Node, MIT, binários prontos) ([ADR 0005](decisions/0005-parser-demoparser2.md)).
6. **Hospedagem com custo zero:** **Render (plano gratuito, Docker, sem cartão)** + **Neon (Postgres gratuito, sem cartão)** ([ADR 0003](decisions/0003-hospedagem-custo-zero.md)). Railway foi descartado porque o plano Free dá só US$ 1/mês.

---

## 1. Steam Web API

### 1.1 Acesso e termos

| Item              | Conclusão                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| URL base          | `https://api.steampowered.com/<Interface>/<Metodo>/v<N>/` **[docs]**                                                            |
| Chave             | Obrigatória para métodos de dados de usuário. Sem chave retorna `HTTP 400 Required parameter 'key' is missing` **[verificado]** |
| Onde criar        | `https://steamcommunity.com/dev/apikey` (chave de usuário comum). Chave de publisher não é necessária. **[docs]**               |
| Limite diário     | "Você está limitado a 100.000 chamadas à Steam Web API por dia." **[docs — Steam Web API Terms]**                               |
| Abuso             | Requisições que geram 403 "sofrerão rate limit rigoroso para o IP" **[docs]**                                                   |
| Confidencialidade | A chave deve ser mantida em sigilo **[docs]** → fica apenas no servidor, nunca na CLI distribuída.                              |
| Atribuição        | Páginas web com dados da Steam devem exibir nome/logo/links da Valve, sem sugerir parceria **[docs]**                           |
| Armazenamento     | Informar ao usuário quais dados da Steam são guardados e onde (política de privacidade) **[docs]**                              |

### 1.2 Métodos relevantes

| Método                                                   | Uso no FragLens                                | Observações                                                                                                                                                                                             |
| -------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ISteamUser/ResolveVanityURL/v1` (`vanityurl`)           | Converter `/id/<nome>` → SteamID64             | **[docs]**                                                                                                                                                                                              |
| `ISteamUser/GetPlayerSummaries/v2` (`steamids`, até 100) | Nome, avatar, URL, visibilidade, último logoff | Aceita **lote** de até 100 IDs — útil no `compare`. **[docs]**                                                                                                                                          |
| `ISteamUser/GetPlayerBans/v1`                            | VAC / game bans, dias desde o último ban       | **[docs]**                                                                                                                                                                                              |
| `IPlayerService/GetOwnedGames/v1` (`appids_filter=730`)  | Horas totais de CS2                            | Só se os detalhes de jogos forem públicos **[docs]**                                                                                                                                                    |
| `IPlayerService/GetRecentlyPlayedGames/v1`               | Horas de CS2 nas últimas 2 semanas             | Depende da privacidade **[docs]**                                                                                                                                                                       |
| `ISteamUserStats/GetUserStatsForGame/v2` (`appid=730`)   | **Não confiável no CS2**                       | Vários relatos de resposta vazia no CS2; são contadores legados **[terceiros]**. Testar uma vez, nunca usar como fonte principal.                                                                       |
| `ICSGOPlayers_730/GetNextMatchSharingCode/v1`            | Percorrer share codes de um jogador            | Exige o **código de autenticação do próprio jogador** + share code conhecido de **até 1 mês**. Cobre Competitivo, Wingman e Premier. Retorna **só share codes, não estatísticas**. **[docs/terceiros]** |

### 1.3 O que a Steam NÃO fornece

- Histórico de partidas de CS2 de jogadores quaisquer.
- Placar por partida (kills, mortes, ADR...).
- Premier rating / patentes.
- URLs de download de demos (só via Game Coordinator, ver §4).

### 1.4 Resolução de SteamID

| Entrada                                      | Resolução                                                |
| -------------------------------------------- | -------------------------------------------------------- |
| `76561198012345678`                          | Valida 17 dígitos e faixa de conta individual. Sem rede. |
| `https://steamcommunity.com/profiles/<id64>` | Leitura do caminho. Sem rede.                            |
| `https://steamcommunity.com/id/<vanity>`     | `ResolveVanityURL`                                       |
| `usuario` (texto simples)                    | Tratado como vanity → `ResolveVanityURL`                 |
| `STEAM_0:X:Y`, `[U:1:Z]`                     | Conversão matemática (barata e determinística)           |

O endpoint legado `steamcommunity.com/id/<vanity>/?xml=1` ainda funciona sem chave **[verificado]**, mas não é documentado. Decisão: **não usar**; somente `ResolveVanityURL` oficial.

O resolver **nunca** acessa URLs arbitrárias informadas pelo usuário: apenas interpreta localmente o host `steamcommunity.com` e chama endpoints fixos da Steam (proteção contra SSRF).

---

## 2. Fontes de dados de CS2

### 2.1 Leetify Public API (fonte principal)

**URL base:** `https://api-public.cs-prod.leetify.com` **[verificado]**
**Autenticação:** opcional. Header `Authorization: Bearer <chave>` ou `_leetify_key: <chave>`. Chave em `https://leetify.com/app/developer`. `GET /api-key/validate` retorna 401 sem chave **[verificado]**.
**Rate limit:** não publicado; "requisições sem chave terão limites maiores". **Nenhum header de rate limit é retornado** **[verificado]** → tratar 429 reativamente e limitar do lado do cliente.

#### Endpoints

| Endpoint                                      | Resultado                                                                                                                                                                          |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /v3/profile?steam64_id=`                 | Perfil + agregados + resumo das partidas recentes **[verificado]**                                                                                                                 |
| `GET /v3/profile/matches?steam64_id=`         | **100 partidas** (observado), mais recentes primeiro, cada uma com **apenas a linha de estatísticas do jogador consultado** (~190 KB) **[verificado]**. Sem paginação documentada. |
| `GET /v2/matches/{gameId}`                    | Partida completa: **placar dos 10 jogadores** **[verificado]**                                                                                                                     |
| `GET /v2/matches/{dataSource}/{dataSourceId}` | Mesma coisa, pelo ID da origem **[docs]**                                                                                                                                          |

Jogador desconhecido/não acompanhado → `HTTP 404` com corpo `Not Found` (texto puro, não JSON) **[verificado]**. A privacidade segue as configurações do próprio Leetify (campo `privacy_mode`) **[docs]**. A cobertura se limita a jogadores que a Leetify possui dados.

#### Perfil (`/v3/profile`) — campos confirmados

- `name`, `steam64_id`, `id`, `privacy_mode`, `winrate`, `total_matches`, `first_match_date`, `bans`
- `ranks`: `premier` (pode ser nulo), `leetify`, `faceit`, `faceit_elo`, `wingman`, `renown` (pode ser nulo), `competitive[] {map_name, rank}`
- `rating`: `aim`, `positioning`, `utility`, `clutch`, `opening`, `ct_leetify`, `t_leetify`
- `stats` (agregados): `accuracy_head`, `accuracy_enemy_spotted`, `spray_accuracy`, `reaction_time_ms`, `preaim`, `counter_strafing_good_shots_ratio`, `t_/ct_opening_duel_success_percentage`, `t_/ct_opening_aggression_success_rate`, `trade_kills_success_percentage`, `traded_deaths_success_percentage`, `trade_kill_opportunities_per_round`, `flashbang_*`, `he_foes_damage_avg`, `utility_on_death_avg`
- `recent_matches[]`: `id`, `finished_at`, `data_source`, `outcome`, `rank`, `rank_type`, `map_name`, `leetify_rating`, `score[2]`, campos de mira

#### Estatísticas por partida — campos confirmados

`total_kills`, `total_deaths`, `total_assists`, `kd_ratio`, `total_hs_kills`, `total_damage`, `dpr`, `rounds_count`, `rounds_won`, `rounds_lost`, `rounds_survived`, `multi1k..multi5k`, `mvps`, `score`, `initial_team_number`, `flash_assist`, `flashbang_thrown/hit_foe/hit_friend/leading_to_kill`, `he_thrown`, `molotov_thrown`, `smoke_thrown`, `he_foes_damage_avg`, `trade_kill_opportunities/attempts/succeed`, `traded_death_opportunities/attempts/succeed`, `leetify_rating`, `ct_leetify_rating`, `t_leetify_rating`, campos de mira. Nível da partida: `map_name`, `finished_at`, `data_source`, `data_source_match_id`, `team_scores[]`, `has_banned_player`.

Valores de `data_source` observados: `faceit`, `hltv`, `matchmaking`, `matchmaking_competitive` **[verificado]**; a documentação cita também `renown` e `CS_API`.

Conferência com dados reais: `rounds_won=13 / rounds_lost=7` bateu com `team_scores` para `initial_team_number=2` **[verificado]** → vitória/derrota pode ser derivada de `rounds_won` vs `rounds_lost` (empates são possíveis em alguns modos).

#### Diretrizes para desenvolvedores da Leetify **[docs]**

- **Atribuição obrigatória**: "Data Provided by Leetify" / links "View on Leetify".
- **Não alterar métricas da Leetify** (não renomear, reescalar ou recalcular Leetify Rating, aim etc.). Devem ser exibidas como estão e identificadas como da Leetify.
- **"Pedimos que você evite armazenar quaisquer dados enviados pela nossa API."** Apagar dados em cache se deixarem de estar disponíveis na API.
- Não usar "Leetify" no nome do app nem sugerir parceria.

> **Decisão ([ADR 0001](decisions/0001-leetify-fonte-ao-vivo.md)):** usar como fonte ao vivo, sem guardar nenhum dado (nem em cache).

### 2.2 FACEIT Data API v4 — pesquisada, fora do escopo

Resumo do que foi levantado (mantido para referência futura):

- Base `https://open.faceit.com/data/v4`, chave gratuita de servidor via App Studio **[docs]**.
- Busca por Steam: `GET /players?game=cs2&game_player_id=<steam64>` **[docs]**.
- Histórico `GET /players/{id}/history` (limit ≤ 100, `from` padrão = 1 mês atrás) e estatísticas por partida **[docs]**.
- Rate limit de "10.000 requisições/hora" **[terceiros]**.
- Download de demos exige solicitar a **Downloads API** (~30 dias para aprovação) **[docs]**.
- Cobre apenas partidas FACEIT.

Motivo da exclusão: ver [ADR 0002](decisions/0002-faceit-fora-do-escopo.md).

### 2.3 Outras fontes avaliadas

| Fonte                                        | Veredito                                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Scraping da Steam Community (`/gcpd/730`)    | Exige sessão logada do próprio jogador. Rejeitado.                                            |
| HLTV                                         | Sem API oficial; scraping viola os termos. Rejeitado.                                         |
| csstats.gg, tracker.gg, scope.gg, cswatch.gg | Sem API pública gratuita para este uso, ou baseados em scraping. Rejeitados como dependência. |
| 5EPlay / Perfect World                       | Regionais e não oficiais. Fora do escopo.                                                     |

---

## 3. Parsers de demo

|                  | `@laihoe/demoparser2`                                                                  | `demoinfocs-golang`            | `awpy`         |
| ---------------- | -------------------------------------------------------------------------------------- | ------------------------------ | -------------- |
| Linguagem        | Núcleo Rust, **bindings Node (N-API)**, também Python/WASM                             | Go                             | Python         |
| CS2              | Sim                                                                                    | Sim (v5.x)                     | Sim            |
| Licença          | MIT                                                                                    | MIT                            | MIT            |
| Versão           | 0.42.0 (npm) **[verificado]**                                                          | v5, exige Go ≥ 1.27 **[docs]** | —              |
| Binários prontos | linux-x64-gnu/musl, linux-arm64, win32-x64, darwin **[verificado]**                    | Compilar binário Go            | Runtime Python |
| Modelo           | Consultas: `parseEvent`, `parseEvents`, `parseTicks`, `parsePlayerInfo`, `parseHeader` | Callbacks de eventos           | DataFrames     |

**Decisão:** `demoparser2` atrás da interface `DemoParser` ([ADR 0005](decisions/0005-parser-demoparser2.md)). Go **não está instalado** na máquina de desenvolvimento **[verificado]**.

Métricas que só existem via demo: contagem de opening kills/deaths, tentativas e vitórias de clutch, K/D e taxa de vitória por lado (T/CT), linha do tempo por round, dano exato de utilitários.

---

## 4. Obtenção de demos

| Caminho                                 | Como                                                                                                                                                                                                | Viabilidade                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Matchmaking Valve (share code → GC)** | Código do jogador + share code → `GetNextMatchSharingCode` → decodificar share code → **pedir dados ao Game Coordinator com conta Steam logada** (`steam-user` + `globaloffensive`) → URL do replay | Funciona (CS Demo Manager, cs-demo-downloader). **Mas:** (1) exige o código de autorização _do jogador_; (2) o servidor precisa guardar **login + segredo 2FA de uma conta bot**; (3) o GC não é API documentada → risco de quebra e de conta; (4) links expiram (~1 mês segundo CS:DM; relatos de prazo menor) **[terceiros]**. |
| **FACEIT Downloads API**                | `demo_url` → URL assinada                                                                                                                                                                           | Fora do escopo (ADR 0002).                                                                                                                                                                                                                                                                                                       |
| **`.dem` fornecido pelo usuário**       | `fraglens demo parse ./partida.dem`                                                                                                                                                                 | Legítimo, gratuito, sem credenciais.                                                                                                                                                                                                                                                                                             |

**Recomendação:** MVP **não** baixa demos da Valve. A Fase 6 implementa o parser com **demos enviadas pelo usuário**. O fluxo share code/GC fica documentado como recurso futuro opcional ("vincular sua conta").

Fluxo quando houver demo: `arquivo → parse → ParsedMatch normalizado → PostgreSQL → apagar arquivo`. Sem armazenamento permanente de demos.

Observação de custo zero: no plano gratuito do Render (CPU fracionada) o processamento de demos no servidor tende a ser lento. O parse local pela CLI (`--local`) é a alternativa natural.

---

## 5. Viabilidade com custo zero

| Componente         | Custo                                                                                                             | Observações                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Steam Web API      | Grátis                                                                                                            | 100 mil chamadas/dia                       |
| Leetify Public API | Grátis                                                                                                            | Chave opcional; restrição de armazenamento |
| demoparser2        | Grátis (MIT)                                                                                                      |                                            |
| PostgreSQL         | **Neon Free**: 0,5 GB, 100 CU-horas/mês, desliga após 5 min ocioso, permanente, sem cartão **[docs]**             |                                            |
| API HTTP           | **Render Free**: Docker, sem cartão, 750 horas/mês, dorme após 15 min sem tráfego, ~1 min para acordar **[docs]** |                                            |
| IA                 | Opcional; provedor `none` por padrão                                                                              | Opções gratuitas avaliadas na Fase 8       |
| Local              | Grátis                                                                                                            | Docker Compose com Postgres                |

**Custo mensal esperado: US$ 0.**

---

## 6. Rate limits e resiliência

| Fonte   | Limite conhecido                       | Estratégia                                                                                                        |
| ------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Steam   | 100 mil/dia; 403 gera penalidade no IP | Token bucket (ex.: ≤ 5 req/s), lote em `GetPlayerSummaries`, nunca repetir 401/403                                |
| Leetify | Não publicado, sem headers             | Limitador conservador (ex.: 1–2 req/s), retry só em 429/5xx com backoff exponencial + jitter, máximo 3 tentativas |
| Todas   | —                                      | Timeout por requisição (ex.: 10 s), circuit breaker por fonte, nunca retry infinito                               |

Orçamento por `analyze`: Steam 2–4 chamadas (resolve, summaries, bans, horas; menos quando o perfil estiver em cache) + Leetify 2 chamadas (profile, matches) em toda consulta. **Não há uma chamada por partida**, pois `/v3/profile/matches` já traz 100 partidas com as estatísticas do jogador.

---

## 7. Hospedagem (situação em 14/09/2026)

| Opção           | Custo                                                  | Limites relevantes                                                                                                 | Veredito                                 |
| --------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| **Render Free** | US$ 0, sem cartão                                      | 750 h/mês por workspace; dorme após 15 min; ~1 min de cold start; Postgres grátis **expira em 30 dias** **[docs]** | ✅ **API**                               |
| **Neon Free**   | US$ 0, sem cartão                                      | 0,5 GB; 100 CU-h/mês; desliga após 5 min; permanente **[docs]**                                                    | ✅ **Banco**                             |
| Railway Free    | US$ 1/mês de crédito                                   | 0,5 GB RAM; workloads param quando o crédito acaba **[docs]**                                                      | ❌ crédito insuficiente para API + banco |
| Railway Hobby   | US$ 5/mês                                              | —                                                                                                                  | ❌ não é custo zero                      |
| Koyeb Free      | US$ 0, **exige cartão** **[docs]**                     | 1 instância 512 MB / 0,1 vCPU; Postgres com 5 h/mês                                                                | ⚠️ alternativa                           |
| Fly.io          | Sem plano gratuito para novos usuários **[terceiros]** | —                                                                                                                  | ❌                                       |
| Supabase Free   | US$ 0                                                  | 500 MB; **pausa após 1 semana sem atividade** **[terceiros]**                                                      | ⚠️ alternativa ao Neon                   |

Impactos do Render Free no produto:

- A primeira requisição após inatividade leva ~1 minuto → a CLI deve usar timeout longo e exibir "Servidor iniciando, aguarde..." no stderr.
- A imagem continua sendo Docker comum; trocar de provedor não exige mudança de código.

---

## 8. Versões de ferramentas

| Ferramenta | Conclusão                                                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Node.js    | Local **v22.18.0** **[verificado]**. Node 24 = LTS ativo; Node 22 = LTS de manutenção; Node 26 vira LTS em out/2026 **[terceiros]**. Alvo: `engines >= 22.18`, Docker `node:24-slim`.                              |
| pnpm       | Local **10.28.1** **[verificado]**                                                                                                                                                                                 |
| Docker     | Local **28.3.2** **[verificado]** (Postgres via docker compose; `psql` não instalado)                                                                                                                              |
| Prisma     | **Prisma 7.x estável**; exige driver adapter (`@prisma/adapter-pg`). Prisma 8 ainda é **RC** (GA previsto para out/2026) com recursos faltando **[docs]** → **Prisma 7** ([ADR 0006](decisions/0006-prisma-7.md)). |
| Go         | Não instalado **[verificado]**                                                                                                                                                                                     |

---

## 9. Principais riscos

| #   | Risco                                                         | Impacto | Mitigação                                                                                                 |
| --- | ------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------- |
| R1  | Leetify pede para não armazenar dados                         | Alto    | Fonte ao vivo sem cache; persistir só dados próprios (ADR 0001)                                           |
| R2  | Jogadores sem dados na Leetify → 404                          | Médio   | Exibir perfil Steam + mensagem clara "sem dados de partidas disponíveis"                                  |
| R3  | Premier rating só via Leetify (`ranks.premier` pode ser nulo) | Médio   | Exibir "Premier rating indisponível nas fontes atuais" — nunca inventar                                   |
| R4  | Demos da Valve inacessíveis para jogadores quaisquer          | Médio   | Demos enviadas pelo usuário; vínculo opcional por share code no futuro                                    |
| R5  | Rate limit da Leetify não publicado                           | Médio   | Limitador conservador, chave de API, mensagem clara ao atingir o limite                                   |
| R6  | Cold start de ~1 min no Render Free                           | Baixo   | Timeout longo e aviso na CLI; modo `--local`                                                              |
| R7  | Limites do Neon Free (0,5 GB, 100 CU-h)                       | Baixo   | Poucos dados persistidos por causa do R1; limpeza periódica                                               |
| R8  | Addon nativo (demoparser2) no deploy                          | Baixo   | Imagem Debian slim (build glibc); parser isolado                                                          |
| R9  | Regras de apresentação de métricas da Leetify                 | Baixo   | Métricas da Leetify exibidas sem alteração e identificadas; métricas próprias identificadas como FragLens |
| R10 | Mudança de planos gratuitos (Render/Neon)                     | Baixo   | Imagem Docker portável; alternativas documentadas (Koyeb, Supabase)                                       |

---

## 10. Matriz de viabilidade das métricas

Legenda: ✅ disponível/calculável · 🟡 parcial/apenas agregado · ❌ indisponível

| Métrica                                                                   | Leetify                                        | Demo | MVP                |
| ------------------------------------------------------------------------- | ---------------------------------------------- | ---- | ------------------ |
| Partidas, vitórias, derrotas, taxa de vitória                             | ✅                                             | ✅   | ✅                 |
| Kills, mortes, assistências, K/D, KDA                                     | ✅                                             | ✅   | ✅                 |
| Kills com headshot / HS%                                                  | ✅                                             | ✅   | ✅                 |
| Dano, ADR                                                                 | ✅                                             | ✅   | ✅                 |
| Rounds, kills por round, mortes por round                                 | ✅                                             | ✅   | ✅                 |
| Multi-kills (2k–5k)                                                       | ✅                                             | ✅   | ✅                 |
| Flash assists                                                             | ✅                                             | ✅   | ✅                 |
| Uso de granadas (quantidade)                                              | ✅                                             | ✅   | ✅                 |
| Trade kills / mortes trocadas                                             | ✅ (por partida)                               | ✅   | ✅                 |
| Opening kills / deaths (contagem)                                         | 🟡 (% de sucesso agregado por lado)            | ✅   | 🟡                 |
| Clutches (tentativas / vitórias)                                          | 🟡 (apenas rating de clutch da Leetify)        | ✅   | ❌ (fase de demos) |
| Dano de utilitários (exato)                                               | 🟡 (média de HE)                               | ✅   | 🟡                 |
| K/D e taxa de vitória por lado (T/CT)                                     | 🟡 (apenas rating por lado da Leetify)         | ✅   | ❌ (fase de demos) |
| Estatísticas por mapa                                                     | ✅ (derivadas das partidas)                    | ✅   | ✅                 |
| Premier rating                                                            | 🟡 (`ranks.premier`, pode ser nulo)            | ❌   | 🟡                 |
| Rating ao longo do tempo                                                  | ✅ (Leetify Rating por partida, sem alteração) | —    | ✅                 |
| Taxa de vitória / K/D ao longo do tempo, sequências, recente vs histórico | ✅ (últimas 100)                               | ✅   | ✅                 |
| FACEIT Elo / nível                                                        | ✅ (via Leetify)                               | —    | ✅                 |
| Banimentos VAC / game ban                                                 | —                                              | —    | ✅ (Steam)         |

---

## 11. Arquitetura proposta

### 11.1 Princípios

- **Portas e adaptadores, sem exagero.** Os serviços de domínio dependem de interfaces (`MatchDataSource`, `PlayerRepository`, `DemoParser`, `AIProvider`, `Cache`), nunca de Fastify, Commander, Prisma ou clientes HTTP.
- **Código calcula, IA interpreta.** `analysis` são funções puras sem I/O; `ai` recebe apenas métricas calculadas.
- **CLI e API são interfaces finas** sobre os mesmos serviços (MCP e dashboard futuros reutilizam os contratos da API).
- **Procedência em tudo:** cada métrica carrega sua `fonte` (`leetify`, `demo`, `steam`, `fraglens`) e o tamanho da amostra, para o relatório e a IA poderem dizer "dados insuficientes".
- **Idioma:** textos exibidos, documentação e comentários em pt-BR; identificadores de código em inglês ([ADR 0008](decisions/0008-idioma.md)).

### 11.2 Estrutura

```text
fraglens/
├── apps/
│   ├── cli/            # Commander + renderizadores; modo remoto (HTTP) ou local; publicado no npm
│   └── api/            # Fastify, rotas /v1, plugins de segurança
├── packages/
│   ├── shared/         # config (env com Zod), logger (pino), erros, cliente HTTP (limitador/retry/breaker)
│   ├── contracts/      # schemas Zod + tipos de requisição/resposta (CLI, API, futuro MCP/dashboard)
│   ├── core/           # tipos de domínio, portas, serviços de aplicação
│   ├── steam/          # SteamIdentifierResolver + cliente Steam Web API
│   ├── sources/        # adaptadores MatchDataSource: leetify/
│   ├── analysis/       # motor de métricas e tendências (puro)
│   ├── ai/             # AIProvider: none + provedores reais (Fase 8)
│   ├── demos/          # interface DemoParser + implementação demoparser2 (Fase 6)
│   └── db/             # schema Prisma 7, migrations, repositórios
├── docs/ (arquitetura, fontes-de-dados, api, cli, banco-de-dados, deploy, limitacoes, decisions/)
├── tests/              # testes de integração entre pacotes + fixtures
├── Dockerfile, docker-compose.yml, render.yaml
├── package.json, pnpm-workspace.yaml, tsconfig.base.json
└── .env.example, .gitignore, README.md
```

Justificativas: [ADR 0007](decisions/0007-estrutura-monorepo.md).

### 11.3 Fluxo

```text
CLI (remota) ──HTTP──► API ─┐
CLI (modo local) ───────────┼─► serviços do core ─► portas
(futuro MCP / Dashboard) ───┘                        ├─ steam     (Steam Web API)
                                                     ├─ sources   (Leetify)
                                                     ├─ demos     (demoparser2)
                                                     ├─ db        (PostgreSQL)
                                                     ├─ analysis  (puro)
                                                     └─ ai        (opcional)
```

`analyze(jogador, {refresh, limit, ai})`:

1. `SteamIdentifierResolver` → SteamID64.
2. Perfil Steam: usa o cache do banco, salvo `--refresh`. Dados da Leetify: sempre buscados na hora.
3. Busca nas fontes em paralelo (limitado) → normaliza para `NormalizedMatch` (com fonte).
4. `analysis` → `PlayerReport` (desempenho, mapas, tendências, procedência).
5. Se IA ativa → `AIProvider.analyzePlayer(report)` → JSON estruturado validado com Zod; se falhar, o relatório é retornado mesmo assim.
6. Persiste conforme a política de dados (ADR 0001); retorna o DTO do contrato.

### 11.4 CLI remota

- `fraglens config set api <url>` salvo no diretório de configuração do usuário (`%APPDATA%` / XDG).
- Padrão = modo remoto: o usuário só precisa do Node; sem Postgres, Docker ou chaves de API na máquina.
- `--local` (modo desenvolvedor) executa os serviços no próprio processo.
- `--json` escreve somente JSON no stdout; spinners e logs vão para o stderr.

---

## 12. MVP recomendado

1. **Identidade e perfil:** resolver Steam (todos os formatos), perfil, banimentos, horas de CS2.
2. **Dados de desempenho:** Leetify (perfil + últimas 100 partidas).
3. **Motor de métricas:** básicas, por mapa, trades, multi-kills, utilitários, tendências (últimas 10 vs 20 anteriores, sequências, K/D e taxa de vitória ao longo do tempo); toda métrica com fonte e aviso explícito de "dados insuficientes".
4. **Premier:** exibir `ranks.premier` quando existir; caso contrário, informar indisponibilidade.
5. **Cache:** apenas do perfil Steam; dados da Leetify nunca são guardados.
6. **IA:** opcional, desligada por padrão (`AI_PROVIDER=none`), saída estruturada em pt-BR, baseada apenas nas métricas calculadas.
7. **API + CLI remota + Docker + Render/Neon.**
8. **Demos (Fase 6):** parse de `.dem` enviados pelo usuário.

Fora do MVP: download de demos da Valve por conta bot, K/D por lado e clutches (dependem de demos), FACEIT, filas/Redis.

---

## 13. Decisões tomadas pelo responsável do produto (14/09/2026)

| Tema             | Decisão                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Dados da Leetify | Fonte ao vivo, sem cache e sem pedido de permissão → [ADR 0001](decisions/0001-leetify-fonte-ao-vivo.md)                        |
| Orçamento        | **Custo zero** (projeto de teste, sem intenção de manter por muito tempo) → [ADR 0003](decisions/0003-hospedagem-custo-zero.md) |
| Nome             | **FragLens** (comando `fraglens`) → [ADR 0004](decisions/0004-nome-fraglens.md)                                                 |
| FACEIT           | Fora do escopo → [ADR 0002](decisions/0002-faceit-fora-do-escopo.md)                                                            |
| Idioma           | Tudo em pt-BR → [ADR 0008](decisions/0008-idioma.md)                                                                            |

---

## Fontes

- Steam Web API — visão geral: https://partner.steamgames.com/doc/webapi_overview
- ISteamUser: https://partner.steamgames.com/doc/webapi/ISteamUser
- ISteamUserStats: https://partner.steamgames.com/doc/webapi/ISteamUserStats
- IPlayerService: https://partner.steamgames.com/doc/webapi/IPlayerService
- Termos da Steam Web API: https://steamcommunity.com/dev/apiterms
- Definição ICSGOPlayers_730: https://github.com/SteamTracking/SteamTracking/blob/master/API/ICSGOPlayers_730.json
- Relatos sobre GetUserStatsForGame no CS2: https://steamcommunity.com/discussions/forum/1/694249110938683613/
- Leetify Public API (OpenAPI): https://api-public-docs.cs-prod.leetify.com/
- Diretrizes da Leetify: https://leetify.com/blog/leetify-api-developer-guidelines/
- FACEIT Data API: https://docs.faceit.com/docs/data-api/data/
- FACEIT Downloads API: https://docs.faceit.com/getting-started/Guides/download-api/
- demoinfocs-golang: https://github.com/markus-wa/demoinfocs-golang
- demoparser (demoparser2): https://github.com/LaihoE/demoparser
- node-globaloffensive: https://github.com/DoctorMcKay/node-globaloffensive
- csgo-sharecode: https://github.com/akiver/csgo-sharecode
- cs-demo-downloader: https://github.com/claabs/cs-demo-downloader
- csgo-demodownloader: https://github.com/jannislehmann/csgo-demodownloader
- CS Demo Manager: https://cs-demo-manager.com/docs/guides/downloads
- Render — plano gratuito: https://render.com/docs/free
- Render — plataformas gratuitas 2026: https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026
- Neon — preços: https://neon.com/pricing
- Railway — preços: https://railway.com/pricing
- Railway — planos: https://docs.railway.com/pricing/plans
- Koyeb — FAQ de preços: https://www.koyeb.com/docs/faqs/pricing
- Supabase — pausa de projetos: https://supabase.com/docs/guides/platform/free-project-pausing
- Fly.io 2026 (terceiros): https://www.saaspricepulse.com/blog/flyio-free-tier-2026
- Prisma 7: https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7
- Status de versões do Prisma: https://www.prisma.io/docs/prisma-orm/release-status
- Node.js releases: https://nodejs.org/en/about/previous-releases
- ClutchLens (nome descartado por já existir): https://clutchlens.tech/
- cswatch.gg / cswat.ch (motivo da troca de nome): https://cswatch.gg/
