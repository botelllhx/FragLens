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

| Código | Significado                                                                                                  |
| ------ | ------------------------------------------------------------------------------------------------------------ |
| `0`    | Sucesso                                                                                                      |
| `1`    | Falha (jogador não encontrado, Steam ou Leetify indisponível, configuração inválida, `doctor` com problemas) |
| `2`    | Uso incorreto (comando ou opção desconhecidos, argumento ausente)                                            |

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

Requer `STEAM_API_KEY` no `.env`.

Chamadas à Steam por execução: até 4 (resolução do nome, perfil, banimentos e horas), com as três últimas em paralelo.

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

## `fraglens doctor`

Verifica o ambiente:

| Verificação    | Resultado                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------- |
| Node.js        | Falha abaixo da versão 22.18.0                                                               |
| Configuração   | Falha se alguma variável do `.env` for inválida                                              |
| Steam API      | Faz uma consulta real: OK, aviso (sem chave) ou falha (chave recusada ou Steam indisponível) |
| Banco de dados | Aviso se `DATABASE_URL` não estiver definido (teste de conexão na Fase 4)                    |
| Leetify        | Aviso se não houver chave (a API funciona sem ela)                                           |
| Provedor de IA | Aviso enquanto não houver provedor (Fase 8)                                                  |

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
| `CONFIG_MISSING` / `CONFIG_INVALID` | Chave ausente ou `.env` inválido                                                            |
| `UNAUTHORIZED`                      | A Steam ou a Leetify recusou a chave                                                        |
| `RATE_LIMITED`                      | Limite de requisições atingido (sem `LEETIFY_API_KEY`, a mensagem sugere configurá-la)      |
| `TIMEOUT` / `UPSTREAM_UNAVAILABLE`  | Steam ou Leetify lenta, fora do ar ou sem conexão                                           |
| `UPSTREAM_ERROR`                    | Resposta inesperada da Steam ou da Leetify                                                  |

## Terminais sem suporte a cores ou unicode

- Cores são desativadas automaticamente fora de um terminal interativo e respeitam `NO_COLOR` / `FORCE_COLOR`.
- No console legado do Windows (cmd/conhost), os símbolos `✓ ⚠ ✗` são trocados por `[ok] [!] [x]`.
- Textos vindos da Steam (como o nome do perfil) têm caracteres de controle removidos antes de serem exibidos.
