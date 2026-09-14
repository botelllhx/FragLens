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

| Código | Significado                                                                                       |
| ------ | ------------------------------------------------------------------------------------------------- |
| `0`    | Sucesso                                                                                           |
| `1`    | Falha (jogador não encontrado, Steam indisponível, configuração inválida, `doctor` com problemas) |
| `2`    | Uso incorreto (comando ou opção desconhecidos, argumento ausente)                                 |

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

| Código (`--json`)                   | Quando                                                  |
| ----------------------------------- | ------------------------------------------------------- |
| `INVALID_INPUT`                     | Jogador em formato não reconhecido ou URL de outro site |
| `NOT_FOUND`                         | Nome ou SteamID64 sem conta correspondente              |
| `CONFIG_MISSING` / `CONFIG_INVALID` | Chave ausente ou `.env` inválido                        |
| `UNAUTHORIZED`                      | A Steam recusou a chave                                 |
| `RATE_LIMITED`                      | Limite de requisições atingido                          |
| `TIMEOUT` / `UPSTREAM_UNAVAILABLE`  | Steam lenta, fora do ar ou sem conexão                  |
| `UPSTREAM_ERROR`                    | Resposta inesperada da Steam                            |

## Terminais sem suporte a cores ou unicode

- Cores são desativadas automaticamente fora de um terminal interativo e respeitam `NO_COLOR` / `FORCE_COLOR`.
- No console legado do Windows (cmd/conhost), os símbolos `✓ ⚠ ✗` são trocados por `[ok] [!] [x]`.
- Textos vindos da Steam (como o nome do perfil) têm caracteres de controle removidos antes de serem exibidos.
