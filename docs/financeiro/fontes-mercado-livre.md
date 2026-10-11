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
| Detalhe de cobrança mensal | `GET /billing/integration/periods/key/{AAAA-MM-01}/group/ML/details?document_type=BILL`, paginado por `from_id` (limite 1000) | Endpoint veio do prompt do ciclo (confiança maior que ads), mas os nomes de campo de cada linha (`charge_type`/`amount`/`order_id`) são um palpite | Pendente de confirmação real |
| Notas de crédito da fatura | — | **Não implementado.** O prompt pede para somar também as notas de crédito; sem confiança nem no endpoint principal, não arrisquei um segundo endpoint de crédito sem nenhuma base. Fica como pendência explícita, não como bug escondido. | Pendente |
| Relatório de liberação do Mercado Pago | `GET https://api.mercadopago.com/v1/account/release_report?begin_date=&end_date=` usando o mesmo token OAuth da conta ML | Host diferente (`api.mercadopago.com`), nem se o token do ML é aceito aqui foi confirmado. Etapa opcional, desligada por padrão (`ConfiguracaoGeral.usarRelatorioLiberacaoMercadoPago`), só para conferência manual — nunca alimenta a DRE. | Pendente de confirmação real |

Mapeamento de `charge_type` → `tipoNormalizado` em `canais/mercadoLivre/mapeadorCobrancas.ts`: qualquer código fora do mapa cai em `NAO_MAPEADO` com o valor preservado (nunca descartado), para a tela de configurações (Fase 7) listar para revisão manual — exatamente como o prompt pede.

## Como usar o diagnóstico

```
GET /api/financeiro/diagnostico/mercado-livre?pedido=<id_do_pedido>
```

Requer sessão ADMIN. Usa a primeira conta ML ativa da conta (ou `?accountId=<id>` para escolher outra). Devolve o pedido, os descontos, o custo do envio e os pagamentos **sem token e sem dado pessoal do comprador** (e-mail, nome, endereço, cartão). Rodar com pelo menos 3 pedidos reais antes de confiar nos mapeadores da Fase 3: um comum, um Full, um com desconto/cupom.
