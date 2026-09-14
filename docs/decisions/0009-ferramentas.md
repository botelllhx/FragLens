# ADR 0009 — Ferramentas de desenvolvimento

- **Status:** aceita
- **Data:** 14/09/2026

## Decisão

| Área                        | Escolha                                                            | Versão                           |
| --------------------------- | ------------------------------------------------------------------ | -------------------------------- |
| Runtime                     | Node.js                                                            | ≥ 22.18 (Docker: `node:24-slim`) |
| Gerenciador de pacotes      | pnpm (workspaces)                                                  | 10.28.1                          |
| Linguagem                   | TypeScript (strict)                                                | **6.0.3**                        |
| Lint                        | ESLint (flat config) + typescript-eslint com regras que usam tipos | 10.x / 8.70                      |
| Formatação                  | Prettier                                                           | 3.9                              |
| Testes                      | Vitest                                                             | 5.x                              |
| Execução em desenvolvimento | tsx                                                                | 4.x                              |
| CLI                         | Commander + picocolors                                             | 15.x / 1.1                       |
| API                         | Fastify                                                            | 5.x                              |
| Validação                   | Zod                                                                | 4.x                              |
| Logs                        | pino (JSON, no stderr)                                             | 10.x                             |
| Variáveis de ambiente       | `process.loadEnvFile` nativo do Node                               | —                                |

## Motivos principais

- **TypeScript 6.0.3 em vez do 7.0:** o TypeScript 7 (compilador nativo) foi lançado em agosto/2026, mas ainda não tem API programática estável. O typescript-eslint exige TypeScript abaixo de 6.1. Usar o 6.0.3 mantém lint com tipos e build com a mesma versão, sem precisar de dois compiladores.
- **Commander:** padrão de mercado, leve, com subcomandos e opções globais. Os textos fixos de ajuda e erro são traduzidos para pt-BR em `apps/cli/src/i18n.ts`.
- **picocolors:** respeita `NO_COLOR`/`FORCE_COLOR` e detecta terminal sem cor. Símbolos têm versão ASCII para o console legado do Windows.
- **Fastify:** menor overhead que Express, validação e testes com `inject` sem subir servidor.
- **pino:** logs estruturados rápidos, com ocultação de campos sensíveis.
- **Sem dotenv:** o Node 22 já lê `.env` nativamente.

## Build e resolução entre pacotes

- Cada pacote tem dois tsconfigs:
  - `tsconfig.json`: inclui `src` e `test`, sem emitir arquivos. Usado pelo editor, pelo lint e pelo `typecheck`.
  - `tsconfig.build.json`: só `src`, com project references. Usado pelo `pnpm build`.
- Os pacotes internos exportam a condição `@fraglens/source`, que aponta para o código-fonte. Com ela, testes, typecheck e `tsx` funcionam **sem precisar de build**; em produção vale o `dist/`.

## Alternativas consideradas

- **TypeScript 7 + pacote de compatibilidade `@typescript/typescript6`:** builds mais rápidos, mas dois compiladores no projeto. Reavaliar quando o TypeScript 7.1 trouxer API estável.
- **Turborepo:** desnecessário no tamanho atual (ADR 0007).
- **oclif / yargs:** mais pesados ou menos ergonômicos para uma CLI deste porte.
