# ADR 0001 — Leetify como fonte ao vivo, sem cache

- **Status:** aceita (revisada em 14/09/2026: cache removido)
- **Data:** 14/09/2026

## Contexto

A Steam não fornece estatísticas de partidas de CS2. A Leetify Public API é a fonte gratuita mais completa (Premier rating, últimas 100 partidas com estatísticas por jogador), mas suas diretrizes dizem: _"pedimos que você evite armazenar quaisquer dados enviados pela nossa API"_, além de exigir atribuição e proibir alteração das métricas da Leetify.

O requisito original do projeto previa persistir partidas no banco para histórico e cache.

## Decisão

- A Leetify é tratada como **fonte ao vivo**: cada consulta busca os dados na hora.
- **Nenhum dado da Leetify é guardado** — nem em cache, nem no banco. O responsável pelo produto optou por não solicitar permissão de cache à Leetify.
- Análises derivadas desses dados também não são persistidas.
- O banco persiste apenas dados próprios: identidade e perfil Steam, jobs de sincronização e estatísticas extraídas de demos processadas pelo FragLens.
- Métricas da Leetify (Leetify Rating, aim, utility etc.) são exibidas **sem alteração** e identificadas como "Leetify".
- Métricas calculadas pelo FragLens a partir de contadores brutos (K/D, ADR, HS%...) são identificadas como "FragLens".
- Toda saída que usar dados da Leetify exibe "Dados fornecidos pela Leetify" (Data Provided by Leetify).

## Motivo

Cumpre as diretrizes da fonte principal sem pedido de permissão e sem perder a funcionalidade central: as tendências são calculadas sobre as 100 partidas retornadas a cada consulta.

## Trade-offs

- Toda consulta faz 2 requisições à Leetify; a flag `--refresh` não tem efeito sobre esses dados.
- Não há histórico além das últimas 100 partidas.
- Se a Leetify ficar fora do ar ou limitar requisições, não há dados de desempenho para exibir.

## Alternativas consideradas

- **Cache curto com pedido de permissão:** reduziria requisições, mas o responsável optou por não solicitar.
- **Não usar a Leetify:** cobertura muito menor (só demos enviadas manualmente).
- **Persistir os dados mesmo assim:** contraria as diretrizes da Leetify. Rejeitada.
