# Leap Stock — Ciclo 8: Fazer o Financeiro buscar dados reais, sozinho e com botão "Atualizar"

Documento autocontido de execução para o Claude Code. O Ciclo 7 construiu a estrutura do módulo financeiro (`src/modules/financeiro`), mas **em produção ele não tem nenhuma venda**. Este ciclo corrige a ingestão, torna a sincronização automática e confiável, liga as fontes do sistema e do ERP e coloca o botão "Atualizar" na DRE e nas demais telas.

Execute as fases **na ordem**. Ao final de cada fase: `npx tsc --noEmit`, `npx next lint`, `npm test`, commit descritivo em português e registro em `docs/AUDITORIA-CICLO-8.md`. Ao final do ciclo, `git push`.

**Regras inegociáveis (iguais ao Ciclo 7):** dinheiro em centavos (`Int`); fuso `America/Sao_Paulo`; idempotência por chave externa; escopo por `contaId`; nenhum número inventado (dado que falta aparece como "—" com motivo); migrações aditivas com `IF NOT EXISTS`; sem comentários no código; TypeScript estrito; componentes de UI existentes; responsivo e nos dois temas.

---

## Diagnóstico verificado em produção (17/10/2026, conta LEAPSTORE)

Testado em `estoque-api-4iqj.vercel.app` com a sessão real:

| Verificação | Resultado |
|---|---|
| Conta ML | ativa, token válido, 2.751 vendas concluídas no histórico |
| `/api/mercadolivre/orders` | devolve os pedidos de hoje normalmente |
| `/api/financeiro/diagnostico/mercado-livre` | funciona: pedido, descontos, custo do envio e pagamentos chegam da API |
| `/api/financeiro/vendas` | **0 vendas** |
| `/api/financeiro/dre` (set e out) | **tudo zero** |
| `/api/financeiro/resumo-periodo` (01/09 a 17/10) | **0 pedidos** |

Ou seja: a API do ML responde, mas **nenhuma venda chega a ser gravada**. As causas abaixo foram confirmadas no código e em três pedidos reais (um comum, um com 2 unidades e um cancelado após o pagamento).

### Causas que impedem os dados de entrar
| # | Problema | Onde | Evidência |
|---|---|---|---|
| F1 | **O ID do pedido chega como número e é gravado num campo `String`.** A API devolve `"id": 2000019031090968` (número). `mapearPedido` faz `pedidoExternoId: pedido.id` e `listarPedidosAlterados` faz `pedidoExternoId: r.id`, sem `String()`. O Prisma recusa `Int` em campo `String`, **toda ingestão falha** (webhook, cron e importação). Os testes passam porque as fixtures usam string, e o tipo `MLOrder.id` está declarado como `string`. | `canais/mercadoLivre/mapeador.ts`, `canais/mercadoLivre/cliente.ts`, `src/types/mercadolivre.ts` | payload real abaixo |
| F2 | No webhook, o financeiro só roda **depois** de `processOrderWebhook` (estoque). Se aquele lançar erro, o financeiro nunca roda. | `MercadoLivreService.processWebhookEvent` | código |
| F3 | **Nada começa sozinho.** A importação do histórico existe só como botão escondido em Financeiro → Configurações. O cron roda 1×/dia (09:00 UTC) e só olha 3 dias. Visão geral e DRE **não têm botão de atualizar** nem mostram quando foi a última sincronização. | telas e cron | código |
| F4 | O backfill **só salva o cursor no fim do lote** (página de 50 pedidos × 3–5 chamadas ao ML cada), e nenhuma rota declara `maxDuration`. Se a função estoura o tempo, a mesma página é repetida para sempre. Um erro em **um** pedido marca a sincronização como `ERRO`, e a próxima chamada **recomeça do zero**. | `ingestao/sincronizador.ts` (`continuarBackfill`) | código |

### Causas que deixariam os números errados mesmo depois de entrarem
| # | Problema | Evidência real |
|---|---|---|
| F5 | **Desconto lido no formato errado e subtraído em dobro.** O formato real de `/orders/{id}/discounts` é `{"details":[{"type":"discount","items":[{"id","variation_id","quantity","amounts":{"total":35.3,"seller":34.3}}],"supplier":{"funding_mode":"sale_fee","offer_id":"…"}}]}`. O código procura `seller` no topo e devolve sempre 0. Mais importante: `unit_price` **já vem líquido do desconto** (`gross_price` 70,00 → `unit_price` 34,70). Portanto o desconto **não pode ser subtraído da receita de novo**. Ele é informativo (preço cheio × preço vendido, e quanto o ML bancou: `total − seller`). | pedido 2000019031090968 |
| F6 | **Cancelamento depois do pagamento é descartado.** Depois do estorno, `paid_amount` vira **0** e o pagamento fica `status: "refunded"`. `mapearStatus` exige `paid_amount > 0`, então devolve `null` e o cancelamento nunca entra. Data real: `cancel_detail.date`. Também não são tratados `partially_refunded` e as mediações/devoluções. | pedido 2000018923595910 |
| F7 | **A DRE subtrai cancelamentos duas vezes.** `atualizarResumoDoDia` já **exclui** a venda cancelada de `faturamentoBruto` e soma o valor em `cancelamentos`. Depois `gerarDreDeUmMes` faz `faturamentoBruto − cancelamentos`. O mesmo acontece em `somarVendaCanalDoMes`. | `relatorios/dre.ts`, `ingestao/sincronizador.ts` |
| F8 | **A logística nunca é identificada.** No pedido real, `shipping` traz **só `{ "id": … }`**: não há `logistic_type`. Então `logistica` fica sempre `null`, não há separação entre Full, Flex e coleta, e o custo do Flex configurado nunca é aplicado. É preciso `GET /shipments/{id}` (`logistic_type`, `mode`, status). O caso "Full = frete 0" também está errado: o Full paga frete, e o valor vem de `/shipments/{id}/costs` como nos demais. | pedido real |
| F9 | **Não há data de liberação do dinheiro.** Os pagamentos do pedido **não trazem `money_release_date`**, então `dataLiberacao` fica nula e o fluxo de caixa não tem recebíveis. | pedidos reais |
| F10 | Cobranças (billing): a paginação usa `paging.next_from_id`, mas a documentação manda usar `last_id` com `sort_by=ID&order_by=ASC&from_id=0`. Só a primeira página é lida. Notas de crédito (`CREDIT_NOTE`) não são lidas. | `cliente.ts` |
| F11 | Ads: os endpoints não foram confirmados e qualquer falha devolve lista vazia **em silêncio**, então publicidade aparece sempre como 0 sem aviso. | `cliente.ts`, `fontes-mercado-livre.md` |
| F12 | As configurações `cancelamentoNaCompetencia` e `usarImpostoEstimado` são salvas mas **nenhum cálculo as lê**. | grep |

### Confirmado (manter)
- `sale_fee` é **por unidade**: 2,99 no pedido de 1 unidade e 2,99 no de 2 unidades, mesmo anúncio e preço. O código atual (`sale_fee × quantity`) está certo; documente isso em `fontes-mercado-livre.md`.
- `gross_price` e os `amounts` de desconto são **por linha** (70 com 1 unidade, 140 com 2).
- `/shipments/{id}/costs`: `senders[0].cost` é o que o vendedor paga (6,85 e 13,71 nos pedidos reais) e `senders[0].compensation` é um número. O mapeador de frete atual está certo.
- Pedido de carrinho tem `pack_id` e um único envio para o pacote; o rateio por pacote que já existe faz sentido.

### Fixtures reais (dados do comprador já ausentes no diagnóstico) — usar nos testes
```json
{"pedido":{"id":2000019031090968,"date_created":"2026-10-17T13:31:16.000-04:00","date_closed":"2026-10-17T13:31:19.000-04:00","last_updated":"2026-10-17T13:32:56.000-04:00","pack_id":2000015573123037,"status":"paid","total_amount":34.7,"paid_amount":34.7,
 "order_items":[{"item":{"id":"MLB4019629019","title":"Kit 2 Adaptador T Dobrável Benjamim Usb C Tomada 10a","variation_id":183260262350,"seller_sku":"KITADAPPRE","seller_custom_field":"","user_product_id":"MLBU3102905144"},"quantity":1,"unit_price":34.7,"gross_price":70,"sale_fee":2.99,"listing_type_id":"gold_special","stock":{"node_id":"BRSP25"}}],
 "payments":[{"id":184707791700,"status":"approved","status_detail":"accredited","transaction_amount":34.7,"transaction_amount_refunded":0,"shipping_cost":0,"coupon_amount":0,"marketplace_fee":0,"date_approved":"2026-10-17T13:31:18.000-04:00"}],
 "shipping":{"id":48282316083},"tags":["order_has_discount","paid","not_delivered","pack_order"],"order_request":{"change":null,"return":null},"cancel_detail":null},
 "descontos":{"details":[{"type":"discount","items":[{"element_id":1,"quantity":1,"id":"MLB4019629019","amounts":{"total":35.3,"seller":34.3},"variation_id":183260262350}],"supplier":{"offer_id":"OFFER-MLB4019629019-14026280114","funding_mode":"sale_fee"}}]},
 "custosEnvio":{"gross_amount":26.59,"receiver":{"cost":0},"senders":[{"user_id":2018372828,"cost":6.85,"compensation":0,"compensations":[],"discounts":[{"rate":0.3,"type":"mandatory","promoted_amount":2.94}]}]}}
```
Pedido com 2 unidades (2000019029504030): `quantity: 2, unit_price: 34.7, gross_price: 140, sale_fee: 2.99`; desconto `amounts {total: 70.6, seller: 68.6}`; pagamento `transaction_amount 69.4`; frete do vendedor `cost 13.71`.
Pedido cancelado após pagamento (2000018923595910): `status: "cancelled"`, `paid_amount: 0`, `total_amount: 26.7`, `tags: [..., "not_paid", "pack_order"]`, `cancel_detail: {"code":"buyer_cancel_express","group":"buyer","date":"2026-10-12T10:39:15.000-04:00"}`, `mediations: [{"id":5592610296}]`, pagamento `{"status":"refunded","status_detail":"bpp_refunded","transaction_amount":26.7,"transaction_amount_refunded":26.7}`.

---

## FASE 0 — Testes que reproduzem o problema real (antes de corrigir)

1. Salvar os três payloads acima em `src/modules/financeiro/canais/mercadoLivre/__tests__/fixtures/` (ids **numéricos**, como vêm da API).
2. Teste de ponta a ponta da ingestão (`sincronizador.test.ts`) que use essas fixtures e **valide os tipos gravados** (o mock do Prisma deve rejeitar número em campo de texto, imitando o Prisma real). O teste tem de falhar hoje por F1.
3. Testes que falham hoje para F5 (desconto lido como 0 e/ou subtraído em dobro), F6 (cancelado pós-pagamento ignorado) e F7 (DRE de um mês com 1 venda paga de R$ 100 e 1 cancelada de R$ 50 deve mostrar faturamento 150, cancelamentos 50, receita 100).
4. Substituir a confiança no tipo escrito à mão: criar `canais/mercadoLivre/esquemas.ts` com **Zod** para pedido, descontos, custo de envio, envio e pagamento, convertendo **todo id para string** (`z.union([z.string(), z.number()]).transform(String)`). Os mapeadores recebem o resultado validado, nunca `MLOrder` cru. Corrigir `MLOrder.id` em `src/types/mercadolivre.ts` para `string | number`, e conferir os outros usos no app que comparam ids de pedido.

## FASE 1 — Corrigir a ingestão e as fórmulas

1. **F1**: ids sempre string em `mapearPedido` e `listarPedidosAlterados` (via esquemas da Fase 0).
2. **F5**: novo `mapearDescontos(details)` que devolve, por item: `precoCheio` (de `gross_price` ÷ quantidade, ou `amounts.total + valor pago`), `descontoTotal = amounts.total`, `descontoVendedor = amounts.seller` e `descontoCusteadoPeloMl = total − seller`, além de `funding_mode` e `offer_id`. **A receita da venda continua sendo `unit_price × quantity`** e não se subtrai desconto dela. Ajustar `calcularResultadoVenda` (e `formulas.test.ts`) para que `descontoVendedor` seja **informativo**: não reduz receita nem a base do imposto. Na DRE, a linha "Descontos" passa a ser informativa ("Descontos concedidos em campanhas — já deduzidos do preço"), fora da soma, e mostra à parte quanto o ML bancou. Coluna nova em `VendaCanalItem`: `descontoCusteadoMl Int @default(0)`.
3. **F6**: `mapearStatus` passa a considerar o histórico de pagamento. Houve pagamento se algum `payments[].status ∈ {approved, refunded, partially_refunded, charged_back, in_mediation}` com `transaction_amount > 0`. `cancelled` com pagamento vira `CANCELADA`, ou `DEVOLVIDA` se houver devolução (`order_request.return`, ou claim de devolução — ver item 6). `partially_refunded` vira `DEVOLVIDA_PARCIAL`, com o valor estornado (`transaction_amount_refunded`) abatido. `dataCancelamento = cancel_detail.date ?? last_updated`. Faturamento original = soma dos itens × quantidade (não `paid_amount`).
4. **F7**: definir uma única convenção e aplicá-la em `atualizarResumoDoDia`, `somarVendaCanalDoMes`, `gerarResumoPeriodo`, `resumoDia`, `lucroPorProduto` e na DRE: `ResumoFinanceiroDiario.faturamentoBruto` **inclui** as vendas depois canceladas, e `cancelamentos` é o valor delas. A DRE faz `bruto − cancelamentos`. Tarifa, frete e CMV de venda cancelada: tarifa estornada (0), CMV 0 se não houve envio, frete do vendedor só se o envio chegou a sair (status do envio, item 5). Teste da Fase 0 passa.
5. **F8 — logística e frete**: novo `obterEnvio(conta, envioId)` no adaptador (`GET /shipments/{id}`, com o header de formato novo se a documentação exigir) devolvendo `logistic_type`, `mode` e status. Gravar `VendaCanal.logistica` com o valor real (`fulfillment`, `self_service`, `cross_docking`, `xd_drop_off`, `drop_off`…). **Remover a regra "Full = 0"**: todo envio do Mercado Envios usa `/shipments/{id}/costs`. Flex (`self_service`) usa `custoEnvioFlex` configurado, e sem configuração vira pendência `SEM_FRETE`.
6. **Devoluções**: para pedidos com `mediations` ou tag de devolução, consultar o claim (`/post-purchase/v1/claims/search?resource=order&resource_id={id}` e, se houver devolução, o custo do frete de retorno cobrado do vendedor). Gravar em `VendaCanal.outrosCustos` (frete de devolução), que alimenta a linha "Frete de devolução e outros". Se o endpoint não responder, registrar no diagnóstico e seguir sem bloquear.
7. **F9 — liberação do dinheiro**: para cada pagamento aprovado, buscar `GET https://api.mercadopago.com/v1/payments/{id}` com o token da conta ML e gravar `money_release_date`, `net_received_amount` e `fee_details` (que confirmam tarifa e frete descontados pelo MP). Se o endpoint recusar o token, usar estimativa por regra configurável (`diasLiberacaoPadrao`, `confianca: ESTIMADO`) e mostrar isso no fluxo de caixa. `valorLiquidoReceber` passa a preferir `net_received_amount` quando existir.
8. **F12**: aplicar `cancelamentoNaCompetencia` (VENDA × CANCELAMENTO: em qual dia o cancelamento entra no resumo) e `usarImpostoEstimado` (quando falso, `impostosSobreVendas` da DRE vem dos lançamentos da categoria "Impostos sobre vendas", e a estimativa por alíquota fica só como referência).
9. **F2**: em `processWebhookEvent`, executar `processOrderWebhook` e `processOrderWebhookFinanceiro` em `try` independentes. Assinar e tratar também os tópicos `shipments` (o custo do frete chega depois), `payments` e `claims`: cada um localiza o pedido e chama `ingerirPedidoMercadoLivre`.

## FASE 2 — Sincronização automática, retomável e visível

1. **Orquestrador único** `ingestao/orquestrador.ts`: `sincronizarFinanceiro(contaId, { modo: "INCREMENTAL" | "PERIODO" | "BACKFILL", desde?, ate? })`, que por conta de canal executa em sequência: pedidos alterados → envios e frete → pagamentos e liberação → ads dos dias afetados → cobranças dos meses afetados → recálculo de `ResumoFinanceiroDiario` dos dias tocados → invalidação de cache. Os demais pontos (cron, botões, webhook em lote) chamam só isto.
2. **Orçamento de tempo, não de quantidade**: cada chamada processa pedidos até ~40 s (`TEMPO_MAXIMO_LOTE_MS`, configurável por env) e **salva o cursor depois de cada pedido**. Declarar `export const maxDuration = 60` em todas as rotas de sincronização e no cron (ajustável se o plano da Vercel for Pro).
3. **Erro por pedido não para o lote**: nova tabela `SincronizacaoFinanceiraErro { id, userId, canal, pedidoExternoId, etapa, mensagem, tentativas, ultimoErroEm, resolvidoEm }`. O pedido com erro é registrado e o lote continua. A próxima sincronização tenta de novo até 5 vezes. Um backfill com erro **retoma do cursor**, nunca recomeça do zero.
4. **Incremental de verdade**: `ultimaSincronizacaoIncrementalEm` por conta de canal. O incremental busca `order.date_last_updated` de (última sync − 2 h) até agora, para não perder nada entre execuções.
5. **Início automático**:
   - Ao abrir qualquer página do Financeiro, se não houver backfill concluído, iniciar a importação dos últimos 90 dias sozinho, com uma **faixa de progresso no topo** ("Importando suas vendas do Mercado Livre: 340 de 2.104 pedidos"). A página continua chamando a rota enquanto estiver aberta, e o cron continua de onde parou se a página for fechada.
   - Ao conectar ou reconectar a conta do ML, enfileirar o mesmo backfill.
   - O cron diário roda `INCREMENTAL` + continuação de backfill pendente + reprocessamento de erros. No Hobby da Vercel continua 1×/dia; documentar que no plano Pro o horário pode ser de hora em hora.
6. **Botão "Atualizar dados"** no cabeçalho de **todas** as páginas do Financeiro (Visão geral, DRE, Vendas, Produtos, Fluxo de caixa):
   - Visão geral, Vendas, Produtos e Fluxo: roda `INCREMENTAL` (e ads e liberações do período exibido) e recarrega a tela ao terminar.
   - **DRE**: roda `PERIODO` para os meses exibidos. Reprocessa os pedidos desses meses em lotes com progresso, busca as cobranças e notas de crédito dos meses, os ads dos dias, os lançamentos e as recorrências, e recalcula. Mostra "Atualizando março a outubro… 61%".
   - Rota `POST /api/financeiro/sincronizacao` (`{ modo, desde, ate }`) devolvendo `{ status, processados, total, erros, proximoPasso }`, e `GET /api/financeiro/sincronizacao/status` para a faixa de progresso. Apenas `FINANCEIRO_EDITAR` dispara; `FINANCEIRO_VER` só lê o status.
   - Trava por conta (advisory lock ou registro `EM_ANDAMENTO` com expiração) para dois cliques ou duas abas não rodarem juntos.
   - "Atualizado em" mostra a **última sincronização concluída** (persistida), não a hora em que a página abriu.
7. **Painel "Saúde dos dados"** (Financeiro → Configurações, e um resumo em selo na Visão geral):
   - **cobertura**: pedidos pagos do mês no ML (`/orders/search` → `paging.total`) × vendas gravadas no mês ("512 de 530 pedidos importados"), com botão para completar;
   - última sincronização de cada etapa, erros pendentes com o motivo e o botão "tentar de novo";
   - webhooks recebidos nas últimas 24 h (tabela `MercadoLivreWebhook`, não o monitor em memória) por tópico;
   - status de ads, cobranças e liberações: **conectado**, **sem permissão** ou **endpoint não respondeu**, nunca zero silencioso;
   - vendas incompletas por motivo (sem custo, sem vínculo, sem frete).

## FASE 3 — Ads, cobranças e diagnóstico ampliado

1. Ampliar `GET /api/financeiro/diagnostico/mercado-livre` (ADMIN, sem dados pessoais) com `?tipo=envio&id=`, `?tipo=pagamento&id=`, `?tipo=claims&pedido=`, `?tipo=ads&dia=AAAA-MM-DD`, `?tipo=cobrancas&mes=AAAA-MM`. Cada tipo devolve o JSON bruto e o resultado do mapeador lado a lado, para conferir em produção.
2. **Ads**: implementar conforme a documentação "Product Ads – leitura" do ML (anunciante → métricas por anúncio e por dia: custo, cliques, impressões, vendas atribuídas). Se a conta não tiver Product Ads ou o endpoint recusar, gravar o status (`ADS_INDISPONIVEL` e motivo) e mostrar na tela. Como alternativa confiável, o custo mensal de Product Ads vem das cobranças (tipo `PADS`) e entra na DRE quando não houver dado diário. Não pode ser contado duas vezes: se houver dado diário do mês, a cobrança `PADS` fica só para conciliação.
3. **Cobranças**: corrigir a paginação (`sort_by=ID&order_by=ASC&from_id=0`, depois `from_id = last_id`, limite 1000), ler também `CREDIT_NOTE` (estornos de tarifa), mapear os tipos reais encontrados (`CV`, `CXD`, `PADS` e os demais que aparecerem) e manter os desconhecidos em "não mapeados" com valor.
4. Conciliação mensal (pedidos × fatura) passa a ser recalculada pelo botão "Atualizar" da DRE.

## FASE 4 — Fontes do sistema e do ERP

1. **Compras confirmadas viram conta a pagar sozinhas**: ao confirmar um `PedidoCompra`, criar automaticamente a conta a pagar `PREVISTO` (a configuração `gerarContaAPagarAoConfirmarCompra` vem ligada por padrão). Vencimento = data informada ou a data do pedido + `prazoPagamentoPadraoDias`. A tela de confirmação já pergunta parcelas e vencimento. Rodar uma vez para os pedidos confirmados nos últimos 90 dias que ainda não têm conta a pagar (idempotente por `chaveExterna`).
2. **Bling — contas a pagar e a receber**: adaptador `canais/erp/bling/` implementando a leitura de `GET /contas/pagar` e `GET /contas/receber` (paginado, `api.bling.com.br`, header `enable-jwt`, limitador de 3 req/s que já existe). Grava como `LancamentoFinanceiro` com `origem: ERP` e `chaveExterna = bling:pagar:<id>`, vencimento, pagamento, valor, situação e fornecedor (`contato.id` → `Fornecedor.blingContatoId`). Tela de **mapeamento de categorias do Bling** (`GET /categorias/receitas-despesas`) para o plano de contas, com as não mapeadas indo para "Outras". Liga e desliga em Configurações do Financeiro. Sincroniza no "Atualizar" e no cron. **Somente leitura**: o Leap Stock não escreve no Bling neste ciclo. Se o app do Bling não tiver o escopo de contas, mostrar "conecte novamente o Bling com o escopo Contas a pagar/receber".
3. **Bling — pedidos de venda de outros canais**: `GET /pedidos/vendas` (por data), entrando como `CanalVenda.ERP` com a loja de origem. **Ignorar os pedidos cuja loja é o Mercado Livre**: usar `loja.id` mapeado em Configurações e o `numeroLoja` igual ao id do pedido do ML, com a deduplicação já existente em `ingestao/deduplicacao.ts`. Assim vendas de site, balcão ou outros marketplaces lançados no Bling entram na DRE sem duplicar o ML.
4. **CMV confiável**: na DRE e na Visão geral, mostrar ao lado do CMV "N vendas sem custo, R$ X de faturamento sem CMV", com link para `/produtos?pendencia=SEM_CUSTO`. Quando o custo de um produto for preenchido depois, reprocessar as vendas incompletas daquele produto (preencher `custoUnitario` só onde está nulo, mantendo a regra de custo congelado).

## FASE 5 — Telas

1. **Cabeçalho comum do Financeiro** (componente `CabecalhoFinanceiro`): seletor de período, botão "Atualizar dados" com progresso, "Atualizado em", selo de saúde dos dados (verde, amarelo ou vermelho, com link para o painel).
2. **DRE**: botão "Atualizar" (modo `PERIODO`), progresso por etapa, selo por linha (Confirmado, Estimado ou Incompleto) com tooltip da origem, drill-down de cada linha (vendas, cobranças ou lançamentos que compõem o valor), descontos como linha informativa, e "ML bancou R$ X em campanhas".
3. **Visão geral**: resumo do dia lendo os dados reais; com a importação em andamento, mostrar a faixa de progresso em vez de zeros; estado vazio com o botão "Importar minhas vendas" (nunca uma tela só com zeros).
4. **Vendas**: colunas de logística, preço cheio × vendido, desconto do vendedor e do ML, frete, liberação (data e se é confirmada ou estimada); filtro por logística e por status; seletor de produto (pendência do Ciclo 7).
5. **Configurações**: novas opções (liberação padrão, gerar conta a pagar ao confirmar compra, prazo padrão, Bling contas e pedidos ligados ou desligados, mapeamentos de categoria e loja) e o painel de saúde dos dados.

## FASE 6 — Verificação

1. `npx tsc --noEmit`, `npx next lint`, `npm test`, `npm run build` limpos.
2. Testes novos obrigatórios: os da Fase 0 passando; orquestrador retomando do cursor depois de um erro e depois de um "timeout" simulado; trava por conta; incremental com sobreposição; deduplicação Bling × ML; conta a pagar automática idempotente; DRE com descontos informativos e cancelamento sem duplicar.
3. Atualizar `docs/financeiro/fontes-mercado-livre.md` com o que foi **confirmado em produção** (seção "Diagnóstico verificado" acima) e o que segue pendente.
4. `docs/AUDITORIA-CICLO-8.md` com a lista de verificação para o Lucas fazer depois do deploy:
   - abrir Financeiro → ver a importação começar sozinha e terminar;
   - Saúde dos dados: cobertura do mês ≥ 99%;
   - comparar 3 vendas (comum, 2 unidades, cancelada) com o "Detalhe da venda" do ML: receita, tarifa, frete, desconto e líquido;
   - DRE do mês anterior: tarifas e frete × fatura do ML (diferença < 1%);
   - diagnóstico `?tipo=ads` e `?tipo=pagamento` para confirmar ads e liberação.
5. Commit final e `git push origin master`.

---

## Passos manuais do Lucas (fora do código)
1. No painel de desenvolvedores do Mercado Livre (seu aplicativo → Notificações): URL `https://estoque-api-4iqj.vercel.app/api/mercadolivre/webhook` com os tópicos **orders_v2, shipments, payments, claims, items** marcados.
2. No aplicativo do Bling: incluir os escopos **Contas a pagar, Contas a receber, Categorias de receitas e despesas e Pedidos de venda**, e depois **Reconectar** o Bling em Integrações.
3. Depois do deploy: abrir o Financeiro e deixar a importação terminar (ou fechar a página: o cron continua no dia seguinte).
