# Financeiro — definições (fonte única)

Todas as telas (Visão geral, DRE, Vendas, Produtos, Por logística, Conferência e o dashboard principal) calculam pelo mesmo código: `src/modules/financeiro/relatorios/motor.ts`. Se um número diverge entre duas telas, o erro está nos dados de entrada, não numa fórmula paralela, porque não existe fórmula paralela.

## Em que dia uma venda cai
- Pela **data de criação do pedido** (`date_created`) no fuso **America/Sao_Paulo**. É o mesmo critério do painel de vendas do Mercado Livre e da Conferência.
- Os períodos vão sempre do início do primeiro dia ao fim do último dia em SP e incluem o dia de hoje.

## Status
- **Válida**: `PAGA`, `DEVOLVIDA_PARCIAL`, `EM_MEDIACAO`.
- **Cancelada**: `CANCELADA` e `DEVOLVIDA`. O valor dela vai para "Cancelamentos e devoluções", fora do faturamento.
- **Devolução parcial**: continua válida; só o valor estornado (`transaction_amount_refunded`) sai do faturamento.

## Linhas
| Linha | Regra |
|---|---|
| Vendas brutas | Σ preço × quantidade de todos os pedidos (inclusive cancelados) |
| Cancelamentos e devoluções | valor dos cancelados + estornos parciais |
| **Faturamento** | vendas brutas − cancelamentos. **É o número que bate com o Mercado Livre.** |
| Frete no faturamento | depende do modo (abaixo) |
| Receita bruta | faturamento ± frete no faturamento + outras receitas lançadas |
| Impostos | alíquota atual × faturamento, recalculado sempre (ou os lançamentos de imposto, se a conta não usa a estimativa) |
| Tarifas | tarifa de venda + taxa de processamento do Mercado Pago + parcelamento, lidas do pagamento de cada venda (`charges_details`). Antes do detalhe chegar, vale o `sale_fee` do pedido. |
| Frete | frete cobrado de você em cada venda (`shp_*` no pagamento; senão o custo do envio; senão o frete do produto; senão a regra da logística; ou o ajuste manual) |
| Publicidade | gasto diário de ads quando existir; senão a cobrança PADS da fatura. Nunca os dois. |
| Fatura do ML | cobranças da fatura sem venda associada (armazenagem e serviços do Full, fretes de devolução, outras) |
| CMV | custo unitário congelado na venda × quantidade |
| **Margem de contribuição** | receita líquida − tarifas − frete − publicidade − fatura do ML − CMV |
| Despesas operacionais | lançamentos de despesa do grupo DESPESA_OPERACIONAL com competência no período, sem os cancelados |
| **Lucro líquido** | margem − despesas operacionais ± resultado financeiro ± não operacional − IR/CSLL (fora do Simples) |
| Ticket médio | receita bruta ÷ pedidos válidos |
| % | sempre sobre a receita bruta |

**Informativo (não entra na conta):**
- Desconto de campanha: o preço do pedido já vem com o desconto.
- Retenção para quitar a fatura (`fee_spl`): o ML desconta da venda para pagar dívidas da conta. Afeta o caixa, não a margem da venda.

## Modo de faturamento (Configurações → Como calcular o faturamento)
| Modo | Faturamento | Frete como custo |
|---|---|---|
| `PRODUTOS` (padrão, igual ao ML) | produtos | frete do vendedor |
| `PRODUTOS_E_FRETE_COMPRADOR` | produtos + frete pago pelo comprador | frete do vendedor + frete do comprador |
| `PRODUTOS_MENOS_FRETE` | produtos − frete do vendedor | — (já descontado) |

A margem e o lucro são os mesmos nos três modos. Só muda onde o frete aparece.

## Qualidade dos dados
- **Sem custo**: a venda entra com CMV zero e é contada em "vendas sem custo" (com o faturamento afetado). Margem e lucro aparecem acima do real até o custo ser cadastrado.
- **Aguardando detalhes**: a venda já foi gravada pela etapa rápida (pedido) e ainda não recebeu o pagamento do Mercado Pago. A tarifa vem do `sale_fee` e o frete de uma regra ou do valor confirmado anterior. Os valores reais chegam sozinhos.

## Sincronização
1. **Etapa rápida (lote)**: `/orders/search` devolve o pedido completo; o app grava 50 pedidos por chamada, sem chamadas extras. Faturamento, pedidos, unidades e tarifa ficam certos em segundos.
2. **Detalhamento**: para cada venda nova ou alterada, busca o pagamento no Mercado Pago (tarifa, frete, retenção, líquido, liberação) e a logística do envio. Vai das vendas mais recentes para as mais antigas, 4 por vez, e desiste de uma venda depois de 5 falhas (com o motivo gravado).
3. **Fila** (`TarefaSincronizacaoFinanceira`): importação por período (do mês mais recente para o mais antigo, cursor por página), incremental (pedidos alterados desde a última sincronização), fatura do ML e ads. Uma execução por conta por vez (`MercadoLivreAccount.financeiroProcessandoAte`).
4. **Quem move a fila**: as telas do Financeiro (chamam `/api/financeiro/sincronizacao/processar` enquanto houver pendência), o botão "Atualizar dados", os webhooks (`orders_v2` detalha a venda na hora) e o cron diário (corrige o mês atual e o anterior contra o ML).
5. **Reimportação automática**: quando a regra de gravação muda, `VERSAO_DADOS_FINANCEIROS` sobe e o app reimporta 400 dias uma única vez.

## Saldo
- A API de saldo do Mercado Pago responde 403 para o token do Mercado Livre. O saldo da carteira é calculado: último saldo informado ("Informar saldo" em Fluxo de caixa) + líquido das vendas liberadas desde então + lançamentos pagos na conta.
- "A liberar" = líquido das vendas válidas com liberação futura.
