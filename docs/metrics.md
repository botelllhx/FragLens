# Métricas

> **Código calcula. IA interpreta.** Todas as métricas abaixo são calculadas de forma determinística pelo pacote [`packages/analysis`](../packages/analysis) (funções puras, sem rede nem banco). A IA, quando existir (Fase 8), só recebe os valores já calculados.

## Fonte dos dados

Os contadores de cada partida vêm da **Leetify** (últimas 100 partidas disponíveis). Nada é inventado: quando um valor não pode ser calculado, ele é `null` no JSON e aparece como `—` no terminal.

| Tipo                  | Exemplo                             | Tratamento                                                                                     |
| --------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| Contadores da Leetify | kills, mortes, dano, rounds, trades | Usados como vieram                                                                             |
| Notas da Leetify      | Leetify Rating, aim, utility        | Repassadas sem alteração, só no `--json` ([ADR 0001](decisions/0001-leetify-fonte-ao-vivo.md)) |
| Métricas do FragLens  | K/D, ADR, win rate, tendências      | Calculadas a partir dos contadores (este documento)                                            |

## Regra de agregação

Métricas de um período (ou de um mapa) **somam os contadores antes de dividir**:

```text
K/D do período = soma das kills ÷ soma das mortes
```

e **não** a média dos K/D de cada partida. Exemplo: partidas de 10/2 (K/D 5,00) e 5/10 (K/D 0,50) resultam em 15 ÷ 12 = **1,25**, e não 2,75. Assim, uma partida curta não pesa o mesmo que uma partida longa.

## Arredondamento

| Tipo                    | Casas decimais |
| ----------------------- | -------------- |
| Porcentagens            | 1              |
| K/D, KDA, por round     | 2              |
| ADR, médias por partida | 1              |

## Resumo de desempenho

| Métrica                                 | Fórmula                                                   | Indisponível quando |
| --------------------------------------- | --------------------------------------------------------- | ------------------- |
| Partidas, vitórias, derrotas, empates   | Contagem pelo resultado (rounds ganhos × perdidos)        | —                   |
| Win rate                                | vitórias ÷ partidas × 100 (empates contam no total)       | 0 partidas          |
| Win rate de rounds                      | rounds ganhos ÷ rounds jogados × 100                      | 0 rounds            |
| K/D                                     | kills ÷ mortes; **sem mortes, K/D = kills**               | 0 partidas          |
| KDA                                     | (kills + assistências) ÷ mortes; sem mortes, divide por 1 | 0 partidas          |
| HS%                                     | kills com headshot ÷ kills × 100                          | 0 kills             |
| ADR                                     | dano ÷ rounds jogados                                     | 0 rounds            |
| Kills / mortes / assistências por round | total ÷ rounds jogados                                    | 0 rounds            |
| Kills e mortes médias                   | total ÷ partidas                                          | 0 partidas          |
| Sobrevivência                           | rounds sobrevividos ÷ rounds jogados × 100                | 0 rounds            |
| Multi-kills                             | soma dos rounds com 2, 3, 4 e 5 kills                     | —                   |
| Rounds com multi-kill                   | rounds com 2+ kills ÷ rounds jogados × 100                | 0 rounds            |
| Flash assists por partida               | flash assists ÷ partidas                                  | 0 partidas          |
| Utilitários por round                   | (flashes + HE + molotovs + smokes lançadas) ÷ rounds      | 0 rounds            |
| Inimigos cegados por flash              | inimigos atingidos por flash ÷ flashes lançadas           | 0 flashes           |
| Tentativa de trade                      | tentativas de trade ÷ oportunidades de trade × 100        | 0 oportunidades     |
| Sucesso no trade                        | trades concretizados ÷ tentativas × 100                   | 0 tentativas        |
| Mortes trocadas                         | mortes trocadas com sucesso ÷ tentativas de troca × 100   | 0 tentativas        |

As definições de "oportunidade" e "tentativa" de trade são as da Leetify, que fornece esses contadores.

## Por mapa (`fraglens maps`)

As mesmas fórmulas do resumo, aplicadas às partidas de cada mapa. Os mapas são ordenados do mais jogado para o menos jogado (desempate: maior win rate, depois nome).

Mapas com **menos de 5 partidas** são marcados como **amostra pequena** (`lowSample: true`, `*` no terminal): os números existem, mas variam muito com uma única partida.

### Melhor e pior mapa

Exibidos em `fraglens analyze` (`mapHighlights` no JSON):

1. Consideram apenas mapas com **pelo menos 5 partidas**.
2. Ordenam por **win rate**; em caso de empate, por **K/D**; depois, por número de partidas.
3. Melhor = primeiro da ordem; pior = último.
4. Com **menos de 2 mapas** elegíveis, não há melhor nem pior (`best` e `worst` são `null`).

É uma comparação de números, não uma recomendação: um mapa "pior" com 45% de vitórias pode estar dentro da variação normal.

## Tendências (`fraglens progress`)

### Sequências

| Métrica                                | Definição                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| Sequência atual                        | Quantas partidas seguidas, a partir da mais recente, tiveram o mesmo resultado |
| Maior sequência de vitórias / derrotas | Maior série consecutiva no período analisado                                   |

**Empates interrompem** sequências de vitórias e de derrotas.

### Recente × anterior

Compara as **10 partidas mais recentes** com as **20 imediatamente anteriores** (win rate, K/D, ADR e HS%).

- A variação só é calculada quando **cada período tem pelo menos 5 partidas**. Caso contrário: "dados insuficientes".
- Direção:

| Métrica  | Considera estável se a variação for menor que |
| -------- | --------------------------------------------- |
| Win rate | 5 pontos percentuais                          |
| K/D      | 0,05                                          |
| ADR      | 3                                             |
| HS%      | 2 pontos percentuais                          |

Variação igual ou maior que o limite: **subiu** (▲) ou **caiu** (▼). Para as quatro métricas, subir significa melhora.

### Evolução em blocos

As partidas são divididas em **blocos de 10 partidas consecutivas**, começando pela mais recente (o bloco mais recente é sempre completo; o mais antigo pode ter menos partidas). Cada bloco mostra win rate, K/D, ADR e HS%, do mais antigo para o mais recente.

Blocos por quantidade de partidas, em vez de semanas ou meses, evitam períodos com uma ou duas partidas que distorceriam a evolução.

## O que ainda não é calculado

| Métrica                           | Motivo                                                | Quando             |
| --------------------------------- | ----------------------------------------------------- | ------------------ |
| K/D e win rate por lado (T/CT)    | A Leetify não fornece contadores por lado por partida | Com demos (Fase 6) |
| Opening kills / deaths (contagem) | Só existe o percentual agregado da Leetify            | Com demos (Fase 6) |
| Clutches (tentativas e vitórias)  | Não fornecido por partida                             | Com demos (Fase 6) |
| Dano exato de utilitários         | Apenas média de HE                                    | Com demos (Fase 6) |
| Premier rating ao longo do tempo  | Só o valor atual está disponível                      | Sem previsão       |
