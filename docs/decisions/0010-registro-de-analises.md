# ADR 0010 — Registro de análises sem guardar resultados

- **Status:** aceita
- **Data:** 14/09/2026

## Contexto

O requisito do projeto pede registrar `lastFetchedAt`, `lastAnalyzedAt` e `dataVersion`. O resultado de `fraglens analyze` é calculado a partir das partidas da Leetify, e as diretrizes da Leetify pedem que seus dados não sejam armazenados ([ADR 0001](0001-leetify-fonte-ao-vivo.md)). Guardar o relatório (ou as métricas derivadas dele) seria, na prática, guardar os dados da Leetify.

## Decisão

- Cada execução de `analyze` cria um registro em `sync_jobs` com tipo `ANALYSIS`, contendo apenas **status, início, fim e código de erro**.
- `lastAnalyzedAt` é o fim da última análise concluída com sucesso, exibido em `fraglens cache`.
- O relatório em si **não é persistido**: toda análise é recalculada a partir de dados buscados na hora.
- O perfil Steam usado na análise continua com o cache normal (dado próprio, [ADR 0001](0001-leetify-fonte-ao-vivo.md)).

## Motivo

Atende ao requisito de rastrear quando cada jogador foi analisado, sem contrariar as diretrizes da Leetify, e mantém a base para mover análises para uma fila assíncrona no futuro (o job já tem status e erro).

## Trade-offs

- Não há histórico de relatórios; comparar "análise de hoje × análise do mês passado" não é possível com os dados da Leetify.
- Cada `analyze` faz 2 requisições à Leetify (mais o perfil Steam, se o cache expirou).

## Alternativas consideradas

- **Guardar o relatório completo com TTL:** evitaria recalcular, mas guarda dados derivados da Leetify. Rejeitada.
- **Tabela `analyses` separada:** desnecessária enquanto só data e status são registrados; `sync_jobs` já cobre o caso.
