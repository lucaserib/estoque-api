# Definições do módulo Financeiro

Documento de referência do Ciclo 9 (`PROMPT-CICLO-9-FINANCEIRO-CONFIAVEL.md`, Fase 2, item 3). Cada número mostrado nas telas do Financeiro (DRE, Visão geral, resumo do período, dashboard, ficha do produto) segue a mesma definição — qualquer divergência entre telas é bug, não interpretação diferente.

## Período

Todo período (dia, mês, intervalo) é `[início do dia em SP, fim do dia em SP]`, incluindo o dia de hoje. `início do dia` e `fim do dia` vêm de `dominio/periodo.ts` (`inicioDoDia`/`fimDoDia`), nunca calculado em UTC "na mão" numa rota.

## Faturamento bruto

Σ `unit_price × quantidade` dos itens de pedidos com pagamento aprovado (`VendaCanal.status`), pela data do pedido (`dataVenda`). Inclui pedidos depois cancelados ou devolvidos — eles aparecem de novo, com o mesmo valor, na linha de cancelamentos.

## Cancelamentos e devoluções

Valor (`faturamentoBruto`) dos pedidos com status `CANCELADA`, `DEVOLVIDA` ou `DEVOLVIDA_PARCIAL`.

## Receita líquida

`faturamentoBruto − cancelamentos − impostoEstimado`. **O desconto de campanha (`descontoVendedor`) é informativo e nunca é subtraído aqui** — o `unit_price` do Mercado Livre já vem líquido do desconto; subtrair de novo contava o desconto duas vezes (bug C1 do Ciclo 9, corrigido em `relatorios/resumoDia.ts`).

## Tarifa de venda

Por pedido, nesta ordem de prioridade:
1. **Pagamento do Mercado Pago** (`charges_details`, ver `docs/financeiro/fontes-mercado-livre.md#ciclo-9`): soma de `ml_sale_fee` + `mp_processing_fee` + qualquer `mp_financing_*`, rateada entre os itens do pedido proporcionalmente ao faturamento de cada um. `confianca: CONFIRMADO`.
2. Sem pagamento disponível: `sale_fee` de cada item do pedido (`/orders/search`), por unidade. `confianca: ESTIMADO`.

## Frete do vendedor

Por pedido, nesta ordem de prioridade:
1. **Pagamento do Mercado Pago**: soma das cobranças `type: shipping` (`shp_*`). `confianca: CONFIRMADO`.
2. Envio Flex (`logistica: self_service`) sem pagamento disponível: `ConfiguracaoGeral.custoEnvioFlex` (valor fixo configurado) ou desconhecido (`SEM_FRETE`) se não configurado.
3. Qualquer outra logística sem pagamento disponível: `/shipments/{id}/costs` (`senders[0].cost − compensações`).
4. Pedidos de um mesmo pacote (`pacoteExternoId`) dividem o frete total proporcionalmente ao faturamento de cada pedido do pacote.

A Fase 3 do Ciclo 9 adiciona mais regras (ajuste manual, custo por produto/anúncio) — a prioridade completa fica documentada ali quando implementada.

## Retenção de dívidas

Cobranças do pagamento marcadas como retenção (`fee_spl`, ou qualquer cobrança com `metadata.source === "direct-charges"` ou `reserve_id` presente): o Mercado Livre descontando da venda para quitar fatura, Full ou ads de outro período. **Não é custo da venda** — não entra na margem de contribuição nem na DRE como despesa desta venda — mas reduz o valor líquido recebido e aparece na conciliação do caixa.

## Valor líquido a receber

Pagamento disponível: `transaction_details.net_received_amount`, direto do Mercado Pago (já contempla tarifa, frete, retenção e qualquer outro desconto do pagamento). Sem pagamento disponível: `faturamentoBruto − tarifa − frete` (estimativa, `null` se tarifa ou frete forem desconhecidos — nunca um zero inventado).

## Margem de contribuição

`faturamentoBruto − descontoVendedor(0, informativo) − impostoEstimado − tarifaVenda − freteVendedor − adsAtribuido − cmv`. Calculada por item e somada por venda (`dominio/formulas.ts`, `calcularMargemContribuicao`). `null` quando qualquer componente (`tarifa`, `frete`, `cmv`) é desconhecido — nunca parcial.

## CMV (custo da mercadoria vendida)

Congelado no momento da venda (`VendaCanalItem.custoUnitario`): usa `Produto.custoMedio` (ou o custo do kit, se completo) na primeira ingestão e não muda depois, mesmo que o custo do produto mude no cadastro — preserva o custo real daquela venda específica.

## Lucro líquido

`margemContribuicao − despesasOperacionais (todas, não só as rateadas como fixas) ± resultadoFinanceiro − IR/CSLL`. Mesma fórmula em toda tela que mostra "lucro líquido".

## Pagamento do Mercado Pago (detalhe)

Ver `docs/financeiro/fontes-mercado-livre.md`, seção "Ciclo 9", e `canais/mercadoLivre/mapeadorPagamento.ts` para a lógica exata de classificação de cada cobrança (`ehTarifa`/`ehFrete`/`ehRetencaoDeDivida`). Cada cobrança do pagamento é guardada em `CobrancaPagamento` (nunca descartada, mesmo quando o nome não é reconhecido — aparece em `desconhecidos` para revisão manual).

## O que ainda não está unificado (deferido do Ciclo 9, Fase 2)

Esta fase corrigiu os dois bugs que faziam a DRE e o resumo do período divergirem entre si (C1: desconto subtraído duas vezes; C3: janela UTC vs. SP) e trocou a fonte de tarifa/frete por pedido para o pagamento confirmado do Mercado Pago (C4). Um serviço único (`relatorios/consolidado.ts`) servindo DRE, resumo do dia, resumo do período, série diária, lucro por produto, dashboard e ficha do produto — item 2 do prompt original — **não foi construído nesta fase**: é uma reescrita de 6 pontos de consumo, e o restante do ciclo (Fases 3 a 7: frete configurável, saldo real, produtos/anúncios, visão geral completa) ainda precisa do tempo e do orçamento de risco que essa reescrita consumiria. As fórmulas de cada consumidor continuam onde estavam, agora sem as duas divergências medidas em produção; a consolidação completa fica registrada aqui como dívida explícita para um ciclo futuro.
