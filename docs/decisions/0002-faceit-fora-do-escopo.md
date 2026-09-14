# ADR 0002 — FACEIT fora do escopo

- **Status:** aceita
- **Data:** 14/09/2026

## Contexto

A FACEIT Data API v4 é gratuita com chave e oferece histórico e estatísticas de partidas FACEIT. O download de demos exige solicitar acesso à Downloads API, com aprovação de cerca de 30 dias.

## Decisão

Não integrar a FACEIT neste momento. A variável `FACEIT_API_KEY` não faz parte da configuração.

## Motivo

- Decisão do responsável pelo produto.
- A Leetify já retorna partidas FACEIT dos jogadores que acompanha (`data_source: "faceit"`) e o FACEIT Elo/nível no perfil.
- Menos uma chave, menos um rate limit e menos código para manter.

## Trade-offs

- Jogadores com partidas FACEIT que a Leetify não acompanha ficam sem esses dados.
- Sem acesso a demos da FACEIT.

## Alternativas consideradas

- **Integrar como fonte secundária:** a arquitetura (`MatchDataSource`) permite adicionar depois sem mudar o domínio. O que foi pesquisado está em `docs/technical-research.md` §2.2.
