# Leap Stock — Ciclo 7: Módulo Financeiro (DRE, lucro por venda e por produto, contas a pagar, fluxo de caixa)

Documento autocontido de planejamento e execução para o Claude Code. Execute as fases **na ordem**. Ao final de cada fase: `npx tsc --noEmit`, `npx next lint`, `npm test` e commit descritivo em português. Registre decisões e desvios em `docs/AUDITORIA-CICLO-7.md`.

## Objetivo

Criar a aba **Financeiro** do Leap Stock: o lugar onde o dono da conta vê quanto vendeu, quanto o Mercado Livre cobrou, quanto pagou de frete e de anúncios, quanto custou a mercadoria, quanto gastou para manter a empresa e quanto sobrou de verdade (no dia, no mês e por produto). Na mesma aba ele lança e controla todas as saídas: custos fixos, custos únicos, cartão de crédito, compras.

A referência de mercado é o Mercado Turbo: lucro por venda, DRE, contas a pagar e dashboard financeiro. A diferença do Leap Stock é que o financeiro fica integrado ao estoque, ao custo médio e à reposição que já existem.

## Regras inegociáveis

1. **Modular e multicanal desde o primeiro dia.** Nada do domínio financeiro pode depender diretamente do Mercado Livre. O ML entra por um **adaptador de canal**. Shopee, Amazon, Magalu, loja própria e pedidos vindos de ERP (Bling) devem poder entrar depois só criando um novo adaptador, sem mexer em DRE, telas ou fórmulas.
2. **Nenhum número inventado.** Todo valor tem origem rastreável e nível de confiança (`CONFIRMADO` vindo da API ou de lançamento pago, `ESTIMADO` vindo de cálculo). Valor que falta aparece como "—" com o motivo e vira pendência, nunca como 0.
3. **Dinheiro sempre em centavos (`Int`)**, como no resto do projeto. Somas grandes em SQL voltam como `BigInt`: converter na borda.
4. **Fuso `America/Sao_Paulo`** para tudo que é "dia" ou "mês". Uma venda às 23h50 de Brasília pertence àquele dia, não ao dia seguinte em UTC.
5. **Idempotência.** Reprocessar o mesmo pedido, webhook, fatura ou recorrência nunca duplica valor. Toda linha que vem de fora tem chave externa única.
6. **Escopo por conta (`contaId`)** em toda consulta, como o resto do app. Toda rota passa por `verifyUser`, validação Zod e checagem de permissão.
7. **Não quebrar o que funciona.** Estoque, reposição, pendências, dashboard e integrações continuam funcionando durante todo o ciclo. As migrações são aditivas.
8. Diretrizes de código dos ciclos anteriores: sem comentários no código, TypeScript estrito, sem `any` novo, cor só por token semântico, componentes de UI existentes (`PageHeader`, `HeroMetric`, `StatStrip`, `SectionCard`, `StatusPill`, `DeltaIndicator`, `KpiCard`, `PartialDataAlert`, `DataTable`, `ProductImage`, `Skeleton`), responsivo em 375 px, tema claro e escuro.

## Decisões padrão (ajustáveis em Configurações do Financeiro)

| Tema | Padrão | Alternativa configurável |
|---|---|---|
| Regime da DRE | **Competência**: a venda entra no dia em que foi paga pelo comprador | Fluxo de caixa separado, por data de liberação do dinheiro |
| Cancelamento e devolução | Abatidos no **mês da venda** (o resultado do mês fica correto quando tudo assenta) | Abater no mês do cancelamento |
| Imposto sobre venda | Estimado por alíquota (`ConfiguracaoGeral.aliquotaImposto`, já existe) | Usar os lançamentos reais de DAS/impostos e desligar a estimativa |
| Compra de mercadoria | Entra no **fluxo de caixa** (saída de dinheiro), **não** na DRE. Na DRE entra o **CMV** no momento da venda | — |
| Rateio de custo fixo no lucro por produto | Proporcional ao faturamento do produto | Por unidade vendida, ou sem rateio (mostra só a margem de contribuição) |
| Quem vê o Financeiro | `ADMIN` | Liberar `COMPRAS` como leitura |

---

## Conceitos e fórmulas (fonte única: `src/modules/financeiro/dominio/formulas.ts`)

### Por venda (pedido)
- **Faturamento bruto** = Σ (`preço unitário pago` × quantidade) dos itens. Não inclui o frete que o comprador pagou ao ML.
- **Desconto do vendedor** = parte dos descontos e cupons custeada pelo vendedor. Desconto custeado pelo ML não reduz a receita do vendedor.
- **Tarifa de venda** = soma da `sale_fee` dos itens. A Fase 0 confirma se o valor é por unidade ou por linha; inclui a taxa fixa por unidade de itens baratos.
- **Frete pago pelo vendedor** = custo do envio para o vendedor (`/shipments/{id}/costs`, `senders[].cost`) menos as compensações. Flex usa o custo por envio configurado. Retirada: 0.
- **Imposto** = (faturamento bruto − desconto do vendedor) × alíquota.
- **Ads atribuídos** = custo de Product Ads do anúncio no dia, rateado pelas vendas daquele anúncio no dia.
- **CMV** = Σ quantidade × custo unitário **congelado no momento da venda** (`Produto.custoMedio` via `src/lib/custo.ts`; kit = soma dos componentes). Sem custo: CMV nulo, venda marcada como incompleta, pendência `SEM_CUSTO`.
- **Margem de contribuição** = faturamento bruto − desconto do vendedor − imposto − tarifa − frete − ads − CMV.
- **Valor líquido a receber** = o que o Mercado Pago libera para a venda; a data vem do pagamento.

### DRE gerencial (mensal, por competência)
```
(+) Faturamento bruto de vendas
(−) Cancelamentos e devoluções
(−) Descontos concedidos pelo vendedor
(=) Receita operacional bruta
(−) Impostos sobre vendas
(=) Receita líquida
(−) Custos variáveis de venda
      Tarifas de venda do marketplace
      Frete pago pelo vendedor
      Publicidade (Product Ads / campanhas)
      Armazenagem e serviços Full
      Frete de devolução e outros custos de pedido
(−) CMV (custo da mercadoria vendida)
(=) Margem de contribuição  (R$ e % da receita líquida)
(−) Despesas operacionais (por categoria do plano de contas: pessoal, ocupação, software, contabilidade, marketing externo, administrativas…)
(=) Resultado operacional (EBITDA gerencial)
(−/+) Resultado financeiro (juros e IOF de cartão, antecipação, tarifas bancárias, rendimentos)
(−) IR/CSLL (só se o regime for Presumido ou Real)
(=) Lucro líquido
```
Indicadores ao lado da DRE: margem de contribuição %, margem líquida %, **ponto de equilíbrio** (= despesas fixas ÷ MC%), ticket médio, custo de aquisição por venda (ads ÷ pedidos), ROAS/ACOS.

### Lucro por produto
Para cada SKU no período: unidades, faturamento, descontos, tarifa, frete, ads, imposto, CMV, **margem de contribuição (R$ e %)**, rateio de custo fixo (conforme a configuração), **lucro líquido**, ROI sobre o CMV e curva ABC por margem. Kits mostram a própria linha e podem ser abertos nos componentes.

---

## Arquitetura

```
src/modules/financeiro/
  dominio/            tipos canônicos, enums, formulas.ts, dinheiro.ts (centavos), periodo.ts (fuso SP), funções puras testáveis
  canais/
    tipos.ts          interface AdaptadorCanalFinanceiro
    registro.ts       { MERCADO_LIVRE: adaptadorMercadoLivre }  (Shopee, Amazon… entram aqui)
    mercadoLivre/     cliente, mapeadores pedido→VendaCanal, frete, ads, cobranças, liberações
  erp/
    tipos.ts          interface AdaptadorErpFinanceiro (exportar contas a pagar e importar pedidos de outros canais) — só a interface neste ciclo
  ingestao/           sincronizador (backfill retomável, incremental, webhook), deduplicação entre canais
  lancamentos/        serviço de lançamentos, recorrências, parcelamento, cartão/faturas
  relatorios/         motor da DRE (com fontes plugáveis), resumo do dia, lucro por venda, lucro por produto, fluxo de caixa, snapshot diário
  permissoes.ts       ações FINANCEIRO_VER / FINANCEIRO_EDITAR (integradas a src/lib/permissoes.ts)
src/app/api/financeiro/...   rotas finas: validam, checam permissão e chamam os serviços do módulo
src/app/(root)/financeiro/... telas
```

**Interface do adaptador de canal** (contrato estável, implementado primeiro pelo ML):
```ts
interface AdaptadorCanalFinanceiro {
  canal: CanalVenda;
  listarPedidosAlterados(conta, desde: Date, ate: Date, cursor?): Promise<PaginaPedidos>;
  obterPedido(conta, pedidoExternoId): Promise<VendaCanalNormalizada>;
  obterCustoEnvio?(conta, envioId): Promise<CustoEnvioNormalizado>;
  listarGastosAds?(conta, dia: Date): Promise<GastoAdsNormalizado[]>;
  listarCobrancas?(conta, mes: string): Promise<CobrancaNormalizada[]>;
  listarLiberacoes?(conta, desde: Date, ate: Date): Promise<LiberacaoNormalizada[]>;
}
```
O domínio só conhece os tipos `*Normalizada`. Capacidade opcional ausente significa "o canal não informa"; a tela mostra isso em vez de zero.

**Motor da DRE com fontes plugáveis**: `FonteDre` (vendas, lançamentos, ads, cobranças não cobertas pelos pedidos). Cada fonte devolve linhas `{ grupoDre, categoria, valor, confianca, origem }` para o período. O motor soma e monta a estrutura. Uma fonte nova (por exemplo, cobranças da Shopee) é só mais um item na lista.

**Snapshot diário**: `ResumoFinanceiroDiario` é atualizado a cada ingestão (por conta, dia e canal) para o dashboard e a DRE responderem rápido sem varrer pedidos.

---

## Modelo de dados (migração aditiva)

```prisma
enum CanalVenda { MERCADO_LIVRE SHOPEE AMAZON MAGALU LOJA_PROPRIA ERP OUTRO }
enum StatusVendaCanal { PAGA CANCELADA DEVOLVIDA DEVOLVIDA_PARCIAL EM_MEDIACAO }
enum GrupoDre { RECEITA_BRUTA DEDUCAO_RECEITA IMPOSTO_VENDA CUSTO_VARIAVEL CMV DESPESA_OPERACIONAL RESULTADO_FINANCEIRO IMPOSTO_LUCRO NAO_OPERACIONAL }
enum TipoLancamento { RECEITA DESPESA TRANSFERENCIA }
enum StatusLancamento { PREVISTO PAGO CANCELADO }
enum OrigemLancamento { MANUAL RECORRENCIA PARCELAMENTO CARTAO PEDIDO_COMPRA CANAL_COBRANCA CONCILIACAO ERP }
enum Confianca { ESTIMADO CONFIRMADO }
enum TipoContaFinanceira { BANCO CARTAO_CREDITO CARTEIRA_MARKETPLACE CAIXA }
enum FrequenciaRecorrencia { SEMANAL MENSAL ANUAL }

model VendaCanal {
  id, userId, canal CanalVenda, contaCanalId String, pedidoExternoId String, pacoteExternoId String?,
  dataVenda DateTime, dataCancelamento DateTime?, dataLiberacao DateTime?, status StatusVendaCanal,
  logistica String?, envioExternoId String?,
  faturamentoBruto Int, descontoVendedor Int, tarifaVenda Int, freteVendedor Int?, freteComprador Int,
  impostoEstimado Int, adsAtribuido Int, cmv Int?, outrosCustos Int, margemContribuicao Int?,
  valorLiquidoReceber Int?, completo Boolean, faltando String[],
  freteConfianca Confianca, atualizadoNoCanalEm DateTime, itens VendaCanalItem[]
  @@unique([userId, canal, pedidoExternoId])
  @@index([userId, dataVenda]) @@index([userId, dataLiberacao])
}
model VendaCanalItem {
  id, vendaId, produtoId String?, sku String?, anuncioExternoId String, variacaoExternaId String?, titulo String,
  quantidade Int, precoUnitario Int, precoCheio Int?, tarifaVenda Int, freteRateado Int?, descontoRateado Int,
  impostoRateado Int, adsRateado Int, custoUnitario Int?, margemContribuicao Int?
  @@index([produtoId])
}
model CategoriaFinanceira { id, userId, nome, grupoDre GrupoDre, paiId String?, sistema Boolean, ativo Boolean, ordem Int  @@unique([userId, paiId, nome]) }
model ContaFinanceira { id, userId, nome, tipo TipoContaFinanceira, saldoInicial Int, dataSaldoInicial DateTime, diaFechamento Int?, diaVencimento Int?, limite Int?, ativo Boolean }
model LancamentoFinanceiro {
  id, userId, tipo TipoLancamento, descricao, valor Int, categoriaId, contaFinanceiraId String?,
  competencia DateTime, vencimento DateTime, pagamento DateTime?, status StatusLancamento, origem OrigemLancamento, confianca Confianca,
  fornecedorId String?, produtoId String?, pedidoCompraId Int?, vendaId String?, recorrenciaId String?, faturaCartaoId String?,
  grupoParcelamentoId String?, parcelaNumero Int?, parcelaTotal Int?, chaveExterna String?, anexoUrl String?, observacao String?, criadoPorId String
  @@unique([userId, chaveExterna])
  @@index([userId, competencia]) @@index([userId, vencimento, status])
}
model RecorrenciaFinanceira { id, userId, descricao, valor Int, categoriaId, contaFinanceiraId String?, fornecedorId String?, frequencia FrequenciaRecorrencia, diaVencimento Int, inicio DateTime, fim DateTime?, ativo Boolean, geradoAte DateTime? }
model FaturaCartao { id, userId, contaFinanceiraId, mesReferencia String, fechamento DateTime, vencimento DateTime, status StatusLancamento, lancamentoPagamentoId String?  @@unique([contaFinanceiraId, mesReferencia]) }
model GastoAdsCanal { id, userId, canal, contaCanalId, dia DateTime, campanhaExternaId String?, anuncioExternoId String?, produtoId String?, custo Int, cliques Int?, impressoes Int?, vendasAtribuidas Int?, receitaAtribuida Int?  @@unique([userId, canal, dia, campanhaExternaId, anuncioExternoId]) }
model CobrancaCanal { id, userId, canal, contaCanalId, mesReferencia String, detalheExternoId String, tipoExterno String, tipoNormalizado String, valor Int, pedidoExternoId String?, anuncioExternoId String?, data DateTime, coberturaPedido Boolean  @@unique([userId, canal, detalheExternoId]) }
model ResumoFinanceiroDiario { id, userId, dia DateTime, canal CanalVenda, pedidos Int, unidades Int, faturamentoBruto Int, cancelamentos Int, descontos Int, impostos Int, tarifas Int, frete Int, ads Int, cmv Int, margemContribuicao Int, vendasIncompletas Int, atualizadoEm DateTime  @@unique([userId, dia, canal]) }
model SincronizacaoFinanceira { id, userId, canal, tipo String, cursor Json?, status String, iniciadoEm DateTime, concluidoEm DateTime?, processados Int, erro String? }
```
Também na mesma migração: `ConfiguracaoGeral` ganha `regimeTributario`, `cancelamentoNaCompetencia` (`VENDA`/`CANCELAMENTO`), `rateioCustoFixo` (`FATURAMENTO`/`UNIDADE`/`NENHUM`), `custoEnvioFlex Int?` e `usarImpostoEstimado Boolean @default(true)`. Os nomes reais dos campos seguem o padrão do schema (relações, `onDelete`, `@@map` em snake_case como nas tabelas novas do Ciclo 6).

**Plano de contas padrão** (seed idempotente por conta, categorias `sistema=true` não podem ser apagadas, só desativadas): Receitas de vendas · Cancelamentos e devoluções · Descontos · Impostos sobre vendas (DAS/ICMS) · Tarifas de marketplace · Frete de vendas · Publicidade marketplace · Armazenagem Full · Custo da mercadoria vendida · Pessoal (salários, pró-labore, encargos) · Ocupação (aluguel, energia, internet) · Software e assinaturas · Contabilidade e jurídico · Marketing externo · Embalagens e insumos · Logística própria (motoboy, Flex) · Administrativas · Juros e tarifas financeiras · Rendimentos · Outras.

---

## FASE 0 — Linha de base e verificação dos dados do Mercado Livre

1. Rodar `tsc`, `lint`, `test` e registrar em `docs/AUDITORIA-CICLO-7.md`.
2. Ler o que já existe e será reaproveitado: `src/lib/mlOrders.ts` (`fetchAllOrders` com filtro de data), `src/services/mercadoLivreService.ts` (token com trava, `processOrderWebhook`), `src/lib/mlFetch.ts` (backoff e fila), `src/lib/margem.ts`, `src/lib/custo.ts`, `src/lib/pendencias.ts`, `src/services/reposicaoService.ts`, `src/app/api/dashboard/resumo/route.ts`, `ConfiguracaoGeral.aliquotaImposto`, `src/lib/permissoes.ts`, os crons em `src/app/api/cron/*`.
3. Criar a rota **somente ADMIN** `GET /api/financeiro/diagnostico/mercado-livre?pedido=<id>`. Ela devolve, **com tokens e dados pessoais do comprador removidos**: o pedido (`/orders/{id}`), os descontos do pedido (`/orders/{id}/discounts`), os custos do envio (`/shipments/{id}/costs`) e os pagamentos. Como este ambiente pode não alcançar a API do ML, a rota será usada em produção pelo Lucas para confirmar: se `sale_fee` é por unidade ou por linha; os campos de desconto e cupom e quem os custeia; os campos de custo do frete e de compensação; e a data de liberação do dinheiro. **Escreva os mapeadores contra a documentação e deixe testes com fixtures; se a Fase 3 encontrar divergência no diagnóstico real, ajuste o mapeador e o fixture.**
4. Documentar em `docs/financeiro/fontes-mercado-livre.md` cada campo usado, de onde vem, e o nível de confiança.

## FASE 1 — Modelo de dados, plano de contas e permissões

1. Migração aditiva com os modelos acima e campos novos em `ConfiguracaoGeral`. Use `IF NOT EXISTS` onde fizer sentido: o build da Vercel roda `migrate deploy` e já houve conflito de índice no Ciclo 6.
2. Seed do plano de contas padrão por conta, chamado sob demanda (primeiro acesso à aba) e idempotente.
3. Permissões novas `FINANCEIRO_VER` e `FINANCEIRO_EDITAR` na matriz de `src/lib/permissoes.ts` (ADMIN: SIM/SIM; COMPRAS: NAO por padrão, configurável; demais: NAO). Item "Financeiro" no `Sidebar` só para quem pode ver.
4. Testes: seed idempotente; isolamento entre contas nas tabelas novas.

## FASE 2 — Núcleo do domínio (funções puras, 100% testadas)

1. `dominio/dinheiro.ts` (somar, ratear sem perder centavo pelo método do maior resto, formatar), `dominio/periodo.ts` (início e fim de dia, semana e mês em `America/Sao_Paulo`; competência de uma data).
2. `dominio/formulas.ts`: `calcularResultadoVenda(venda, itens, contexto)` → todos os campos da venda e dos itens, com `completo` e `faltando`; `ratearCustoVendaPorItem`; `calcularMargemContribuicao`; `calcularPontoEquilibrio`; `ratearCustoFixoPorProduto`. Reaproveitar ou alinhar com `src/lib/margem.ts` sem duplicar regra: `margem.ts` passa a delegar para o domínio.
3. Testes com casos reais: venda com kit, venda com 2 itens e frete único (rateio), venda cancelada, devolução parcial, produto sem custo, Flex, Full, item abaixo do valor da taxa fixa, desconto custeado pelo ML × pelo vendedor.

## FASE 3 — Adaptador Mercado Livre e ingestão de vendas

1. `canais/mercadoLivre/`: implementar `listarPedidosAlterados` (busca por `order.last_updated` ou por data, paginando com o limite de offset do ML), `obterPedido`, `obterCustoEnvio`. Usar o cliente com backoff e concorrência limitada já existente (`mlFetch`) e o token com trava.
2. `ingestao/sincronizador.ts`:
   - **Backfill retomável** dos últimos 90 dias (configurável até 365), em blocos que cabem no tempo de uma função da Vercel, com cursor em `SincronizacaoFinanceira`. Botão "Importar histórico" com barra de progresso.
   - **Incremental**: o webhook `orders_v2` que já existe passa a chamar também a ingestão financeira daquele pedido, sem atrasar a resposta de 200 (`after()`). O cron diário reprocessa os últimos 3 dias para pegar cancelamentos, devoluções e custo de frete que chegam depois.
   - **Custo unitário congelado**: na primeira ingestão de cada item, gravar `custoUnitario` com o custo da época. Em reprocessamentos, não sobrescrever, a não ser que o custo estivesse nulo (aí preenche e marca na auditoria).
   - Vincular o item ao `Produto` pelo vínculo existente (`ProdutoMercadoLivre`), depois pelo SKU normalizado. Sem vínculo, a venda entra mesmo assim, com pendência `SEM_VINCULO`.
   - Atualizar `ResumoFinanceiroDiario` dos dias afetados ao final de cada lote.
3. **Deduplicação entre canais**: se no futuro pedidos do Bling forem importados, um pedido cuja origem seja o ML (número da loja = id do pedido ML) não pode entrar duas vezes. Deixar a regra implementada e testada na camada de ingestão (`chave canônica = canal de origem + id externo de origem`).
4. Testes do mapeador com fixtures: pedido pago, carrinho com pacote (`pack_id`) e frete único, cancelado, devolvido, Full.

## FASE 4 — Publicidade, cobranças do ML e liberações

1. **Product Ads**: ler o custo diário por anúncio e campanha pela API de Product Ads (conferir o endpoint e as métricas na documentação "Product Ads – leitura" do ML; a conta precisa ter o anunciante habilitado). Gravar em `GastoAdsCanal`, vincular o anúncio ao produto e ratear nas vendas do dia daquele anúncio (`adsRateado`). Ads sem venda no dia entram na DRE como custo de publicidade do período, não somem.
2. **Cobranças mensais (billing)**: `GET /billing/integration/periods/key/{AAAA-MM-01}/group/ML/details?document_type=BILL` paginando por `from_id` (limite 1000), mais as notas de crédito. Gravar em `CobrancaCanal` com `tipoNormalizado`. Cobranças já cobertas pelo pedido (tarifa de venda, frete do pedido) ficam com `coberturaPedido=true` e servem **só para conciliação**. As não cobertas (armazenagem Full, Product Ads quando a API de Ads não estiver disponível, outras tarifas) viram linhas da DRE pela fonte de cobranças. Códigos desconhecidos aparecem na tela de configuração como "não mapeados", com valor; nada é descartado em silêncio.
3. **Conciliação**: relatório mensal "Pedidos × Fatura do ML", com a diferença por tipo. Diferença acima de 1% vira alerta, com um botão que gera lançamento de ajuste (`origem: CONCILIACAO`).
4. **Liberações (fluxo de caixa)**: usar a data de liberação do pagamento do pedido para o valor a receber. Como etapa opcional desligada por padrão, preparar a leitura do relatório de dinheiro liberado do Mercado Pago (`/v1/account/release_report`) para conferir o realizado, atrás de uma flag de configuração.

## FASE 5 — Lançamentos: custos fixos, únicos, cartão e compras

1. CRUD de lançamentos (receita, despesa, transferência entre contas) com categoria, conta financeira, fornecedor opcional, produto opcional, competência, vencimento, pagamento, anexo (Vercel Blob, já usado no avatar) e observação.
2. **Custo fixo (recorrência)**: cadastro com frequência, dia de vencimento e vigência. O gerador cria os lançamentos `PREVISTO` dos próximos 3 meses e roda no cron diário. Editar a recorrência pergunta se a mudança vale "só daqui pra frente" ou "também para os previstos".
3. **Custo único**: lançamento avulso.
4. **Parcelamento**: uma compra em N vezes gera N lançamentos ligados por `grupoParcelamentoId`, com rateio de centavos na última parcela.
5. **Cartão de crédito**: conta do tipo `CARTAO_CREDITO` com dia de fechamento e vencimento. A compra no cartão entra na fatura certa conforme a data e o fechamento. A tela da fatura soma os lançamentos, e "Pagar fatura" gera o pagamento na conta bancária e marca as despesas como pagas. Na DRE, a despesa conta pela competência da compra; no fluxo de caixa, sai no vencimento da fatura.
6. **Compras de mercadoria**: ao confirmar um `PedidoCompra` (fluxo que já existe), oferecer "Gerar conta a pagar" com valor, vencimento e parcelamento. Isso vai para o **fluxo de caixa**, categoria "Compra de mercadoria (estoque)", fora da DRE, porque a DRE recebe o CMV na venda. Explicar isso em uma linha na própria tela.
7. Ações em lote: marcar como pago, alterar categoria, excluir previstos. Filtros por período, status, categoria, conta, fornecedor e origem; exportação para xlsx (a biblioteca já está no projeto).
8. Testes: geração de recorrência sem duplicar (rodar duas vezes), fatura de cartão com compra no dia do fechamento, parcelamento com centavos, pagamento de fatura.

## FASE 6 — Serviços de relatório

1. `relatorios/dre.ts`: DRE mensal por competência, filtros por canal e conta de canal, comparativo com os meses anteriores (até 12 colunas) e análise vertical (% sobre a receita líquida). Cada linha permite abrir a lista de origem (vendas, lançamentos, cobranças).
2. `relatorios/resumoDia.ts`: para uma data, pedidos, unidades, faturamento, cancelamentos do dia, descontos, tarifa, frete, ads, imposto, CMV, margem de contribuição, **lucro estimado do dia** (MC − custo fixo diário rateado = despesas fixas previstas do mês ÷ dias do mês), ticket médio, comparação com ontem e com a média dos últimos 7 dias, contas a pagar vencendo hoje e vencidas, valor a liberar no Mercado Pago.
3. `relatorios/lucroPorVenda.ts`: lista paginada de vendas com a composição completa, filtros (período, status, só prejuízo, só incompletas, produto, logística) e o detalhe de cada venda.
4. `relatorios/lucroPorProduto.ts`: tabela por SKU com as colunas descritas acima, ordenação, curva ABC e destaque para produtos com margem negativa.
5. `relatorios/fluxoCaixa.ts`: realizado × previsto por dia, semana e mês; saldo projetado de 30/60/90 dias somando o saldo inicial das contas, as liberações futuras do ML e os lançamentos previstos.
6. Todas as consultas usam o `ResumoFinanceiroDiario` quando possível; cache curto por conta, invalidado nas escritas.

## FASE 7 — Telas da aba Financeiro

Item novo "Financeiro" no menu, com subpáginas:

1. **`/financeiro` — Visão geral**
   - Cabeçalho com seletor de período (Hoje, 7 dias, Mês atual, Mês anterior, Personalizado), canal e "Atualizado às HH:mm".
   - **Resumo do dia** em destaque: faturamento, pedidos, margem de contribuição, lucro estimado do dia, comparação com ontem.
   - `HeroMetric` de lucro líquido do período e `StatStrip` com faturamento bruto, margem de contribuição %, ticket médio, ads/ACOS e ponto de equilíbrio (com quanto falta vender no mês para atingi-lo).
   - **Gráfico em cascata** do faturamento até o lucro líquido (cancelamentos, impostos, tarifas, frete, ads, CMV, despesas fixas).
   - Série diária de faturamento × margem de contribuição; pizza ou barras das despesas por categoria.
   - Top 10 produtos por lucro e os 10 com pior margem; vendas com prejuízo no período.
   - Contas a pagar dos próximos 7 dias e vencidas; saldo projetado.
   - Alertas: vendas incompletas (sem custo, sem vínculo, sem frete), cobranças do ML não mapeadas, diferença de conciliação.
2. **`/financeiro/dre`** — DRE mensal com comparativo, análise vertical, drill-down e exportação para xlsx e PDF (jspdf já está no projeto).
3. **`/financeiro/vendas`** — lucro por venda, com o painel lateral de detalhe mostrando cada componente e a origem (API, estimado ou lançamento).
4. **`/financeiro/produtos`** — lucro por produto e curva ABC; link para a ficha do produto e para a reposição.
5. **`/financeiro/lancamentos`** — contas a pagar e a receber: lista, filtros, criação (único, recorrente, parcelado, no cartão), edição, pagamento e lote.
6. **`/financeiro/fluxo-de-caixa`** — realizado × previsto e saldo projetado.
7. **`/financeiro/cartoes`** — cartões e faturas (aberta, fechada, paga) com os lançamentos de cada uma.
8. **`/financeiro/configuracoes`** — plano de contas (criar, editar, ordenar e desativar categorias), contas financeiras e saldo inicial, regime e alíquota, regras (cancelamento na competência, rateio de fixos, custo do Flex), importação de histórico, cobranças não mapeadas e diagnóstico do ML.

Padrões: skeleton por bloco, estado vazio com ação ("Importe seu histórico de vendas", "Cadastre seus custos fixos"), tooltip com a fórmula em todo número, "—" com motivo para dado faltante, `PartialDataAlert` quando a ingestão estiver em andamento, gráficos com `src/lib/chart-colors.ts`.

## FASE 8 — Integração com o resto do app

1. O dashboard principal (`/api/dashboard/resumo`) passa a ler faturamento, margem e lucro do módulo financeiro, sem estimativa paralela.
2. A ficha do produto ganha o bloco "Resultado real dos últimos 30 dias" (vendas, MC, lucro); as pendências usam `vendasIncompletas`.
3. Notificações novas: contas vencendo amanhã, contas vencidas, venda com prejuízo acima de X, diferença de conciliação mensal.
4. Os crons novos seguem o padrão `CRON_SECRET`. Lembrete: no plano Hobby a Vercel só roda cron uma vez por dia, então juntar em uma única rota `api/cron/financeiro-diario` (reprocessar 3 dias, ads do dia anterior, recorrências, snapshot, alertas).

## FASE 9 — Extensibilidade, qualidade e verificação

1. `docs/financeiro/como-adicionar-um-canal.md`: passo a passo para criar um adaptador (Shopee como exemplo), com o contrato, os testes obrigatórios e o registro.
2. Interface `AdaptadorErpFinanceiro` documentada (exportar contas a pagar e categorias para o Bling via `/contas/pagar` e `/categorias/receitas-despesas`; importar pedidos de outros canais), sem implementação neste ciclo.
3. Testes: domínio (fórmulas, rateios, períodos), mapeadores com fixtures, recorrência, cartão, DRE de um mês sintético conferida linha a linha, isolamento entre contas e permissões nas rotas `/api/financeiro/*`.
4. `npx tsc --noEmit`, `npx next lint`, `npm test` e `npm run build` limpos.
5. Conferência manual descrita em `docs/AUDITORIA-CICLO-7.md` para o Lucas fazer em produção: abrir o diagnóstico de 3 pedidos reais (um comum, um Full, um cancelado) e comparar com o "Detalhe da venda" no painel do Mercado Livre; comparar o total de tarifas do mês com a fatura do ML.

---

## Ordem de execução

0. Linha de base e diagnóstico do ML
1. Modelo de dados, plano de contas e permissões
2. Domínio e fórmulas (testes primeiro)
3. Adaptador ML e ingestão (backfill, webhook, cron, snapshot)
4. Ads, cobranças, conciliação e liberações
5. Lançamentos, recorrências, parcelamento, cartão e compras
6. Relatórios (DRE, resumo do dia, lucro por venda e por produto, fluxo de caixa)
7. Telas
8. Integração com o dashboard, os produtos e as notificações
9. Documentação de extensibilidade, testes e verificação final

Ao terminar cada fase, faça commit e siga para a próxima sem pedir confirmação, a não ser que algo bloqueie (migração arriscada, divergência de dado do ML que mude uma fórmula, ou decisão de negócio fora das "Decisões padrão"). Nesse caso, pare e explique.
