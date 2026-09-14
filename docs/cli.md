# CLI — referência

Comando: `fraglens`. Durante o desenvolvimento, use `pnpm dev:cli <comando>` na raiz do repositório.

> A CLI ainda roda em **modo local**: os serviços executam no próprio processo e usam o `.env` do diretório atual. O modo remoto (chamando a API) chega na Fase 10.

## Opções globais

Valem para todos os comandos e podem vir antes ou depois do comando.

| Opção           | Efeito                                                                                                   |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| `--json`        | Escreve **somente JSON** no stdout. Erros também saem como JSON: `{"error":{"code","message","hints"}}`. |
| `--verbose`     | Envia logs de processamento (JSON, um por linha) e detalhes técnicos de erros para o **stderr**.         |
| `-h, --help`    | Ajuda do programa ou do comando.                                                                         |
| `-V, --version` | Versão.                                                                                                  |

Como o stdout só recebe o resultado, é seguro redirecionar:

```bash
fraglens profile usuario --json > perfil.json
```

## Códigos de saída

| Código | Significado                                                                                                                                          |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0`    | Sucesso                                                                                                                                              |
| `1`    | Falha (jogador não encontrado, Steam ou Leetify indisponível, configuração inválida, banco inacessível em `refresh`/`cache`, `doctor` com problemas) |
| `2`    | Uso incorreto (comando ou opção desconhecidos, argumento ausente)                                                                                    |

## `fraglens analyze <jogador>`

Relatório completo em uma única consulta: perfil Steam, ranks, desempenho, forma recente, mapas (com melhor e pior mapa), tendência e sequências.

| Opção         | Efeito                                                        |
| ------------- | ------------------------------------------------------------- |
| `--limit <n>` | Partidas mais recentes consideradas, de 1 a 100 (padrão: 100) |
| `--refresh`   | Ignora o cache do perfil Steam                                |
| `--no-ai`     | Gera a análise sem IA                                         |

Seções:

| Seção          | Conteúdo                                                                                  | Fonte                                                            |
| -------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Jogador        | Nome, SteamID64, URL, país, horas de CS2, banimentos, Premier e FACEIT                    | Steam (com cache) e Leetify                                      |
| Desempenho     | Resumo do período (mesmo do `progress`)                                                   | Calculado pelo FragLens                                          |
| Forma recente  | Resultado das 10 partidas mais recentes                                                   | Calculado pelo FragLens                                          |
| Mapas          | Tabela por mapa e melhor/pior mapa                                                        | Calculado pelo FragLens ([regra](metrics.md#melhor-e-pior-mapa)) |
| Tendência      | Últimas 10 × 20 anteriores                                                                | Calculado pelo FragLens                                          |
| Sequências     | Atual e maiores sequências                                                                | Calculado pelo FragLens                                          |
| Análise com IA | Por enquanto, informa que não há provedor configurado ou que foi desativada com `--no-ai` | Fase 8                                                           |

```text
MAPAS

Mapa     Partidas    V-D-E  Vitórias   K/D   ADR    HS%  Kills méd.  Mortes méd.
Dust2          47  23-18-6     48,9%  0,76  65,9  37,9%        11,9         15,6
Mirage         24  12-12-0     50,0%  0,75  61,3  36,9%        11,0         14,5
Inferno        22   10-9-3     45,5%  0,84  65,4  31,7%        11,8         14,0

▲ Melhor mapa: Mirage (50,0% de vitórias · K/D 0,75 · 24 partidas)
▼ Pior mapa: Inferno (45,5% de vitórias · K/D 0,84 · 22 partidas)
```

**Requisições:** o jogador é resolvido uma única vez; a Leetify é consultada 2 vezes (perfil e partidas) e a Steam só quando o perfil não está em cache.

**Quando a Leetify não tem dados** (ou está indisponível), o relatório sai assim mesmo com o perfil Steam e um aviso na seção Desempenho, com código de saída `0`. Falha na Steam interrompe a análise.

**Registro:** com banco configurado, cada análise fica registrada (apenas data e status, [ADR 0010](decisions/0010-registro-de-analises.md)) e aparece como "Última análise" em `fraglens cache`.

### Saída JSON

```json
{
  "steamId64": "76561198012345678",
  "profile": {
    "summary": { "personaName": "Jogador", "…": "…" },
    "cs2": { "…": "…" },
    "cached": true,
    "…": "…"
  },
  "performance": {
    "playerName": "Jogador",
    "ranks": { "premier": null, "faceitLevel": null, "faceitElo": null, "wingman": null },
    "sampleSize": 100,
    "period": { "from": "2026-05-15T19:02:00.000Z", "to": "2026-09-13T21:02:56.000Z" },
    "summary": { "matches": 100, "wins": 47, "killDeathRatio": 0.79, "…": "…" },
    "maps": [{ "map": "de_dust2", "matches": 47, "winRate": 48.9, "…": "…" }],
    "mapHighlights": {
      "eligibleMaps": 3,
      "best": { "map": "de_mirage", "…": "…" },
      "worst": { "map": "de_inferno", "…": "…" }
    },
    "recentForm": { "outcomes": ["loss", "win"], "wins": 7, "losses": 2, "ties": 1 },
    "comparison": { "sufficient": true, "metrics": { "…": "…" } },
    "streaks": {
      "current": { "outcome": "loss", "length": 1 },
      "longestWinStreak": 4,
      "longestLossStreak": 4
    },
    "blocks": [{ "matches": 10, "winRate": 50, "…": "…" }],
    "recentMatches": [{ "map": "de_mirage", "outcome": "loss", "metrics": { "…": "…" }, "…": "…" }],
    "leetify": { "privacyMode": "public", "totalMatches": 480, "ratings": { "…": "…" } },
    "attribution": "Dados fornecidos pela Leetify (Data Provided by Leetify)"
  },
  "notices": [],
  "aiAnalysis": { "status": "not-configured", "message": "Nenhum provedor de IA configurado." },
  "analyzedAt": "2026-09-14T19:06:00.000Z"
}
```

| Campo                       | Observação                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------- |
| `performance`               | `null` quando não foi possível obter as partidas; o motivo fica em `notices`       |
| `notices[]`                 | `{ code, message, hints }`, ex.: `NOT_FOUND` (Leetify sem dados) ou `RATE_LIMITED` |
| `aiAnalysis.status`         | `not-configured` ou `disabled` (com `--no-ai`)                                     |
| `performance.recentMatches` | As 10 partidas mais recentes com métricas por partida                              |

## `fraglens profile <jogador>`

Exibe o perfil Steam: nome, SteamID64, URL, visibilidade, país, data de criação da conta, horas de CS2 e banimentos.

Formatos aceitos para `<jogador>`:

| Formato                   | Exemplo                                                 | Consulta à Steam para resolver? |
| ------------------------- | ------------------------------------------------------- | ------------------------------- |
| SteamID64                 | `76561198012345678`                                     | Não                             |
| Steam2                    | `STEAM_0:0:26039975`                                    | Não                             |
| Steam3                    | `[U:1:52079950]`                                        | Não                             |
| URL de perfil             | `https://steamcommunity.com/profiles/76561198012345678` | Não                             |
| URL personalizada         | `https://steamcommunity.com/id/usuario`                 | Sim                             |
| Nome da URL personalizada | `usuario`                                               | Sim                             |

URLs de qualquer outro domínio são recusadas sem nenhuma requisição.

| Opção       | Efeito                                             |
| ----------- | -------------------------------------------------- |
| `--refresh` | Ignora o cache e busca os dados novamente na Steam |

Requer `STEAM_API_KEY` no `.env`.

**Cache:** com `DATABASE_URL` configurado, o perfil é guardado no banco e reaproveitado por `STEAM_PROFILE_CACHE_TTL` segundos (padrão 24 h). Nesse caso o rodapé mostra "(cache)". Se o banco estiver fora do ar, o comando funciona normalmente buscando na Steam. Detalhes em [database.md](database.md#cache-do-perfil-steam).

Chamadas à Steam por execução: nenhuma com cache válido (exceto a resolução de nome de usuário); sem cache, até 4 (resolução do nome, perfil, banimentos e horas), com as três últimas em paralelo.

### Saída JSON

```json
{
  "steamId64": "76561198012345678",
  "summary": {
    "steamId64": "76561198012345678",
    "personaName": "Jogador",
    "profileUrl": "https://steamcommunity.com/id/usuario/",
    "avatarUrl": "https://avatars.steamstatic.com/…_full.jpg",
    "visibility": "public",
    "countryCode": "BR",
    "accountCreatedAt": "2010-11-27T13:20:08.000Z"
  },
  "bans": {
    "vacBanned": false,
    "vacBanCount": 0,
    "gameBanCount": 0,
    "communityBanned": false,
    "economyBan": "none",
    "daysSinceLastBan": null
  },
  "cs2": { "visible": true, "totalHours": 1523.5, "lastTwoWeeksHours": 18.2 },
  "dataVersion": 1,
  "cached": false,
  "fetchedAt": "2026-09-14T17:37:39.354Z"
}
```

| Campo                                             | Observação                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `summary.visibility`                              | `public`, `friends-only` ou `private`                                                      |
| `summary.countryCode`, `summary.accountCreatedAt` | `null` quando o perfil não é público ou o dado não foi informado                           |
| `bans`                                            | `null` se a Steam não retornar dados de banimento                                          |
| `bans.daysSinceLastBan`                           | `null` quando não há banimento VAC ou de jogo                                              |
| `cs2.visible`                                     | `false` quando os detalhes de jogos do perfil são privados; nesse caso as horas são `null` |
| `cached`                                          | `true` quando o perfil veio do banco em vez da Steam                                       |
| `fetchedAt`                                       | Quando os dados foram obtidos da Steam (em um perfil do cache, a data da busca original)   |
| `dataVersion`                                     | Versão do formato do perfil; perfis guardados em versões antigas não são usados como cache |

## `fraglens matches <jogador>`

Lista as partidas recentes com dados da **Leetify**: ranks (Premier e FACEIT), forma recente e uma tabela com data, mapa, origem, placar, resultado, K-D-A, K/D, ADR e HS%.

| Opção         | Efeito                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| `--limit <n>` | Quantidade de partidas exibidas, de 1 a 100 (padrão: 20). Valor inválido gera erro de uso (código 2). |

Aceita os mesmos formatos de `<jogador>` que o `profile`. Requer `STEAM_API_KEY` (para resolver nomes de usuário); `LEETIFY_API_KEY` é opcional.

Requisições por execução: 2 à Leetify (perfil e partidas, em paralelo) e, se o jogador for informado por nome, 1 à Steam. **Nada é armazenado**: os dados da Leetify são buscados a cada execução ([ADR 0001](decisions/0001-leetify-fonte-ao-vivo.md)).

De onde vem cada valor:

| Valor                         | Origem                                                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Premier, FACEIT (nível e Elo) | Leetify, sem alteração                                                                                            |
| Placar, resultado             | Rounds ganhos e perdidos do jogador, informados pela Leetify                                                      |
| K-D-A                         | Contadores da partida, informados pela Leetify                                                                    |
| K/D, ADR, HS%                 | **Calculados pelo FragLens**: kills ÷ mortes (sem mortes, K/D = kills), dano ÷ rounds, kills com headshot ÷ kills |
| Forma recente                 | Resultado das 10 partidas mais recentes disponíveis, independente de `--limit`                                    |

Origens exibidas: `Matchmaking`, `Competitivo`, `Wingman`, `FACEIT`, `HLTV`, `Renown`. Valores desconhecidos aparecem como a Leetify informou.

### Saída JSON

Principais campos:

```json
{
  "steamId64": "76561198012345678",
  "playerName": "Jogador",
  "ranks": { "premier": 15234, "faceitLevel": 8, "faceitElo": 1850, "wingman": null },
  "leetify": {
    "privacyMode": "public",
    "totalMatches": 480,
    "ratings": {
      "leetifyRating": 1.37,
      "aim": 71.2,
      "positioning": 60.1,
      "utility": 52.3,
      "clutch": 0.11,
      "opening": 0.04,
      "ctRating": 0.02,
      "tRating": 0.03
    }
  },
  "availableMatches": 100,
  "matches": [
    {
      "id": "be77f226-…",
      "origin": "faceit",
      "originMatchId": "1-6e9cf20e-…",
      "finishedAt": "2026-09-08T22:18:06.000Z",
      "map": "de_ancient",
      "outcome": "win",
      "score": { "team": 13, "opponent": 7 },
      "hasBannedPlayer": false,
      "stats": {
        "kills": 16,
        "deaths": 13,
        "assists": 4,
        "headshotKills": 13,
        "damage": 1454,
        "roundsPlayed": 20,
        "…": "…"
      },
      "leetify": { "rating": 0.0341, "ctRating": -0.0553, "tRating": 0.0938 },
      "metrics": {
        "killDeathRatio": 1.23,
        "averageDamagePerRound": 72.7,
        "headshotPercentage": 81.3
      }
    }
  ],
  "recentForm": { "outcomes": ["win", "loss"], "wins": 1, "losses": 1, "ties": 0 },
  "attribution": "Dados fornecidos pela Leetify (Data Provided by Leetify)",
  "fetchedAt": "2026-09-14T17:52:00.000Z"
}
```

| Campo                                                         | Observação                                                                                                          |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `outcome`                                                     | `win`, `loss` ou `tie`                                                                                              |
| `stats`                                                       | Também traz `roundsWon`, `roundsLost`, `roundsSurvived`, `mvps`, `multiKills`, `flashAssists`, `utility` e `trades` |
| `leetify.*`, `matches[].leetify`                              | Notas da Leetify repassadas **sem alteração**; podem ser `null`                                                     |
| `metrics.averageDamagePerRound`, `metrics.headshotPercentage` | `null` quando não houve rounds ou kills                                                                             |

### Quando a Leetify não tem dados

```text
✗ A Leetify não tem dados de partidas deste jogador.

  • A Leetify só possui dados de jogadores que ela acompanha, normalmente quem criou conta em leetify.com.
  • Para ter seus dados: entre em leetify.com com a Steam e informe o código de autenticação de partidas.
  • O perfil na Leetify também pode estar configurado como privado.
```

## `fraglens maps <jogador>`

Desempenho por mapa com as partidas da Leetify: partidas, vitórias-derrotas-empates, win rate, K/D, ADR, HS% e médias de kills e mortes por partida.

| Opção         | Efeito                                                        |
| ------------- | ------------------------------------------------------------- |
| `--limit <n>` | Partidas mais recentes consideradas, de 1 a 100 (padrão: 100) |

```text
MAPAS

Mapa     Partidas    V-D-E  Vitórias   K/D   ADR    HS%  Kills méd.  Mortes méd.
Dust2          47  23-18-6     48,9%  0,76  65,9  37,9%        11,9         15,6
Mirage         24  12-12-0     50,0%  0,75  61,3  36,9%        11,0         14,5
Cache*          4    2-2-0     50,0%  1,26  77,1  44,1%        17,0         13,5

* Menos de 5 partidas no mapa: amostra pequena, interprete com cuidado.
```

- Ordenação: do mapa mais jogado para o menos jogado.
- `*` marca mapas com menos de 5 partidas (`lowSample: true` no JSON).
- Com `--json`: `{ steamId64, playerName, ranks, sampleSize, period: {from, to}, minMapSample, maps: [...], attribution, fetchedAt }`.

Fórmulas: [metrics.md](metrics.md#por-mapa-fraglens-maps).

## `fraglens progress <jogador>`

Resumo do período e tendências, com as partidas da Leetify.

| Opção         | Efeito                                                        |
| ------------- | ------------------------------------------------------------- |
| `--limit <n>` | Partidas mais recentes consideradas, de 1 a 100 (padrão: 100) |

Seções:

| Seção              | Conteúdo                                                                                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resumo             | Vitórias/derrotas/empates, win rate, K/D, KDA, ADR, HS%, kills/mortes/assistências por round, rounds vencidos e sobrevividos, multi-kills, trades e utilitários             |
| Recente × anterior | Win rate, K/D, ADR e HS% das **10 partidas mais recentes** contra as **20 anteriores**, com variação: ▲ subiu, ▼ caiu, → estável. Exige ao menos 5 partidas em cada período |
| Sequências         | Sequência atual e maiores sequências de vitórias e de derrotas (empates interrompem)                                                                                        |
| Evolução           | Blocos de 10 partidas consecutivas, do mais antigo ao mais recente, com barra de win rate, K/D, ADR e HS%                                                                   |

```text
RECENTE × ANTERIOR

Métrica   Últimas 10  20 anteriores  Variação
Vitórias       70,0%          30,0%  ▲ +40,0 p.p.
K/D             0,88           0,78  ▲ +0,10
ADR             66,6           67,7  → -1,1
HS%            35,3%          39,3%  ▼ -4,0 p.p.
```

Com `--json`:

```json
{
  "steamId64": "76561198012345678",
  "playerName": "Jogador",
  "sampleSize": 100,
  "period": { "from": "2026-05-15T19:02:00.000Z", "to": "2026-09-13T21:02:56.000Z" },
  "summary": {
    "matches": 100,
    "wins": 47,
    "losses": 43,
    "ties": 10,
    "winRate": 47,
    "killDeathRatio": 0.79,
    "…": "…"
  },
  "comparison": {
    "recentMatches": 10,
    "previousMatches": 20,
    "sufficient": true,
    "metrics": {
      "winRate": { "recent": 70, "previous": 30, "delta": 40, "direction": "up" },
      "killDeathRatio": { "recent": 0.88, "previous": 0.78, "delta": 0.1, "direction": "up" },
      "averageDamagePerRound": {
        "recent": 66.6,
        "previous": 67.7,
        "delta": -1.1,
        "direction": "stable"
      },
      "headshotPercentage": { "recent": 35.3, "previous": 39.3, "delta": -4, "direction": "down" }
    }
  },
  "streaks": {
    "current": { "outcome": "loss", "length": 1 },
    "longestWinStreak": 4,
    "longestLossStreak": 4
  },
  "blocks": [
    {
      "from": "…",
      "to": "…",
      "matches": 10,
      "complete": true,
      "winRate": 50,
      "killDeathRatio": 0.79,
      "…": "…"
    }
  ],
  "attribution": "Dados fornecidos pela Leetify (Data Provided by Leetify)",
  "fetchedAt": "2026-09-14T18:48:00.000Z"
}
```

Valores que não podem ser calculados (ex.: HS% sem kills) são `null` no JSON e `—` no terminal. Fórmulas e limites de variação: [metrics.md](metrics.md#tendências-fraglens-progress).

## `fraglens refresh <jogador>`

Busca o perfil na Steam e grava no banco, ignorando o cache. **Requer `DATABASE_URL`.**

```text
✓ Perfil Steam de Jogador atualizado em 14/09/2026, 15:29.
Dados da Leetify não são guardados: são buscados a cada consulta.
```

- Se o perfil foi obtido mas não pôde ser gravado (banco fora do ar), exibe um aviso no stderr e sai com código `1`.
- Com `--json`: `{"profile": {...}, "saved": true}`.

## `fraglens cache <jogador>`

Mostra o que está guardado no banco para o jogador. **Requer `DATABASE_URL`.** Não consulta a Steam (exceto para resolver nome de usuário).

```text
FRAGLENS · CACHE

SteamID64            76561198012345678
Situação             ✓ Atualizado
Última atualização   14/09/2026, 15:29 (há 21 min)
Validade do cache    24 h
Expira em            15/09/2026, 15:29
Snapshots guardados  3
Última análise       14/09/2026, 15:31
Primeira consulta    14/09/2026, 15:02

Última sincronização
✓ Perfil Steam: concluída em 14/09/2026, 15:29
```

Situações possíveis: **Atualizado**, **Expirado** (será buscado de novo na próxima consulta) ou **Formato antigo** (guardado em versão anterior do formato).

Com `--json`:

```json
{
  "steamId64": "76561198012345678",
  "stored": true,
  "snapshotCount": 3,
  "firstSeenAt": "2026-09-14T18:02:00.000Z",
  "lastFetchedAt": "2026-09-14T18:29:29.667Z",
  "dataVersion": 1,
  "currentDataVersion": 1,
  "ttlSeconds": 86400,
  "expiresAt": "2026-09-15T18:29:29.667Z",
  "fresh": true,
  "lastSyncJob": {
    "type": "steam-profile",
    "status": "succeeded",
    "startedAt": "2026-09-14T18:29:29.100Z",
    "finishedAt": "2026-09-14T18:29:29.700Z",
    "errorCode": null
  }
}
```

## `fraglens doctor`

Verifica o ambiente:

| Verificação    | Resultado                                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| Node.js        | Falha abaixo da versão 22.18.0                                                                              |
| Configuração   | Falha se alguma variável do `.env` for inválida                                                             |
| Steam API      | Faz uma consulta real: OK, aviso (sem chave) ou falha (chave recusada ou Steam indisponível)                |
| Banco de dados | Conecta e compara migrations: OK, aviso (sem `DATABASE_URL`) ou falha (sem conexão ou migrations pendentes) |
| Leetify        | Aviso se não houver chave (a API funciona sem ela)                                                          |
| Provedor de IA | Aviso enquanto não houver provedor (Fase 8)                                                                 |

Com `--json`, retorna `{"ready": boolean, "checks": [{"id","label","status","detail"}]}`.

## Mensagens de erro

Erros são exibidos em português, com possíveis causas:

```text
✗ Nenhum perfil Steam encontrado para "usuario".

  • Confira se o nome é o mesmo da URL do perfil (steamcommunity.com/id/<nome>).
  • Se o perfil não tem URL personalizada, use a SteamID64 ou a URL /profiles/.
```

| Código (`--json`)                   | Quando                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| `INVALID_INPUT`                     | Jogador em formato não reconhecido, URL de outro site ou limite de partidas fora de 1 a 100 |
| `NOT_FOUND`                         | Nome ou SteamID64 sem conta; ou jogador sem dados na Leetify                                |
| `CONFIG_MISSING` / `CONFIG_INVALID` | Chave ausente, `DATABASE_URL` ausente em `refresh`/`cache`, ou `.env` inválido              |
| `DATABASE_UNAVAILABLE`              | Banco de dados inacessível no comando `cache`                                               |
| `UNAUTHORIZED`                      | A Steam ou a Leetify recusou a chave                                                        |
| `RATE_LIMITED`                      | Limite de requisições atingido (sem `LEETIFY_API_KEY`, a mensagem sugere configurá-la)      |
| `TIMEOUT` / `UPSTREAM_UNAVAILABLE`  | Steam ou Leetify lenta, fora do ar ou sem conexão                                           |
| `UPSTREAM_ERROR`                    | Resposta inesperada da Steam ou da Leetify                                                  |

## Terminais sem suporte a cores ou unicode

- Cores são desativadas automaticamente fora de um terminal interativo e respeitam `NO_COLOR` / `FORCE_COLOR`.
- No console legado do Windows (cmd/conhost), os símbolos `✓ ⚠ ✗` são trocados por `[ok] [!] [x]`.
- Textos vindos da Steam (como o nome do perfil) têm caracteres de controle removidos antes de serem exibidos.
