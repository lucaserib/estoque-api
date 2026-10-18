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

## Fase 1 — Sincronização correta e completa

**Construído:**
- **Fila de tarefas persistida** (`TarefaSincronizacaoFinanceira`, novo modelo): `enfileirarTarefa`/`executarFila` em `ingestao/fila.ts`. Cada execução pega a tarefa de maior prioridade `PENDENTE` ou `EM_ANDAMENTO` com a trava expirada, processa até um orçamento de tempo (`FINANCEIRO_TEMPO_MAXIMO_LOTE_MS`, default 40s) e sempre libera a trava antes de devolver o controle — mesmo quando a tarefa ainda não terminou (**bug real encontrado e corrigido durante o teste do cenário do prompt**: a trava de 2 min ficava presa depois de um lote parcial, impedindo a própria chamada seguinte de continuar — só uma chamada de um processo *diferente* deveria ser bloqueada).
- **`PEDIDOS_PERIODO`** busca por `order.date_created` (via `listarPedidosCriadosNoPeriodo`, Fase 0), com cursor por dia + índice dentro do dia, checado a cada pedido — corrige **S1** (`PERIODO` ignorava o período pedido) e **S3** (sem orçamento de tempo, "timeout" deixava `processados: 0` em loop).
- **Menos chamadas por pedido** (S5): como `/orders/search` já devolve o pedido completo, `ingerirPedidoBrutoComRegistro` usa o objeto já em mãos — só busca descontos quando a tag `order_has_discount` está presente, sem `GET /orders/{id}` redundante.
- **Pular o que não mudou** (item 4): se `last_updated` do pedido bate com `VendaCanal.atualizadoNoCanalEm` gravado e a venda está completa, não reprocessa — a não ser que o pedido realmente tenha mudado.
- **`PEDIDOS_INCREMENTAL`** continua usando `order.date_last_updated` (correto para "o que mudou desde a última sync"), agora dentro da mesma fila, com cursor salvo por página.
- **Backfill unificado**: `continuarBackfill`/`reprocessarUltimosDias` (Ciclo 8) foram removidos — `BACKFILL` e `PERIODO` agora são a mesma coisa (`PEDIDOS_PERIODO` com um período maior e prioridade mais alta), evitando dois mecanismos de sincronização paralelos. `orquestrador.sincronizarFinanceiro`, o cron e `importar-historico` passam a enfileirar+executar pela fila.
- **Ads de todos os dias do período** (S6): o orquestrador deixou de buscar só "ontem" e passou a percorrer cada dia entre `desde` e `ate`.
- **Trava mais curta** (S3): `MINUTOS_TRAVA_EXPIRADA` do orquestrador caiu de 10 para 2 minutos.
- **Início automático real** (item 5): `GET /api/financeiro/sincronizacao/status` — chamado por toda tela do Financeiro ao montar — verifica se existe algum `PEDIDOS_PERIODO` concluído; se não, enfileira um de 365 dias (prioridade alta) e já drena um pedaço da fila (8s) na própria chamada. `BotaoAtualizarFinanceiro` passou a ficar chamando esse status a cada 2s enquanto houver `emAndamento`, mostrando "Importando suas vendas: N pedido(s)" sem precisar de clique.
- **Saúde dos webhooks** (item 7): o mesmo status devolve `ultimoWebhookPorTopico` (via `MercadoLivreWebhook`) e `alertaWebhooksAusentes` (true quando houve venda nas últimas 24h mas nenhum webhook `orders_v2` chegou no mesmo período) — mostrado como selo de aviso no componente.
- **Cron diário** (item 8): por conta ativa, enfileira o incremental e drena a fila (até 3 rodadas de 8s — cobre também qualquer `PEDIDOS_PERIODO` pendente de um backfill grande), e agora roda a **conferência** (Fase 0) do mês corrente e do mês anterior, importando os faltantes automaticamente.
- Testes novos cobrindo exatamente os três cenários do item 9 do prompt: período de 3 dias com 120 pedidos e "timeout" simulado retomando do pedido certo até concluir; pedido sem mudança não reprocessado; pedido alterado reprocessado mesmo com venda completa.

**Deixado pendente, com motivo:**
- **Concorrência de 4 pedidos por vez**: os pedidos de uma página são processados em série, não em paralelo. Dado que a ingestão já é idempotente e o orçamento de tempo+cursor por pedido já resolve o problema de "nunca terminar" (a causa raiz de S3/S4), a paralelização ficou como otimização de performance, não de correção, fora do tempo desta fase.
- **`PAGAMENTOS`, `PRODUTOS_ML`, `BLING_PRODUTOS`, `BLING_ESTOQUE`, `BLING_CONTAS`**: os tipos já existem no enum da fila (schema pronto), mas nenhum chamador os enfileira ainda e o executor não tem handler — `PAGAMENTOS` é construído na Fase 2 (fonte real de tarifa/frete/líquido); os `BLING_*`/`PRODUTOS_ML` entram quando a Fase 5 unificar a sincronização de produtos e do Bling.
- **"Importando X de Y pedidos"**: o progresso mostrado é "N pedidos processados", não "N de Y" — o `Y` (total) exigiria uma chamada extra a `paging.total` por dia só para exibição, sem valor para a correção em si; fica como melhoria de UI futura.

**Resultado ao final da fase:** `tsc`/`lint`/`next build` limpos; `npm test` com 564 testes passando.
