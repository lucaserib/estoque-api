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

## Fase 2 — Uma fórmula, um lugar

**Construído:**
- **C1** (`relatorios/resumoDia.ts`): o resumo do período e o ponto de equilíbrio ainda subtraíam `descontos` da receita líquida, contando o desconto de campanha duas vezes (o `unit_price` do ML já vem líquido, Ciclo 8). As duas fórmulas passaram a ser `faturamentoBruto − cancelamentos − impostos`, iguais à DRE.
- **C3** (`api/financeiro/resumo-periodo/route.ts`): a rota passava `new Date(desde)`/`new Date(ate)` direto para `gerarResumoPeriodo`, sem normalizar para início/fim do dia em SP — um `ate` à meia-noite UTC excluía o dia inteiro em SP (UTC-3). Corrigido com `inicioDoDia`/`fimDoDia` (`dominio/periodo.ts`), os mesmos helpers que a DRE já usa.
- **C4 / item 1 (a entrega principal da fase): tarifa, frete, retenção e líquido pelo pagamento real do Mercado Pago.**
  - `canais/mercadoLivre/mapeadorPagamento.ts` (novo): classifica cada cobrança de `charges_details` em tarifa (`ml_sale_fee`, `mp_processing_fee`, `mp_financing_*`), frete (`type: shipping` ou `shp_*`) ou retenção de dívida (`fee_spl`, `metadata.source === "direct-charges"` ou `reserve_id` presente) — a checagem de retenção vem **antes** da de tarifa, porque `fee_spl.type` é `"fee"`, igual ao das tarifas. Nenhuma cobrança desconhecida é descartada: entra em `cobrancas` e em `desconhecidos` para revisão.
  - `canais/tipos.ts`: novos tipos canal-agnósticos `PagamentoNormalizado`/`CobrancaPagamentoNormalizada` e o método opcional `obterPagamentoDetalhado` no `AdaptadorCanalFinanceiro`; `VendaCanalNormalizada` ganhou `pagamentoExternoId`.
  - `canais/mercadoLivre/mapeador.ts`: `mapearPedido` extrai o `id` do pagamento `approved` (ou o primeiro da lista) de `pedido.payments`.
  - `canais/mercadoLivre/cliente.ts`: `obterPagamentoDetalhado` busca `GET https://api.mercadopago.com/v1/payments/{id}` e aplica `mapearPagamento`.
  - `ingestao/sincronizador.ts`: quando o pagamento está disponível, `tarifaVenda` é rateada entre os itens a partir do valor confirmado (substitui o `sale_fee` estimado), `freteVendedor` usa o valor confirmado (prioridade sobre `/shipments/{id}/costs`), e `retencaoDividas`/`statusLiberacao`/`valorLiquidoReceber` gravam o dado real na `VendaCanal`. Sem pagamento disponível, cai na estimativa de sempre (`confianca: ESTIMADO`) — nada deixa de ser calculado por causa disso. Cada cobrança do pagamento é persistida em `CobrancaPagamento` (nova tabela), idempotente por `vendaId + pagamentoExternoId + nome`.
  - Teste com o payload exato do prompt (pedido 2000019043297364): tarifa 2,99 (0,04+0,71+2,24), frete 6,85, retenção 12,14, líquido 12,72 — e o teste de integração em `sincronizador.test.ts` confirmando que esses valores chegam na `VendaCanal` e nos itens.
- **Item 3 — definições fixas**: `docs/financeiro/definicoes.md` (novo) documenta faturamento bruto, cancelamentos, receita líquida, tarifa, frete, retenção, líquido a receber, margem de contribuição, CMV e lucro líquido com a fórmula exata e a prioridade de fontes de cada uma; `docs/financeiro/fontes-mercado-livre.md` ganhou a seção "Ciclo 9" com o payload confirmado de `charges_details`.
- **Item 7 — recalcular com o novo cálculo**: `TarefaSincronizacaoFinanceira.forcar` (novo campo, migração aditiva) passa a viajar por `enfileirarTarefa`/`enfileirarPeriodo`/`executarPedidosPeriodo` até `deveIgnorarPedido` — com `forcar: true`, um pedido já completo e sem mudança no ML é reprocessado do zero (necessário para que vendas antigas, ingeridas com a tarifa/frete estimados, passem a usar o pagamento real). `POST /api/financeiro/sincronizacao/importar-historico` aceita `forcar` no corpo e repassa para a fila.

**Deixado pendente, com motivo:**
- **Item 2 — serviço único `relatorios/consolidado.ts`** servindo DRE, resumo do dia, resumo do período, série diária, lucro por produto, dashboard e ficha do produto **não foi construído**. É uma reescrita de 6 pontos de consumo distintos, e as duas divergências que o prompt mediu em produção (C1, C3) já foram corrigidas nas fórmulas existentes — o risco de uma reescrita completa agora, com as Fases 3 a 7 ainda inteiras pela frente, superou o benefício incremental. Fica registrado em `docs/financeiro/definicoes.md` como dívida explícita para um ciclo futuro.
- **C5 — `mapeadorCobrancas.ts` contra o payload real de billing**: continua lendo campos (`charge_type`, `amount`, `id`) não confirmados contra uma resposta real; o diagnóstico (`?tipo=cobrancas`) já existe para capturar o payload bruto quando alguém rodar em produção, mas a reescrita do mapeador fica para quando isso acontecer — sem o payload real, qualquer reescrita seria outro palpite.
- **C6 — diagnóstico de ads com mensagem específica**: o endpoint de ads continua devolvendo `[]` sem distinguir "sem acesso" de "endpoint errado" — mesma razão do C5, sem uma resposta real da API de advertising não há como saber qual mensagem mostrar sem arriscar informação errada.
- **Item 6 — mensagem de CMV incompleto e "aplicar custo retroativo"**: funcionalidade de UI que depende do serviço único (item 2) para não duplicar lógica entre telas; fica para quando a consolidação acontecer.
- **O recálculo dos últimos 12 meses (item 7) foi construído mas não disparado**: a infraestrutura (`forcar: true` via `importar-historico`) está pronta; disparar o reprocessamento de fato é uma ação de operação (consome orçamento de chamadas ao Mercado Pago, uma por pagamento) que cabe ao Lucas rodar depois do deploy desta fase, não a cada execução do ciclo.

**Resultado ao final da fase:** `tsc`/`lint`/`next build` limpos; `npm test` com 575 testes passando (11 novos).

## Fase 3 — Frete configurável

**Construído:**
- **Prioridade completa de resolução do frete** (item 2), em `ingestao/sincronizador.ts`'s `resolverFrete`, com a origem gravada por venda (`VendaCanal.freteOrigem`, novo enum `FreteOrigem`): ajuste manual → pagamento confirmado do Mercado Pago (Fase 2) → custo real do envio pelo canal (`/shipments/{id}/costs`, com rateio de pacote) → custo de frete cadastrado no produto → regra padrão por logística → desconhecido. Cada pedido grava qual fonte foi usada, não só o valor.
- **Ajuste manual por venda** (item 2.1): `VendaCanal.freteAjusteManual`/`freteAjusteManualMotivo`/`freteAjusteManualUserId`/`freteAjusteManualEm` (novos campos) + `PATCH /api/financeiro/vendas/[id]/frete` (motivo obrigatório ao definir, `valorReais: null` para limpar e reprocessar a partir da fonte automática). Testado explicitamente que o ajuste **sobrevive a reprocessamento** — uma nova sincronização do mesmo pedido não o sobrescreve — e que limpar o ajuste dispara `ingerirPedidoMercadoLivre` para derivar de novo.
- **Custo de frete por produto** (item 2.3, escopo "por produto" — ver pendência abaixo sobre "por anúncio"): `Produto.custoFreteManual` (novo campo), somado por item só quando **todos** os itens do pedido têm produto vinculado e custo cadastrado — caso contrário essa fonte não se aplica e cai para a próxima da prioridade.
- **Custo padrão por logística** (item 2.4): novo modelo `RegraFreteLogistica` (`FIXO` em centavos ou `PERCENTUAL` do faturamento do pedido), CRUD em `GET/POST/DELETE /api/financeiro/configuracoes/regras-frete`, com tela em Financeiro → Configurações → "Frete por logística" (tabela + formulário de adicionar/remover). `ConfiguracaoGeral.custoEnvioFlex` (Ciclo 8) continua funcionando como fallback específico para `self_service` quando não há regra cadastrada — compatibilidade preservada, nenhuma conta perde o comportamento atual.
- **Embalagem por produto** (item 5): `Produto.custoEmbalagem` (novo campo), somado ao custo médio na resolução do CMV (`resolverCustoAtualDoProduto`) — afeta toda venda nova ou reprocessada do produto.
- **Recalcular vendas afetadas quando uma regra muda** (item 6): reaproveitada a fila `forcar: true` da Fase 2 (`POST /api/financeiro/sincronizacao/importar-historico`) — nem precisou de endpoint novo, já reprocessa o período pedido do zero respeitando ajustes manuais existentes.
- Testes: 5 novos cenários em `sincronizador.test.ts` cobrindo exatamente as 4 prioridades (produto, logística FIXO, logística PERCENTUAL, ajuste manual sobrevivendo a reprocessamento, limpeza do ajuste voltando à fonte automática) + testes das 3 rotas novas (frete manual, regras de logística, custos de frete/embalagem do produto).

**Deixado pendente, com motivo:**
- **Item 1 — detalhe completo do frete por venda** (quanto o comprador pagou, quanto o ML subsidiou): a venda já guarda valor final + origem; o detalhamento do subsídio (`discounts[].promoted_amount`) ficou de fora porque nenhuma tela consome esse dado ainda — construir sem um consumidor seria especular sobre o formato certo.
- **Item 3 — frete recebido do comprador como receita** (linha "Receita de frete" na DRE): depende do serviço único de relatórios (Fase 2, item 2, também deferido) para não duplicar a composição da DRE em mais um lugar.
- **Item 4 — frete de envio ao Full (inbound)**: funcionalidade nova de ponta a ponta (cadastro de remessas, rateio por unidade, aplicação retroativa) sem relação com corrigir cálculos existentes — o maior item de risco/esforço da fase, adiado para não comprometer o orçamento das Fases 4 a 7 ainda pela frente nesta mesma execução.
- **Tela de edição de custo de frete e embalagem por produto**: os campos existem e já são lidos pela prioridade 4 e pelo CMV, com uma rota dedicada (`PATCH /api/produtos/[id]/custos-frete`) pronta para uma futura UI — mas não construí a tela em si. A rota de edição de produto existente (`PUT /api/produtos`) substitui por `null` qualquer campo não enviado; colar os dois campos novos nela sem atualizar o formulário correspondente apagaria silenciosamente valores já configurados a cada edição de nome/SKU, então optei pela rota isolada em vez de arriscar esse efeito colateral sob pressão de tempo.
- **Granularidade "por anúncio"**: o prompt pede custo de frete "por produto/anúncio"; implementei só por produto (`Produto.custoFreteManual`), já que o CMV e os demais custos do sistema também são todos por produto, não por anúncio individual — manter essa mesma granularidade evita uma exceção isolada.

**Resultado ao final da fase:** `tsc`/`lint`/`next build` limpos; `npm test` com 601 testes passando (26 novos).
