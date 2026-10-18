# Leap Stock — Ciclo 9: Números que batem com o Mercado Livre (financeiro, frete, saldo e produtos)

Documento autocontido de execução para o Claude Code. Os Ciclos 7 e 8 montaram a arquitetura do Financeiro e ela está boa. **Em produção, porém, os números não batem com o Mercado Livre.** Este ciclo não cria telas novas por criar: ele faz cada número estar certo, com prova, e só depois acrescenta as opções pedidas (frete configurável e saldo real).

Execute as fases **na ordem**. Ao final de cada fase: `npx tsc --noEmit`, `npx next lint`, `npm test`, commit descritivo em português e registro em `docs/AUDITORIA-CICLO-9.md`. Ao final, `git push origin master`.

**Regras inegociáveis:** dinheiro em centavos (`Int`); dia e mês sempre no fuso `America/Sao_Paulo`; idempotência por chave externa; escopo por `contaId`; nenhum número inventado ("—" com motivo quando faltar); migrações aditivas com `IF NOT EXISTS`; sem comentários no código; TypeScript estrito; componentes de UI existentes; responsivo e nos dois temas. **Regra nova: uma fórmula, um lugar.** Nenhuma tela ou rota calcula faturamento, margem ou lucro por conta própria; todas leem o mesmo serviço (Fase 2).

---

## Auditoria feita em produção em 18/10/2026 (conta LEAPSTORE)

### 1. Números do app × Mercado Livre (fonte: `/orders/search`, data de criação no fuso de SP)

| Período | Mercado Livre (real) | Leap Stock hoje |
|---|---|---|
| Outubro, dias 1 a 18 | **152 pedidos pagos · 181 unidades · R$ 5.440,72 de faturamento · 6 cancelados (R$ 154,70) · R$ 582,09 de `sale_fee`** | DRE: 51 pedidos, R$ 1.969,60 · resumo do período: 45 pedidos, R$ 1.729,40 |
| Setembro | **103 pagos · 120 unidades · R$ 3.366,11 · 10 cancelados (R$ 333,70) · R$ 413,81 de `sale_fee`** | 1 pedido, cancelado |

O app tem cerca de **30% das vendas de outubro e quase nada de setembro**. A DRE e o resumo do mesmo mês ainda dão números **diferentes entre si**.

### 2. Causas (cada uma confirmada no código e/ou em pedido real)

**Sincronização ("só traz o dia")**
- **S1** — `sincronizarFinanceiro` no modo `PERIODO` chama `reprocessarUltimosDias(accountId, dias)`, mas essa função **ignora `dias`** quando existe `ultimaSincronizacaoFinanceiraEm` e usa só "última sync − 2 h". Por isso o botão "Atualizar" da DRE traz só as últimas horas.
- **S2** — Toda busca usa `order.date_last_updated.from/to`. Para reprocessar um mês ou importar histórico é preciso **`order.date_created`**. Um pedido de março que não mudou desde março nunca aparece.
- **S3** — `PERIODO` e `INCREMENTAL` percorrem todas as páginas **numa única requisição**, sem orçamento de tempo e sem cursor. Estoura os 60 s, o registro fica `EM_ANDAMENTO`, a trava segura a conta por 10 min e a tela recebe `processados: 0` em loop (status real visto: `{"emAndamento":{"tipo":"PERIODO","processados":0}}`).
- **S4** — O backfill salva o cursor **por página de 50 pedidos**. Cada pedido faz 4 a 6 chamadas (pedido, descontos, envio, custo do envio, pagamento no MP), então uma página passa de 60 s e nunca termina. Além disso, **nenhuma tela inicia o backfill** (o início automático do Ciclo 8 não existe: o único chamador é o cron).
- **S5** — Os pedidos são buscados um a um com `GET /orders/{id}`, embora `/orders/search` já devolva o pedido completo. É desperdício de chamadas.
- **S6** — Ads só busca "ontem", qualquer que seja o período pedido.
- **S7** — Nada de webhook chega ao financeiro: as vendas de hoje foram criadas pela sync manual (`createdAt` 16:15 para um pedido das 16:01). É preciso conferir as notificações do app ML e registrar o recebimento.

**Cálculos ("lucro e faturamento errados", "nenhum número bate")**
- **C1** — O desconto ainda é subtraído no **resumo do período** e no **ponto de equilíbrio** (`receitaLiquida = bruto − cancelamentos − descontos − impostos` em `relatorios/resumoDia.ts`). A DRE já foi corrigida, o resumo não. Resultado real: **margem de contribuição de −1815%** em outubro.
- **C2** — Três fórmulas diferentes de faturamento, margem e lucro: DRE (`relatorios/dre.ts`), resumo do período e ponto de equilíbrio (`relatorios/resumoDia.ts`) e dashboard/produto. O "lucro líquido" do resumo é MC − custo fixo rateado e ignora cobranças, armazenagem Full, ads e despesas variáveis; o da DRE é outro.
- **C3** — Janelas de data diferentes: o resumo recebe `ate=2026-10-18T00:00Z` (exclui o dia de hoje e usa UTC); a DRE usa o mês de SP.
- **C4** — **A tarifa real e o frete real estão no pagamento do Mercado Pago e não são usados.** O pagamento real (`GET https://api.mercadopago.com/v1/payments/{id}`) traz `charges_details` com cada cobrança. Pedido 2000019043297364 (R$ 34,70):
  - `ml_sale_fee` 2,24 · `mp_processing_fee` 0,71 · `mp_financing_1x_fee` 0,04 → soma 2,99 = `sale_fee` do pedido
  - `shp_fulfillment` 6,85 (frete do vendedor, `type: shipping`, com `metadata.shipment_id`)
  - **`fee_spl` 12,14** (`source: direct-charges`, `source_detail: debt-engine-api`, com `reserve_id`): retenção que o ML desconta da venda para quitar dívidas da conta (fatura, Full, ads). **Não é custo desta venda**, mas explica o caixa.
  - `transaction_details.net_received_amount` 12,72 = 34,70 − 2,24 − 0,71 − 0,04 − 6,85 − 12,14
  - `money_release_date` 2026-11-16, `money_release_status: pending`
  - `fee_details` vem vazio; a fonte é `charges_details`, com `amounts.original` e `amounts.refunded`.
- **C5** — Cobranças (billing): `mapeadorCobrancas.ts` lê campos que **não existem** (`charge_type`, `amount`, `id`). Em produção todas as linhas vêm `DESCONHECIDO`, valor 0 e **id vazio**, e como o id é a chave única, tudo colapsa numa linha só. Conciliação de setembro: "fatura 0". A armazenagem Full, os ads cobrados e as demais tarifas **nunca entram na DRE**.
- **C6** — Ads: o diagnóstico devolve `[]` para qualquer dia. O endpoint ou o anunciante está errado, ou a conta não tem acesso, e a tela não diz qual.

**Saldo**
- **B1** — Não existe nenhuma conta financeira cadastrada (`/api/financeiro/contas-financeiras` → `[]`) e o saldo do Mercado Pago **não é lido** da API. O "saldo em conta" é calculado a partir de zero. O saldo futuro (soma das liberações pendentes) funciona porque vem de `money_release_date`.

**Produtos ("sincronização de produtos errada")**
- **P1** — **O armazém "Full (Mercado Livre)" está com `tipo: LOCAL`.** `produtos/vendas-ml/route.ts` cria esse armazém sem `tipo` (o padrão é LOCAL). O estoque do Full é então somado como estoque local na reposição, no valor do estoque e no **auto-stock**, que manda a quantidade do Full para anúncios que não são Full.
- **P2** — Preço do anúncio errado: o anúncio MLB4019629019 está gravado com `mlPrice` R$ 45,70, mas foi vendido hoje a R$ 34,70. A sincronização escolhe a **primeira** promoção de `/items/{id}/prices`. O preço que o comprador paga vem de `GET /items/{id}/sale_price?context=channel_marketplace` (`amount`, `regular_amount`). Existem **três implementações** dessa sincronização (`mercadoLivreService.ts` ~l.919 e ~l.2776, `api/mercadolivre/sync/route.ts` ~l.154).
- **P3** — Vínculo suspeito: o anúncio MLB4019629019 (SKU do ML `KITADAPPRE`) está ligado ao produto local de SKU `KITADAPUSB` e nome diferente. O CMV de todas as vendas desse anúncio usa o custo desse produto. Vínculos feitos por similaridade precisam de confirmação explícita.
- **P4** — Bling: `ultimaSincronizacaoProdutos` e `ultimaSincronizacaoEstoque` estão **nulos**, ou seja, nenhuma sincronização de produtos ou estoque do Bling terminou desde a reconexão. A imagem do produto vinda do Bling é uma URL S3 assinada com `Expires` (temporária) e está gravada como definitiva.
- **P5** — Pendências atuais: 35 produtos sem fornecedor, 19 sem custo, 25 sem preço e 7 sem tarifa. O CMV e o lucro desses produtos ficam incompletos, e isso precisa aparecer na DRE.

### 3. Payload real do pagamento (usar como fixture, sem dados do comprador)
```json
{"id":183824139095,"status":"approved","status_detail":"accredited","external_reference":"2000019043297364","payment_method_id":"account_money","installments":1,
 "date_approved":"2026-10-18T12:01:31.000-04:00","money_release_date":"2026-11-16T12:01:31.000-04:00","money_release_status":"pending",
 "transaction_details":{"net_received_amount":12.72,"total_paid_amount":34.7},"fee_details":[],
 "charges_details":[
  {"name":"mp_financing_1x_fee","type":"fee","accounts":{"from":"collector","to":"mp"},"amounts":{"original":0.04,"refunded":0}},
  {"name":"mp_processing_fee","type":"fee","accounts":{"from":"collector","to":"mp"},"amounts":{"original":0.71,"refunded":0}},
  {"name":"ml_sale_fee","type":"fee","accounts":{"from":"collector","to":"ml"},"amounts":{"original":2.24,"refunded":0}},
  {"name":"shp_fulfillment","type":"shipping","accounts":{"from":"collector","to":"1745333938"},"amounts":{"original":6.85,"refunded":0},"metadata":{"shipment_id":48288135572,"source":"deferred-charges","source_detail":"shipping-account-movements"}},
  {"name":"fee_spl","type":"fee","accounts":{"from":"collector","to":"507154075"},"amounts":{"original":12.14,"refunded":0},"metadata":{"source":"direct-charges","source_detail":"debt-engine-api"},"reserve_id":188702095998}]}
```
Envio do mesmo pedido (`/shipments/48288135572`): `logistic_type: "fulfillment"`, `mode: "me2"`, `base_cost: 9.79`. Custo (`/shipments/{id}/costs`): `gross_amount 9.79`, `senders[0].cost 6.85`, `senders[0].discounts[0] {type: "mandatory", rate: 0.3, promoted_amount: 2.94}`.

---

## FASE 0 — Conferência automática contra o Mercado Livre (antes de corrigir)

Essa ferramenta vira a prova de que cada correção funciona e fica no produto para o Lucas usar sempre.

1. Serviço `relatorios/conferencia.ts` e rota `GET /api/financeiro/conferencia?mes=AAAA-MM` (ADMIN). Para o mês (fuso de SP), busca **direto no ML** todos os pedidos por `order.date_created` (fatiando por dia para não passar do limite de offset), e para cada pedido compara com o `VendaCanal` gravado: existe? status? faturamento? unidades? tarifa? frete? líquido? Devolve totais ML × app, a lista de pedidos faltando e a lista de divergências por campo.
2. Tela **Financeiro → Conferência** com o resultado, os botões "Importar faltantes" e "Reprocessar divergentes" e o percentual de cobertura.
3. Teste com fixtures: um mês sintético em que faltam 2 pedidos e 1 diverge.
4. Registrar na auditoria os números de outubro e setembro medidos acima como **alvo de aceite**.

## FASE 1 — Sincronização correta e completa

1. **Fila de tarefas persistida** `TarefaSincronizacaoFinanceira { id, userId, canal, contaCanalId, tipo (PEDIDOS_PERIODO, PEDIDOS_INCREMENTAL, ADS, COBRANCAS, PAGAMENTOS, PRODUTOS_ML, BLING_PRODUTOS, BLING_ESTOQUE, BLING_CONTAS), desde, ate, cursor Json, status, prioridade, tentativas, processados, total, erro, criadaEm, atualizadaEm, concluidaEm }`. Um executor `executarFila(contaId, orcamentoMs)` processa a tarefa de maior prioridade até ~40 s e **salva o cursor a cada pedido**. Quem dispara: botões das telas (com polling enquanto a tela está aberta), `after()` encadeando o próximo lote ao fim de cada lote, webhooks e cron. Trava por conta com expiração curta (2 min, renovada a cada lote), nunca 10 min de bloqueio.
2. **Busca por data de criação para período e histórico**: `listarPedidosPorPeriodo(conta, desde, ate, cursor)` com `order.date_created.from/to`, **fatiada por dia** (cursor = `{ dia, offset }`). O incremental usa `order.date_last_updated` desde a última sync menos 2 h. `PERIODO` passa a respeitar o período pedido (corrige S1).
3. **Menos chamadas por pedido**: usar o pedido que já vem em `/orders/search` (sem `GET /orders/{id}`). Por pedido, só o pagamento no MP (tarifa, frete, líquido e liberação, Fase 2) e, quando faltar, `/shipments/{id}` para a logística. Descontos (`/orders/{id}/discounts`) apenas para o pedido com tag `order_has_discount`. Concorrência de 4 pedidos por vez com o `fetchMlWithBackoff` que já existe.
4. **Pular o que não mudou**: se `last_updated` do ML for igual a `atualizadoNoCanalEm` gravado e a venda estiver completa, não reprocessar, a não ser com `forcar: true`.
5. **Início automático real**: ao abrir qualquer tela do Financeiro, ou ao conectar ou reconectar o ML, se não houver histórico concluído, enfileirar `PEDIDOS_PERIODO` dos últimos 12 meses (configurável) com prioridade alta, e mostrar a faixa "Importando suas vendas: X de Y pedidos". Y vem do `paging.total` de cada dia.
6. **Botão "Atualizar dados"**: enfileira `PEDIDOS_PERIODO` do período exibido + `PAGAMENTOS` + `ADS` dos dias do período + `COBRANCAS` dos meses do período, e mostra o progresso por etapa. Na DRE, cobre todos os meses exibidos.
7. **Webhooks**: registrar cada notificação recebida (o modelo já existe) e mostrar "último webhook recebido" por tópico na Saúde dos dados. Se nenhum `orders_v2` chegou em 24 h e houve venda, mostrar o alerta "Notificações do ML não estão chegando — confira a URL e os tópicos no app do ML".
8. **Cron diário**: processa a fila, roda o incremental das últimas 48 h, a conferência do mês corrente e do mês anterior (Fase 0) e importa sozinho os faltantes.
9. Testes: período de 3 dias com 120 pedidos e "timeout" no meio retoma do pedido certo; `PERIODO` com `ultimaSincronizacao` recente ainda busca o período inteiro; pedido sem mudança não é reprocessado.

## FASE 2 — Uma fórmula, um lugar (corrige faturamento, margem e lucro)

1. **Fonte por pedido: o pagamento do Mercado Pago.** Para cada pagamento aprovado, gravar uma tabela `CobrancaPagamento { vendaId, pagamentoExternoId, nome, tipo, valor, estornado, destino, metadata }` a partir de `charges_details`, e na venda: `tarifaVenda` = soma de `ml_sale_fee` + `mp_processing_fee` + `mp_financing_*` (detalhado por componente); `freteVendedor` = soma das cobranças `type: shipping` (`shp_*`); `retencaoDividas` = `fee_spl` e demais `direct-charges` (**fora da margem da venda**, entra no fluxo de caixa e na conciliação); `valorLiquidoReceber` = `net_received_amount`; `dataLiberacao` = `money_release_date`; `statusLiberacao` = `money_release_status`. Considerar `amounts.refunded` em estornos. Sem pagamento disponível, usar `sale_fee` e `/shipments/{id}/costs` como hoje, marcando `confianca: ESTIMADO`. Se `charges_details` vier com nomes desconhecidos, guardar o nome e mostrar na conferência; nada é descartado.
2. **Serviço único** `relatorios/consolidado.ts` → `calcularResultadoDoPeriodo(contaId, desde, ate, filtros)`. Ele devolve **todas** as linhas da DRE e os indicadores (faturamento bruto, cancelamentos, receita, impostos, tarifas, frete, ads, armazenagem, outras cobranças, CMV, MC, despesas operacionais, resultado financeiro, lucro líquido, unidades, pedidos, ticket médio, ponto de equilíbrio). DRE, resumo do dia, resumo do período, série diária, lucro por produto, dashboard principal e ficha do produto passam a chamar **só** este serviço (ou ler o snapshot que ele mantém). Remover as fórmulas duplicadas.
3. **Definições fixas** (documentar em `docs/financeiro/definicoes.md` e mostrar no tooltip de cada número):
   - **Faturamento bruto** = Σ `unit_price × quantidade` dos pedidos com pagamento aprovado, pela **data de aprovação do pagamento** em SP (configurável para data do pedido). Inclui os pedidos depois cancelados, que aparecem na linha seguinte.
   - **Cancelamentos e devoluções** = valor dos pedidos cancelados ou estornados (total ou parcial, por `transaction_amount_refunded`).
   - **Receita** = bruto − cancelamentos. **O desconto de campanha é informativo** (o preço já vem com desconto) e não entra em nenhuma subtração.
   - **Lucro líquido** = MC − despesas operacionais (todas, não só as fixas rateadas) ± resultado financeiro − IR/CSLL, **igual em todas as telas**.
   - Os períodos sempre são `[início do dia em SP, fim do dia em SP]` e incluem o dia de hoje.
4. **Cobranças do ML corrigidas** (C5): ampliar `?tipo=cobrancas` do diagnóstico para devolver o **JSON bruto** de uma página. Reescrever `mapeadorCobrancas.ts` contra esse payload real (na documentação de billing os campos ficam em blocos como `charge_info` com `detail_id`, `detail_amount`, `detail_type`, `detail_sub_type` e `creation_date_time`, `sales_info[].order_id`, `items_info[].item_id`, mas confirme no payload). O id único deve ser o `detail_id` real; se faltar, recusar a linha e registrar erro, nunca gravar com id vazio. Mapear os códigos reais (`CV` tarifa, `CXD` frete, `PADS` ads, armazenagem e serviços do Full e os demais que vierem). Os cobertos pelo pedido servem só para conciliação; os demais entram na DRE.
5. **Ads** (C6): ampliar `?tipo=ads` com o bruto das chamadas do anunciante e das métricas, e implementar conforme o retorno real. Se não houver acesso, mostrar "Ads indisponível: <motivo>" e usar `PADS` da fatura como custo mensal, sem contar duas vezes.
6. **CMV**: congelado na venda como hoje. A DRE mostra "CMV incompleto: N vendas sem custo (R$ X de faturamento)". Ao preencher o custo de um produto, oferecer "Aplicar este custo às vendas sem custo desde DD/MM".
7. **Recalcular tudo**: depois desta fase, enfileirar o reprocessamento dos últimos 12 meses com `forcar: true` e regenerar `ResumoFinanceiroDiario`.
8. Testes: a mesma venda produz o mesmo número no resumo, na DRE, no dashboard e no lucro por produto; DRE de um mês sintético conferida linha a linha; o pedido real acima resulta em tarifa 2,99 (2,24 + 0,71 + 0,04), frete 6,85, retenção 12,14 fora da margem e líquido 12,72.

## FASE 3 — Frete configurável (como o Mercado Turbo)

1. **Detalhe do frete em cada venda**: custo total do envio (`base_cost`/`gross_amount`), quanto o comprador pagou, quanto o ML subsidiou (`discounts[].promoted_amount`, por tipo) e quanto o vendedor pagou, com a origem (pagamento MP, custo do envio, configurado ou manual).
2. **Regras de frete por prioridade**, em Configurações → Frete:
   1. **ajuste manual na venda** (editar o frete de uma venda específica, com motivo e usuário);
   2. **valor real do ML** (cobrança `shp_*` do pagamento; na falta, `/shipments/{id}/costs`);
   3. **custo de frete por produto/anúncio** (para envios que o ML não cobra, como Flex, ME1 ou entrega própria);
   4. **custo padrão por logística**: Flex (valor fixo ou tabela por faixa de CEP ou distância), ME1/Correios (valor ou % do pedido), retirada, entrega própria.
   O cálculo usa a primeira regra que existir e grava qual foi usada.
3. **Frete recebido do comprador como receita**: opção para logísticas em que o vendedor cobra o frete (ME1, personalizado). Entra como "Receita de frete" na DRE.
4. **Frete de envio ao Full (inbound)**: cadastro de cada remessa ao Full (data, custo do frete/coleta, produtos e quantidades). O custo é rateado por unidade enviada e somado ao custo de cada unidade (configurável: no CMV ou como custo variável "Logística Full"), aplicado às vendas Full desses produtos.
5. **Embalagem e insumos por produto** (opcional por produto): custo unitário de embalagem somado ao CMV.
6. Recalcular as vendas afetadas quando uma regra de frete muda (com confirmação e período).

## FASE 4 — Saldo em conta real

1. Diagnóstico `?tipo=saldo`: testar `GET https://api.mercadopago.com/users/{mlUserId}/mercadopago_account/balance` com o token da conta ML (campos esperados: `available_balance`, `unavailable_balance`, `total_amount`). Se não responder, testar as alternativas documentadas do Mercado Pago (relatório de dinheiro em conta / liberações) e registrar o que funcionou.
2. Criar automaticamente a conta financeira **"Mercado Pago — <apelido>"** (`CARTEIRA_MARKETPLACE`) para cada conta ML. O **saldo disponível** e o **a liberar** vêm da API a cada sincronização e ficam gravados com data e hora.
3. Movimentos realizados da carteira: liberações de vendas (`money_release_date` passado e `money_release_status: released`), retenções (`fee_spl`/dívidas), estornos e saques e transferências (pelo relatório de liberações do MP, já preparado no Ciclo 7, agora ligado). O saldo calculado pelos movimentos é comparado com o saldo da API e a diferença aparece como "a conciliar".
4. Contas bancárias e cartões: saldo inicial + lançamentos pagos. Mostrar o saldo de cada conta e o total na Visão geral e no Fluxo de caixa.
5. Fluxo de caixa: saldo atual (API do MP + contas) + liberações futuras + recebimentos e pagamentos previstos = saldo projetado. Os dois lados ficam com origem visível.

## FASE 5 — Produtos e anúncios corretos

1. **P1**: migração que marca como `FULL_ML` todo armazém usado pela sincronização do Full (pelo nome e pela origem das movimentações `SINCRONIZACAO_FULL_ML`), e `vendas-ml/route.ts` passa a criar o armazém com `tipo: FULL_ML`. Conferir reposição, valor do estoque, auto-stock e dashboard: Full nunca soma no local.
2. **P2**: unificar as três sincronizações de anúncio num único `sincronizarAnuncio(conta, itemId)` usado por todas as rotas, pelo webhook `items` e pela fila (`PRODUTOS_ML`). Preço atual = `GET /items/{id}/sale_price?context=channel_marketplace` (`amount`; `regular_amount` = preço "de"); promoção ativa pelo próprio retorno. Tarifa estimada (`listing_prices`) e frete estimado (`shipping_options/free`) recalculados com esse preço.
3. **P3**: vínculos anúncio ↔ produto passam a ter `origem` (`SKU_EXATO`, `EAN`, `SIMILARIDADE`, `MANUAL`) e `confirmado`. Vínculo por similaridade nasce **não confirmado**: aparece numa fila "Confirme estes vínculos" e a venda entra com pendência `VINCULO_NAO_CONFIRMADO` (o CMV aparece, mas sinalizado). Revisar o caso MLB4019629019 ↔ KITADAPUSB e listar todos os vínculos em que o SKU do anúncio difere do SKU do produto.
4. **P4**: diagnosticar e corrigir por que a importação de produtos e de estoque do Bling não concluiu (`ultimaSincronizacao*` nulos): rodar pela fila, com cursor, registro de erro e status na tela Integrações. Imagens do Bling com URL assinada: baixar e subir para o Vercel Blob na importação (a regra já existia no Ciclo 6 e não está sendo aplicada), e regravar as que já estão salvas.
5. **Estoque Full por anúncio**: confirmar que `mlFullDisponivel` vem de `/inventories/{inventory_id}/stock/fulfillment` em todo anúncio Full, e mostrar "em trânsito" e "indisponível" separados.
6. Testes: Full não entra no estoque local em nenhuma soma; preço do anúncio = `sale_price.amount`; vínculo por similaridade nasce não confirmado.

## FASE 6 — Gestão completa da loja na Visão geral

Com os números confiáveis, completar o painel do Financeiro (tudo do serviço único):
- **Hoje**: vendas, unidades, faturamento, tarifas, frete, ads, MC, lucro estimado, ticket médio, comparação com ontem e com o mesmo dia da semana passada.
- **Mês**: faturamento × meta (campo de meta mensal em Configurações), projeção de fechamento pelo ritmo atual, MC %, lucro líquido, ponto de equilíbrio e quanto falta.
- **Caixa**: saldo MP disponível, a liberar (por data), contas bancárias, contas a pagar dos próximos 7 dias, saldo projetado.
- **Por logística**: Full × Flex × coleta (pedidos, faturamento, frete médio por envio, MC).
- **Produtos**: top por lucro, piores margens, produtos com venda e sem custo, curva ABC.
- **Qualidade dos dados**: cobertura da conferência do mês, vendas incompletas, vínculos não confirmados, cobranças não mapeadas, webhooks.

## FASE 7 — Verificação

1. `npx tsc --noEmit`, `npx next lint`, `npm test`, `npm run build` limpos.
2. Atualizar `docs/financeiro/fontes-mercado-livre.md` com tudo o que foi confirmado em produção (este documento) e `docs/financeiro/definicoes.md`.
3. `docs/AUDITORIA-CICLO-9.md` com a lista de aceite que o Lucas confere depois do deploy:
   - Conferência de outubro e de setembro com **100% de cobertura** e totais iguais aos do ML (152 pagos e R$ 5.440,72 até 18/10; 103 e R$ 3.366,11 em setembro), sem divergências abertas;
   - mesma venda com os mesmos valores em Vendas, DRE, Visão geral, dashboard e ficha do produto;
   - pedido 2000019043297364: tarifa 2,99, frete 6,85, retenção 12,14 fora da margem, líquido 12,72, liberação 16/11;
   - saldo disponível do MP no app igual ao do app do Mercado Pago;
   - armazém Full marcado como `FULL_ML`; preço de MLB4019629019 igual ao do anúncio no ML;
   - cobranças de setembro com tipos reais e total igual à fatura do ML.
4. Commit final e `git push origin master`.

---

## Passos manuais do Lucas
1. App do Mercado Livre → Notificações: URL `https://estoque-api-4iqj.vercel.app/api/mercadolivre/webhook` com `orders_v2`, `shipments`, `payments`, `claims` e `items`.
2. Depois do deploy: abrir Financeiro → Conferência, escolher outubro e setembro e deixar importar e reprocessar até 100%.
3. Em Configurações → Frete: informar o custo do Flex ou de entrega própria (se usar) e cadastrar as remessas ao Full com o custo do frete de envio.
4. Confirmar a fila "Confirme estes vínculos" em Produtos.
