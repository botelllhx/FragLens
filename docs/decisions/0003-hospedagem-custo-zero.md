# ADR 0003 — Hospedagem com custo zero: Render Free + Neon Free

- **Status:** aceita (substitui o Railway previsto no plano original)
- **Data:** 14/09/2026

## Contexto

O requisito é **custo zero**: o projeto é de teste e não ficará no ar por muito tempo. Situação dos provedores em setembro de 2026:

| Provedor | Plano gratuito                                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Railway  | Free com US$ 1/mês de crédito; workloads param quando acaba                                                                     |
| Render   | Web service grátis com Docker, sem cartão, 750 h/mês, dorme após 15 min, ~1 min para acordar; Postgres grátis expira em 30 dias |
| Neon     | Postgres grátis permanente, sem cartão, 0,5 GB, 100 CU-h/mês, desliga após 5 min ocioso                                         |
| Koyeb    | 1 instância grátis (512 MB / 0,1 vCPU), mas exige cartão                                                                        |
| Fly.io   | Sem plano gratuito para novos usuários                                                                                          |
| Supabase | Postgres grátis de 500 MB, pausa após 1 semana sem uso                                                                          |

## Decisão

- **API:** Render, plano Free, deploy via Dockerfile a partir do GitHub (`render.yaml`).
- **Banco:** Neon, plano Free.
- **Desenvolvimento local:** Docker Compose com PostgreSQL.

## Motivo

É a única combinação sem custo e sem cartão que roda uma API Docker com Postgres permanente.

## Trade-offs

- Cold start de ~1 minuto após 15 minutos sem tráfego. A CLI usará timeout longo e mostrará um aviso no stderr.
- CPU limitada: processamento de demos no servidor será lento; o parse local pela CLI é a alternativa.
- 0,5 GB de banco — suficiente, já que pouco é persistido (ADR 0001).

## Alternativas consideradas

- **Railway Hobby (US$ 5/mês):** mais simples e sem cold start longo, mas não é custo zero.
- **Koyeb Free:** sem cold start de 15 min, mas exige cartão e tem CPU muito baixa.
- **Supabase no lugar do Neon:** válido, mas pausa após 1 semana sem uso.

A aplicação é uma imagem Docker comum, então trocar de provedor não exige mudança de código.
