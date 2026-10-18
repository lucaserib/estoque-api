# Auditoria — Ciclo 9: Números que batem com o Mercado Livre

Registro vivo de execução do `PROMPT-CICLO-9-FINANCEIRO-CONFIAVEL.md`, uma seção por fase.

## Alvo de aceite (medido em produção, 18/10/2026, conta LEAPSTORE)

| Período | Mercado Livre (real) | Leap Stock antes do ciclo |
|---|---|---|
| Outubro, dias 1 a 18 | 152 pedidos pagos · 181 unidades · R$ 5.440,72 · 6 cancelados (R$ 154,70) · R$ 582,09 de `sale_fee` | DRE: 51 pedidos, R$ 1.969,60 · resumo do período: 45 pedidos, R$ 1.729,40 |
| Setembro | 103 pagos · 120 unidades · R$ 3.366,11 · 10 cancelados (R$ 333,70) · R$ 413,81 de `sale_fee` | 1 pedido, cancelado |

Esses números são o alvo de 100% de cobertura verificado pela ferramenta de conferência (Fase 0) e revisitado na Fase 7.

## Fase 0 — Conferência automática contra o Mercado Livre

**Construído:**
- `listarPedidosCriadosNoPeriodo` (`canais/mercadoLivre/cliente.ts`): busca pedidos **direto no ML** por `order.date_created.from/to`, fatiada por dia (evita o limite de offset de 10.000) — já devolve o pedido completo de `/orders/search`, sem precisar de `GET /orders/{id}` por pedido.
- `relatorios/conferencia.ts`: `conferirMes(userId, accountId, competencia)` busca todos os pedidos do mês no ML, usa o mesmo `mapearPedido` da ingestão para normalizar, e compara com o `VendaCanal` gravado — devolve totais ML × app (pedidos, unidades, faturamento, cancelamentos, tarifa), a lista de pedidos faltando e as divergências campo a campo (faturamento, status, unidades). `importarFaltantes`/`reprocessarDivergentes` chamam `ingerirPedidoMercadoLivre` para cada pedido.
- Rota `GET /api/financeiro/conferencia?mes=AAAA-MM` (ADMIN) e `POST` com `{acao: "importar_faltantes" | "reprocessar_divergentes", pedidosExternoId}`.
- Tela **Financeiro → Conferência** (link na sidebar, só para ADMIN): seletor de mês, totais lado a lado, lista de pedidos faltando e tabela de divergências, com os dois botões de ação.
- Teste com mês sintético (5 pedidos no ML, 2 faltando no app, 1 com faturamento divergente) confirmando cobertura 60% e a divergência exata.

**Deixado pendente, com motivo:**
- A conferência hoje compara **faturamento, status e unidades** apenas — ainda não compara tarifa/frete/líquido pedido a pedido (a Fase 2 é que corrige a fonte desses três campos; comparar antes disso só mostraria a mesma divergência que a Fase 2 já vai corrigir). A tabela de divergências já está pronta para ganhar mais campos quando a Fase 2 terminar.
- A busca por `order.date_created` fatiada por dia ainda não tem orçamento de tempo nem cursor persistido (isso é o item 2/3 da Fase 1) — para um mês com volume normal (até alguns milhares de pedidos) a chamada síncrona da rota deve caber no `maxDuration` de 60s; meses muito maiores podem precisar da fila da Fase 1.

**Resultado ao final da fase:** `tsc`/`lint`/`next build` limpos; `npm test` com 560 testes passando (13 novos).
