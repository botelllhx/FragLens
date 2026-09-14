# ADR 0008 — Idioma do projeto

- **Status:** aceita
- **Data:** 14/09/2026

## Decisão

- **pt-BR:** documentação, README, ADRs, comentários de código, mensagens de commit, textos da CLI, mensagens de erro da API, logs legíveis e análise gerada pela IA.
- **Inglês:** identificadores de código (variáveis, funções, tipos, pacotes), nomes de comandos e flags da CLI (`analyze`, `--json`), rotas da API (`/v1/analyze`), nomes de eventos de log (`steam.profile.fetch`) e campos JSON.

## Motivo

O responsável pelo produto não lê inglês, então tudo que é lido por pessoas fica em português. Identificadores, comandos, rotas e campos JSON seguem o padrão do ecossistema e das bibliotecas usadas, o que facilita integração com outras ferramentas.

## Trade-offs

Mistura de idiomas entre texto e código, comum em projetos brasileiros.
