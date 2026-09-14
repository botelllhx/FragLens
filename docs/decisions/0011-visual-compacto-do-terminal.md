# ADR 0011 — Visual compacto com cartões no terminal

- **Status:** aceita
- **Data:** 14/09/2026

## Contexto

Com os dados reais, o `fraglens analyze` passava de 90 linhas. Cada seção gastava 4 linhas só com separador e título, os números principais ficavam misturados aos secundários, as linhas divisórias tinham largura fixa (48 colunas) enquanto as tabelas passavam de 90, e nada indicava que a consulta estava em andamento durante os 1 a 2 segundos de espera.

## Decisão

- **Seções com o título na linha divisória:** `── MAPAS · 100 partidas · 15/05/2026 a 13/09/2026 ───`.
- **Cabeçalho único** com nome, SteamID64 e uma linha de contexto (país, horas, banimentos, ranks), no lugar da seção "Jogador".
- **Cartões** para os números principais (vitórias, K/D, ADR, HS%, KDA); os detalhes ficam numa linha discreta (`analyze`) ou em lista (`progress`).
- **Visual:** forma recente em quadrados coloridos, barras de win rate nos mapas e na evolução, melhor e pior mapa marcados na própria tabela.
- **Tendência** como `anterior → recente` seguida da variação, e sequências em uma linha.
- **Rodapé** numa linha discreta, quebrada na largura do terminal.
- **Largura:** as linhas divisórias e o rodapé acompanham as colunas do terminal, limitadas entre 60 e 100; com a saída redirecionada, usam 80.
- **Indicador de carregamento** no stderr, apenas em terminal interativo e nunca com `--json` ou `--verbose`.
- As tabelas perderam colunas pouco usadas (médias de kills e mortes por mapa); os valores continuam no `--json`.

## Motivo

O `analyze` caiu para cerca de 40 linhas, e o que mais importa (win rate, K/D, ADR, melhor e pior mapa, tendência) aparece sem rolar a tela. O stdout continua recebendo somente o resultado, então redirecionar a saída não é afetado.

## Trade-offs

- Sem cores, os quadrados da forma recente viram letras (V, D, E); a cor não pode ser a única informação.
- As tabelas não são cortadas em terminais estreitos: com menos de 80 colunas, algumas linhas quebram.
- Os testes dependem do texto exato da saída e precisaram ser reescritos.

## Alternativas consideradas

- **Painéis com bordas (caixas):** mais bonito em terminais modernos, mas quebra com fontes sem os caracteres de borda, ocupa mais colunas e fica pior quando copiado.
- **Manter o layout e só adicionar cores:** não resolvia o tamanho do relatório.
- **Bibliotecas de interface (Ink, blessed):** dependências pesadas para uma saída que não é interativa.
