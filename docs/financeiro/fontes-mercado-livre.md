# Fontes de dados financeiros — Mercado Livre

Documento de referência do Ciclo 7 (módulo Financeiro). Cada linha diz de onde vem um número, qual confiança ele tem e se já foi confirmado contra um pedido real. Atualizar sempre que o diagnóstico (`GET /api/financeiro/diagnostico/mercado-livre?pedido=<id>`, só ADMIN) revelar divergência.

Este ambiente de desenvolvimento não alcança `api.mercadolibre.com` (bloqueado por `PolicyAgent` do próprio ML — confirmado no Ciclo 6). Os formatos abaixo vêm de documentação oficial e exemplos de resposta publicados por terceiros, **nenhum confirmado contra uma conta real nesta sessão**. Rodar o diagnóstico em produção é o próximo passo antes de confiar nestes números.

| Campo | Endpoint | Caminho na resposta | Confiança | Status |
|---|---|---|---|---|
| Faturamento bruto do item | `GET /orders/{id}` | `order_items[].unit_price × quantity` | CONFIRMADO (já usado desde o Ciclo 6, `sales-complete`) | Em uso |
| Tarifa de venda | `GET /orders/{id}` | `order_items[].sale_fee` | **Não confirmado se é por unidade ou por linha** — o Ciclo 6 assume por unidade (`sale_fee × quantity`) em `sales-complete/route.ts`; documentação pública encontrada é ambígua. **Ação**: conferir no diagnóstico com um pedido de quantidade > 1 e comparar com o valor da tarifa mostrado no painel do ML para aquele pedido. | Pendente de confirmação real |
| Desconto e quem custeia | `GET /orders/{id}/discounts` | `full` (desconto unitário total), `seller` (parte custeada pelo vendedor); pode haver mais de um desconto por venda (campanha, cupom, cashback) | ESTIMADO até confirmação — campos confirmados via documentação, não contra um pedido real | Pendente de confirmação real |
| Custo do frete pago pelo vendedor | `GET /shipments/{shippingId}/costs` | `senders[0].cost` menos `senders[0].compensations[].amount` (ou `compensation`, campo único visto em alguns exemplos — **confirmar qual dos dois o formato real usa**) | CONFIRMADO parcialmente no Ciclo 6 (`senders[0].cost` já em uso em `sales-complete`); a subtração de compensação é nova nesta fase | Pendente de confirmação real |
| Data de liberação do dinheiro | `GET /orders/{id}` → `payments[].money_release_date` (ISO 8601) | — | ESTIMADO — campo confirmado via documentação de Billing Reports, não visto num pedido real ainda | Pendente de confirmação real |
| Status do pagamento | `GET /orders/{id}` → `payments[].status` | — | CONFIRMADO (uso indireto já existente) | Em uso |
| Frete cobrado do comprador | `GET /orders/{id}` → `shipping` (campo solto hoje, tipo `Record<string, unknown>`) | — | A confirmar o nome exato do campo (`shipping.cost`? vem calculado no próprio `order_items`?) | Pendente de confirmação real |
| Cancelado × devolvido | `GET /orders/{id}` → `order.status === "cancelled"` + `order.order_request.return` (presença/truthiness) | ESTIMADO — campo já existia tipado no projeto (`order_request.return?: string`), mas nunca foi visto num pedido real. O mapeador (Fase 3) usa isso para decidir `CANCELADA` × `DEVOLVIDA`; sem esse campo, qualquer `cancelled` com pagamento aprovado vira `CANCELADA` | Pendente de confirmação real |
| Full × Flex × envio normal | `GET /orders/{id}` → `shipping.logistic_type` (`"fulfillment"` = Full, `"self_service"` = Flex, outros = envio padrão do ML) | ESTIMADO — valores de `logistic_type` vieram de documentação/exemplos públicos, não de um pedido real desta conta | Pendente de confirmação real |

## Perguntas abertas que o diagnóstico em produção precisa responder

1. `sale_fee` é por unidade ou já é o total da linha? (crítico — afeta toda tarifa calculada na DRE)
2. O campo de compensação em `/shipments/{id}/costs` é `compensation` (número único) ou `compensations` (lista de objetos com `amount`)? Os dois formatos aparecem em exemplos diferentes encontrados.
3. `discounts.seller` já vem em centavos por unidade, ou é a porcentagem?
4. Pedidos Full têm algum campo adicional de custo de armazenagem embutido no pedido, ou isso só aparece na cobrança mensal (Fase 4)?
5. `money_release_date` está mesmo dentro de `order.payments[]`, ou precisa de uma chamada separada a `/payments/{id}`?
6. `order_request.return` é mesmo o campo que indica devolução? Que valores ele assume (string de status? presença já basta?) — a Fase 3 implementou a melhor hipótese disponível (qualquer valor truthy = devolução), sem conseguir testar contra um pedido devolvido de verdade. Enquanto não confirmado, toda devolução real provavelmente está sendo registrada como `CANCELADA` em vez de `DEVOLVIDA` — as duas zeram a venda da mesma forma na margem, então o número financeiro não erra, só a categorização.

## Product Ads e Billing (Fase 4) — menor confiança de todo o ciclo

Diferente de pedidos/descontos/frete (APIs centrais e estáveis do ML, já usadas desde o Ciclo 6), estas duas integrações foram escritas de memória, contra documentação pública, **sem nenhuma confirmação de que o endpoint em si existe no caminho usado**. Qualquer falha (404, formato inesperado) já é tratada sem quebrar o cron — a lista fica vazia e a conta simplesmente não tem dado de ads/cobrança naquele dia, até alguém corrigir o endpoint com dado real.

| Campo | Endpoint (melhor esforço) | Confiança | Status |
|---|---|---|---|
| Anunciante (advertiser_id) | `GET /advertising/advertisers?product_id=PADS` | Caminho da URL não confirmado | Pendente de confirmação real |
| Métricas de ads por dia | `GET /advertising/product_ads/ads?advertiser_id=&date_from=&date_to=` (header `Api-Version: 2`) | Caminho da URL e nomes de métrica (`cost`, `clicks`, `prints`, `direct_amount`, `direct_items_quantity`) não confirmados | Pendente de confirmação real |
| Detalhe de cobrança mensal | `GET /billing/integration/periods/key/{AAAA-MM-01}/group/ML/details?document_type=BILL\|CREDIT_NOTE&sort_by=ID&order_by=ASC&from_id=<último id>` (Ciclo 8: corrigida a paginação, que usava `paging.next_from_id`, inexistente na resposta real — só a primeira página de até 1000 itens era lida) | Nomes de campo de cada linha (`charge_type`/`amount`/`order_id`) continuam um palpite; `PADS` (Product Ads) confirmado pelo prompt do Ciclo 8 | Paginação corrigida; nomes de campo pendentes de confirmação real |
| Notas de crédito da fatura | `document_type=CREDIT_NOTE` no mesmo endpoint acima (Ciclo 8) | Mesmo endpoint de BILL, mesma confiança nos nomes de campo | Pendente de confirmação real |
| Claims (devolução/mediação) | `GET /post-purchase/v1/claims/search?resource=order&resource_id=<pedido>` — exposto no diagnóstico (`?tipo=claims&pedido=`) desde o Ciclo 8, sem normalizador ainda | Endpoint e formato (`resource`/`resource_id`) não confirmados | Pendente de confirmação real |
| Liberação via Mercado Pago | `GET https://api.mercadopago.com/v1/payments/{id}` — exposto no diagnóstico (`?tipo=pagamento&id=`) desde o Ciclo 8; usado por `obterLiberacaoPagamento` com fallback para estimativa por `diasLiberacaoPadrao` | Host diferente (`api.mercadopago.com`), nomes de campo (`money_release_date`, `transaction_details.net_received_amount`) não confirmados | Pendente de confirmação real |
| Relatório de liberação do Mercado Pago | `GET https://api.mercadopago.com/v1/account/release_report?begin_date=&end_date=` usando o mesmo token OAuth da conta ML | Host diferente (`api.mercadopago.com`), nem se o token do ML é aceito aqui foi confirmado. Etapa opcional, desligada por padrão (`ConfiguracaoGeral.usarRelatorioLiberacaoMercadoPago`), só para conferência manual — nunca alimenta a DRE. | Pendente de confirmação real |

Mapeamento de `charge_type` → `tipoNormalizado` em `canais/mercadoLivre/mapeadorCobrancas.ts`: qualquer código fora do mapa cai em `NAO_MAPEADO` com o valor preservado (nunca descartado), para a tela de configurações (Fase 7) listar para revisão manual — exatamente como o prompt pede.

## Ciclo 8 — confirmado em produção (17/10/2026, conta LEAPSTORE)

Testado com 3 pedidos reais (comum, 2 unidades, cancelado pós-pagamento). Substitui as perguntas abertas correspondentes acima.

| Campo | Confirmado |
|---|---|
| `order.id`, `shipping.id`, `payments[].id` | Vêm como **número** na resposta real, não string — `pedidoSchema`/`envioSchema`/`pagamentoSchema` em `canais/mercadoLivre/esquemas.ts` convertem para string; `mapearPedido` também força `String(pedido.id)`. |
| `sale_fee` | Por unidade, confirmado (2,99 em pedido de 1 e de 2 unidades, mesmo anúncio) — mantém `sale_fee × quantity`. |
| `GET /orders/{id}/discounts` | Formato real é `{details:[{items:[{amounts:{total,seller}}], supplier:{funding_mode,offer_id}}]}`, não `{full,seller}` no topo. `unit_price` já vem líquido do desconto — `descontoVendedor` é informativo, não é subtraído de receita/imposto/margem/valorLiquidoReceber. `total − seller` é quanto o próprio ML custeou (`descontoCusteadoMl`, por item). |
| `GET /shipments/{id}/costs` | `senders[0].cost` e `senders[0].compensation`/`compensations` confirmados como já implementado (Ciclo 7). |
| Cancelamento pós-pagamento | `paid_amount` zera depois de um estorno — não serve para detectar se houve pagamento. `mapearStatus` passou a olhar o histórico de `payments[].status` (`approved`, `refunded`, `partially_refunded`, `charged_back`, `in_mediation`) com `transaction_amount > 0`. `cancel_detail.date` é a data real do cancelamento (fallback `last_updated`). |
| `shipping.logistic_type` | **Não vem no pedido** — o payload real só traz `{id}`. A logística confiável vem de `GET /shipments/{id}` (`mapearEnvio`), chamada separadamente pela ingestão antes de resolver o frete. |
| `money_release_date` | **Não vem nos pagamentos do pedido.** Fase 1 implementou busca em `GET https://api.mercadopago.com/v1/payments/{id}` (`obterLiberacaoPagamento`) — **não confirmado contra uma resposta real**, nomes de campo (`money_release_date`, `transaction_details.net_received_amount`) vieram de documentação pública. Sem resposta, cai em estimativa por `ConfiguracaoGeral.diasLiberacaoPadrao`. |

### Ainda não confirmado (introduzido na Fase 1 do Ciclo 8)

- `GET /shipments/{id}` devolvendo `order_id` (usado para religar o webhook de `shipments` ao pedido) — não confirmado.
- `GET /post-purchase/v1/claims/{id}` devolvendo `resource`/`resource_id` (usado no webhook de `claims`) — endpoint e formato não confirmados.
- `GET https://api.mercadopago.com/v1/payments/{id}` devolvendo `order.id` (usado no webhook de `payments` para religar ao pedido) — não confirmado.
- Devoluções (frete de retorno cobrado do vendedor via claims) e Full/Flex além do `logistic_type` básico: pendente para uma fase seguinte.

## Como usar o diagnóstico

```
GET /api/financeiro/diagnostico/mercado-livre?pedido=<id_do_pedido>
```

Requer sessão ADMIN. Usa a primeira conta ML ativa da conta (ou `?accountId=<id>` para escolher outra). Devolve o pedido, os descontos, o custo do envio e os pagamentos **sem token e sem dado pessoal do comprador** (e-mail, nome, endereço, cartão). Rodar com pelo menos 3 pedidos reais antes de confiar nos mapeadores da Fase 3: um comum, um Full, um com desconto/cupom.
