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

Por pedido, nesta ordem de prioridade (gravada em `VendaCanal.freteOrigem`, implementada em `ingestao/sincronizador.ts`'s `resolverFrete`):
1. **`AJUSTE_MANUAL`**: valor definido manualmente na venda (`VendaCanal.freteAjusteManual`), com motivo e usuário obrigatórios (`PATCH /api/financeiro/vendas/[id]/frete`). Uma vez definido, **sobrevive a qualquer reprocessamento** — nenhuma sincronização (incremental, período, `forcar: true`) o sobrescreve; só é removido explicitamente (`valorReais: null` na mesma rota), o que dispara uma nova resolução automática a partir da fonte real.
2. **`PAGAMENTO_CONFIRMADO`**: soma das cobranças `type: shipping` (`shp_*`) do pagamento confirmado do Mercado Pago.
3. **`CUSTO_ENVIO_CANAL`**: sem pagamento disponível e logística ≠ `self_service` (Flex não é cobrado dessa forma): `/shipments/{id}/costs` (`senders[0].cost − compensações`). Pedidos de um mesmo pacote (`pacoteExternoId`) dividem esse valor proporcionalmente ao faturamento de cada pedido do pacote — exceto os que já têm `AJUSTE_MANUAL`, que ficam fora do rateio.
4. **`CUSTO_PRODUTO`**: soma de `Produto.custoFreteManual × quantidade` de cada item do pedido — só se **todos** os itens tiverem produto vinculado e custo de frete manual cadastrado; qualquer item sem isso faz essa fonte inteira cair para a próxima.
5. **`PADRAO_LOGISTICA`**: regra cadastrada em `RegraFreteLogistica` para a logística do pedido (`FIXO`: valor em centavos; `PERCENTUAL`: fração do faturamento bruto do pedido), gerenciável em Financeiro → Configurações → "Frete por logística". Sem regra cadastrada, `self_service` cai de volta no `ConfiguracaoGeral.custoEnvioFlex` legado (compatibilidade com o Ciclo 8).
6. **`DESCONHECIDO`**: nenhuma das fontes acima resolveu um valor (ou o pedido não tem envio, caso em que o valor é `0`, não desconhecido) — `SEM_FRETE` nas pendências, nunca um zero inventado.

Recalcular vendas afetadas quando uma regra de frete muda (padrão por logística ou custo por produto): reenfileirar o período afetado com `forcar: true` via `POST /api/financeiro/sincronizacao/importar-historico` — a mesma fila da Fase 1 reprocessa cada pedido do zero, respeitando ajustes manuais existentes.

## Retenção de dívidas

Cobranças do pagamento marcadas como retenção (`fee_spl`, ou qualquer cobrança com `metadata.source === "direct-charges"` ou `reserve_id` presente): o Mercado Livre descontando da venda para quitar fatura, Full ou ads de outro período. **Não é custo da venda** — não entra na margem de contribuição nem na DRE como despesa desta venda — mas reduz o valor líquido recebido e aparece na conciliação do caixa.

## Valor líquido a receber

Pagamento disponível: `transaction_details.net_received_amount`, direto do Mercado Pago (já contempla tarifa, frete, retenção e qualquer outro desconto do pagamento). Sem pagamento disponível: `faturamentoBruto − tarifa − frete` (estimativa, `null` se tarifa ou frete forem desconhecidos — nunca um zero inventado).

## Margem de contribuição

`faturamentoBruto − descontoVendedor(0, informativo) − impostoEstimado − tarifaVenda − freteVendedor − adsAtribuido − cmv`. Calculada por item e somada por venda (`dominio/formulas.ts`, `calcularMargemContribuicao`). `null` quando qualquer componente (`tarifa`, `frete`, `cmv`) é desconhecido — nunca parcial.

## CMV (custo da mercadoria vendida)

Congelado no momento da venda (`VendaCanalItem.custoUnitario`): usa `Produto.custoMedio + Produto.custoEmbalagem` (ou o custo do kit, se completo, mais a embalagem do kit) na primeira ingestão e não muda depois, mesmo que o custo do produto mude no cadastro — preserva o custo real daquela venda específica.

## Saldo em conta

Cada `ContaFinanceira` tem um `saldoAtual` calculado (`relatorios/saldoContas.ts`), com a origem sempre visível:
- **Carteira Mercado Pago automática** (`tipo: CARTEIRA_MARKETPLACE`, `automatica: true`, criada uma por conta do Mercado Livre conectada, nome "Mercado Pago — `<apelido>`"): usa o saldo real da API (`saldoAtualExterno`/`saldoALiberarExterno`, sincronizado a cada execução do cron e sob demanda) sempre que a última sincronização teve `confianca: CONFIRMADO`. Sem confirmação ainda (endpoint não testado em produção, ver `fontes-mercado-livre.md`), cai para o cálculo por lançamentos como qualquer outra conta.
- **Demais contas** (banco, caixa, cartão): `saldoInicial + Σ(lançamentos pagos desde a data do saldo inicial até hoje)`. Cartão de crédito nunca entra no total somado (`calcularSaldoTotalAtual`) — representa dívida, não dinheiro disponível.

O "saldo projetado" do fluxo de caixa (`gerarSaldoProjetado`) usa esse saldo atual (não mais o saldo inicial estático) como ponto de partida, somado às liberações futuras de vendas e aos lançamentos previstos no horizonte escolhido.

**Movimentos da carteira** (`canais/mercadoPago/movimentosCarteira.ts`): lista liberações (`VendaCanal.valorLiquidoReceber` onde `statusLiberacao: "released"`) e retenções (`VendaCanal.retencaoDividas`) já confirmadas por venda, mais — quando `ConfiguracaoGeral.usarRelatorioLiberacaoMercadoPago` está ligado — as linhas do relatório de liberação do Mercado Pago (`release_report`, não confirmado contra uma resposta real). Os dois grupos não são somados num único total: não há chave confirmada para deduplicar uma liberação que apareça nos dois, então somar os dois contaria a mesma liberação duas vezes.

## Lucro líquido

`margemContribuicao − despesasOperacionais (todas, não só as rateadas como fixas) ± resultadoFinanceiro − IR/CSLL`. Mesma fórmula em toda tela que mostra "lucro líquido".

## Pagamento do Mercado Pago (detalhe)

Ver `docs/financeiro/fontes-mercado-livre.md`, seção "Ciclo 9", e `canais/mercadoLivre/mapeadorPagamento.ts` para a lógica exata de classificação de cada cobrança (`ehTarifa`/`ehFrete`/`ehRetencaoDeDivida`). Cada cobrança do pagamento é guardada em `CobrancaPagamento` (nunca descartada, mesmo quando o nome não é reconhecido — aparece em `desconhecidos` para revisão manual).

## O que ainda não está unificado (deferido do Ciclo 9, Fase 2)

Esta fase corrigiu os dois bugs que faziam a DRE e o resumo do período divergirem entre si (C1: desconto subtraído duas vezes; C3: janela UTC vs. SP) e trocou a fonte de tarifa/frete por pedido para o pagamento confirmado do Mercado Pago (C4). Um serviço único (`relatorios/consolidado.ts`) servindo DRE, resumo do dia, resumo do período, série diária, lucro por produto, dashboard e ficha do produto — item 2 do prompt original — **não foi construído nesta fase**: é uma reescrita de 6 pontos de consumo, e o restante do ciclo (Fases 3 a 7: frete configurável, saldo real, produtos/anúncios, visão geral completa) ainda precisa do tempo e do orçamento de risco que essa reescrita consumiria. As fórmulas de cada consumidor continuam onde estavam, agora sem as duas divergências medidas em produção; a consolidação completa fica registrada aqui como dívida explícita para um ciclo futuro.

## O que ainda não está completo (deferido do Ciclo 9, Fase 3)

- **Detalhe completo do frete por venda** (item 1 do prompt): hoje a venda guarda o valor final e a origem (`freteOrigem`), mas não o detalhamento (quanto foi custo total do envio, quanto o comprador pagou, quanto o Mercado Livre subsidiou via `discounts[].promoted_amount`). `freteComprador` já existe desde o Ciclo 7/8; o detalhamento do subsídio do ML ficou de fora porque nenhuma tela ainda consome esse dado — construí-lo sem um consumidor seria especular sobre o formato certo.
- **Frete recebido do comprador como receita** (item 3): para logísticas em que o vendedor cobra frete do comprador (ME1, entrega própria), o prompt pede uma linha "Receita de frete" na DRE. Depende do serviço único (item 2 da Fase 2, também deferido) para não duplicar a lógica de composição da DRE em mais um lugar — ficou para quando a consolidação acontecer.
- **Frete de envio ao Full / inbound** (item 4): cadastro de remessas ao Full (data, custo, produtos e quantidades) com rateio por unidade enviada é uma funcionalidade nova de ponta a ponta (modelo, tela de cadastro, rateio, aplicação retroativa), ortogonal a corrigir os cálculos existentes — o maior item de risco/esforço da fase. Adiado para não consumir o orçamento das Fases 4 a 7, que o prompt também exige nesta mesma execução.
- **UI de edição de custo de frete e embalagem por produto**: os campos (`Produto.custoFreteManual`, `Produto.custoEmbalagem`) existem, são lidos pela prioridade 4 do frete e pelo CMV, e têm uma rota dedicada (`PATCH /api/produtos/[id]/custos-frete`) — mas não há tela para editá-los ainda. A rota existente de edição de produto (`PUT /api/produtos`) substitui todos os campos não enviados por `null`, então colar esses dois campos nela sem atualizar o formulário correspondente apagaria silenciosamente qualquer valor já configurado a cada edição de nome/SKU; a rota dedicada evita esse risco até a tela ser construída.

## O que ainda não está completo (deferido do Ciclo 9, Fase 4)

- **Saldo real da API do Mercado Pago**: o endpoint (`/users/{mlUserId}/mercadopago_account/balance`) nunca foi testado contra uma resposta real (ambiente de desenvolvimento não alcança `api.mercadopago.com`) — ver `fontes-mercado-livre.md`. A infraestrutura inteira está pronta (conta automática, sincronização no cron e sob demanda, fallback sem inventar número), só falta confirmar em produção se o endpoint, os nomes de campo e o token da conta ML funcionam como documentado.
- **Conciliação "saldo calculado × saldo da API" com diferença explícita**: o prompt pede comparar o saldo reconstruído a partir dos movimentos com o saldo real e mostrar a diferença como "a conciliar". Sem uma tabela de histórico de saldo (snapshot em cada sincronização), uma reconstrução fiel exigiria somar *todos* os movimentos desde a conexão da conta — custoso e arriscado de ficar errado. Construí a lista de movimentos do período (liberações e retenções confirmadas) lado a lado com o saldo atual da API, mas sem calcular uma "diferença" entre os dois: eles respondem perguntas diferentes (fluxo do período vs. saldo em um instante), e apresentar uma subtração entre eles seria uma conciliação falsa.
- **Classificação de saques e transferências do `release_report`**: o prompt pede que esses movimentos apareçam separados de liberações de venda. O relatório (`lerRelatorioLiberacaoMercadoPago`, Ciclo 7) não tem um campo confirmado para diferenciar "liberação de venda" de "saque"/"transferência" — por isso toda linha dele aparece como `RELATORIO_MP`, sem subdividir, até o payload real do endpoint ser confirmado.
- **Tela dedicada de "Movimentos da carteira"**: a rota (`GET /api/financeiro/contas-financeiras/movimentos-carteira`) e o serviço existem e têm teste; a UI que lista esses movimentos (além do resumo já mostrado em Fluxo de caixa e Visão geral) não foi construída nesta fase.

## Vínculo anúncio↔produto não confirmado (Ciclo 9, Fase 5)

Todo vínculo entre um anúncio do Mercado Livre e um produto local tem uma origem (`ProdutoMercadoLivre.vinculoOrigem`: `SKU_EXATO`, `EAN`, `SIMILARIDADE` ou `MANUAL`) e uma confirmação (`vinculoConfirmado`). Vínculos por SKU exato, EAN ou feitos manualmente nascem confirmados; por **similaridade de título nascem sempre não confirmados**, mesmo com alta confiança de correspondência — exigem revisão humana em Produtos → "Confirme estes vínculos" antes de contar sem ressalva. Uma venda cujo item usa um vínculo não confirmado grava o CMV normalmente (o custo aparece, a margem é calculada), mas entra com a pendência `VINCULO_NAO_CONFIRMADO` — sinaliza que aquele número pode estar vindo de um produto errado, sem impedir o cálculo.

## Comparações e meta mensal (Ciclo 9, Fase 6)

- **Comparação com ontem** vs. **com a semana passada**: dois números diferentes. "Ontem" é o dia de calendário anterior. "Semana passada" é o mesmo dia da semana, exatamente 7 dias atrás (ex.: quinta-feira com quinta-feira) — não confundir com `comparacaoMedia7Dias` (a média dos últimos 7 dias corridos), que é uma terceira métrica, já existente desde ciclos anteriores.
- **Meta de faturamento mensal**: campo opcional (`ConfiguracaoGeral.metaFaturamentoMensal`, em Configurações). `percentualMeta` = faturamento do mês até agora ÷ meta. Sem meta cadastrada, `percentualMeta` é `null` (nunca 0% ou 100% inventado).
- **Projeção de fechamento do mês**: faturamento do mês até agora ÷ dias já transcorridos do mês × dias totais do mês — uma extrapolação simples do ritmo atual, não uma previsão estatística. Sempre calculada (não depende de meta cadastrada).
- **Por logística**: agrupamento de vendas por `VendaCanal.logistica` tal como o canal grava (Full = `fulfillment`, Flex = `self_service`, coleta = `drop_off`), sem reclassificar. Frete médio de um grupo é `null` quando nenhuma venda do grupo tem frete confirmado — nunca um zero que pareça "frete grátis".
