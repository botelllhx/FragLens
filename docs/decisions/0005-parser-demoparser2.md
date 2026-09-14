# ADR 0005 — Parser de demos: demoparser2

- **Status:** aceita
- **Data:** 14/09/2026

## Decisão

Usar `@laihoe/demoparser2` como implementação da interface `DemoParser`, isolada no pacote `packages/demos`.

## Motivo

- Roda dentro do processo Node — sem segunda linguagem no build ou no Docker.
- Binários prontos para Linux x64 (servidor) e Windows x64 (máquina de desenvolvimento).
- Licença MIT e desempenho alto.

## Trade-offs

- Addon nativo: a imagem Docker precisa ser baseada em glibc (Debian slim) ou usar o build musl.
- Modelo de consulta por eventos (`parseEvent`, `parseTicks`) exige montar a lógica de rounds e duelos no nosso código.
- Base de mantenedores menor que a do demoinfocs.

## Alternativas consideradas

- **demoinfocs-golang:** mais maduro e usado pela HLTV, mas exige Go (não instalado) e um processo separado. Pode ser outra implementação da mesma interface no futuro.
- **awpy:** exige runtime Python.
