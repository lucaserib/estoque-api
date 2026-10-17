# Auditoria — Ciclo 8: Financeiro busca dados reais

Registro vivo de execução do `PROMPT-CICLO-8-FINANCEIRO-INTEGRACAO.md`, uma seção por fase.

## Fase 0 — Testes que reproduzem o problema real

**Construído:**
- Fixtures reais em `src/modules/financeiro/canais/mercadoLivre/__tests__/fixtures/`: `pedido-comum.json` (1 unidade), `pedido-2-unidades.json`, `pedido-cancelado.json` — ids numéricos como a API devolve de fato.
- `canais/mercadoLivre/esquemas.ts`: esquemas Zod (`pedidoSchema`, `descontosSchema`, `custoEnvioSchema`, `envioSchema`, `pagamentoSchema`) que convertem todo id (`z.union([z.string(), z.number()]).transform(String)`). Ainda não plugados no mapeador — isso é Fase 1.
- `MLOrder.id` em `src/types/mercadolivre.ts` ampliado para `string | number` (refletindo o payload real).
- Testes novos que capturam os bugs do diagnóstico (F1, F5, F6, F7), todos citados no relatório de produção de 17/10/2026:
  - `mapeador.test.ts`: id numérico → `pedidoExternoId`/`envioExternoId` devem virar string (F1); `somarDescontoVendedor` com o formato real `{details:[{items:[{amounts}]}]}` (F5); pedido cancelado com pagamento estornado deve mapear para `CANCELADA` (F6).
  - `formulas.test.ts`: desconto do vendedor não deve ser subtraído de novo da margem/imposto, já que `unit_price` já vem líquido (F5).
  - `sincronizador.test.ts` e `dre.test.ts`: `faturamentoBruto` deve **incluir** a venda depois cancelada, com `cancelamentos` guardando o valor dela à parte — hoje é excluído na origem e subtraído de novo na DRE (F7).

**Resultado ao final da fase:** `tsc`/`lint` limpos; `npm test` com **7 testes vermelhos de propósito** (F5 ×4, F6 ×1, F7 ×2) — são a especificação executável do que a Fase 1 precisa corrigir. F1 já foi corrigido nesta fase (`String(pedido.id)` em `mapeador.ts` e `cliente.ts`) porque ampliar o tipo `MLOrder.id` sem isso quebrava a compilação; o restante do diagnóstico (F2, F5, F6, F7, F8, F9, F12) continua pendente para a Fase 1.

**Pendências explícitas para a Fase 1:** corrigir `somarDescontoVendedor`/`mapearPedido` para o formato real de desconto; `mapearStatus` considerar histórico de pagamentos; `calcularMargemContribuicao` deixar de subtrair `descontoVendedor`; `atualizarResumoDoDia` e `somarVendaCanalDoMes` passarem a incluir vendas canceladas em `faturamentoBruto`; a bateria `obterEnvio`/logística real; liberação via Mercado Pago; `cancelamentoNaCompetencia`/`usarImpostoEstimado`; webhook robusto a erro parcial.

## Fase 1 — Corrigir a ingestão e as fórmulas

**Construído:**
- **F1**: `mapearPedido`/`listarPedidosAlterados` sempre convertem id para string (corrigido já na Fase 0 para manter o build íntegro).
- **F5**: `mapearDescontos` novo em `mapeador.ts`, lendo o formato real (`details[].items[].amounts.{total,seller}`); `somarDescontoVendedor` e `somarDescontoCusteadoPeloMl` reescritos sobre ele. `calcularMargemContribuicao` e o cálculo de imposto (`formulas.ts`) deixaram de subtrair `descontoVendedor` (informativo, já embutido no `unit_price`). `calcularValorLiquidoReceber` (sincronizador) também parou de subtraí-lo. Coluna nova `VendaCanalItem.descontoCusteadoMl`, rateada por item do mesmo jeito que o desconto do vendedor. Na DRE, `descontos` e o novo `descontoCusteadoPeloMl` ficam informativos — `receitaOperacionalBruta` não deduz mais `descontos`.
- **F6**: `mapearStatus` passou a olhar `payments[].status` (`approved`/`refunded`/`partially_refunded`/`charged_back`/`in_mediation` com `transaction_amount > 0`) em vez de `paid_amount` (que zera depois do estorno). Pagamento parcialmente estornado mapeia para `DEVOLVIDA_PARCIAL`. `dataCancelamento` prioriza `cancel_detail.date`, com fallback em `last_updated`.
- **F7**: convenção única aplicada em `atualizarResumoDoDia` e `somarVendaCanalDoMes` — `faturamentoBruto` sempre inclui o valor original da venda (mesmo cancelada depois), `cancelamentos` guarda esse valor à parte; a DRE já fazia `bruto − cancelamentos`, então o bug era só na origem, que excluía a cancelada do bruto e subtraía de novo.
- **F8**: removida a regra "Full = frete 0" — todo envio com `envioExternoId` busca o custo real via `obterCustoEnvio` (exceto Flex, que usa `custoEnvioFlex` configurado). `logistic_type` passou a vir de `GET /shipments/{id}` (`adaptador.obterEnvio`/`mapearEnvio`), resolvido pela ingestão antes do frete — o pedido raramente traz esse campo embutido.
- **F9**: `obterLiberacaoPagamento` novo (Mercado Pago, `GET /v1/payments/{id}`) — usa `money_release_date` e `transaction_details.net_received_amount` quando disponíveis; sem resposta confiável, estima `dataVenda + ConfiguracaoGeral.diasLiberacaoPadrao` (novo campo, default 14) e marca a venda com a pendência informativa `LIBERACAO_ESTIMADA` (não bloqueia `completo`).
- **F12**: `usarImpostoEstimado` agora é lido pela DRE — desligado, `impostosSobreVendas` vem dos lançamentos da categoria do grupo `IMPOSTO_VENDA` em vez da estimativa por alíquota.
- **F2**: `processWebhookEvent` isola `processOrderWebhook` (estoque) em try/catch próprio — erro ali não impede mais `processOrderWebhookFinanceiro` de rodar. Novos tópicos `payments`, `shipments` e `claims` resolvem o pedido relacionado (melhor esforço) e chamam `ingerirPedidoMercadoLivre`.
- Migração `20261017150000_financeiro_ciclo8_fase1`: `VendaCanalItem.descontoCusteadoMl` e `ConfiguracaoGeral.diasLiberacaoPadrao` (ambas `ADD COLUMN IF NOT EXISTS`, aditivas).
- `docs/financeiro/fontes-mercado-livre.md` atualizado com o que foi confirmado em produção (ids numéricos, formato do desconto, `sale_fee` por unidade, cancelamento pós-pagamento, `logistic_type` fora do pedido) e o que ainda não foi confirmado (resolução de pedido a partir de `shipments`/`claims`/`payments` do Mercado Pago nos webhooks).

**Deixado pendente, com motivo:**
- **`cancelamentoNaCompetencia`** (F12): a opção existe na configuração mas nenhum cálculo a lê ainda. Mudar o dia em que um cancelamento é contado (dia da venda × dia do cancelamento) exige recalcular o resumo de dois dias possivelmente distantes a cada ingestão tardia, e a semântica de "o que mostrar no dia da venda enquanto a venda ainda não foi cancelada" não está especificada o suficiente para implementar sem arriscar números de dias passados ficarem inconsistentes. Fica para uma fase futura, com o padrão (`VENDA`, já correto) valendo até lá.
- **Devoluções via claims** (frete de retorno cobrado do vendedor, `VendaCanal.outrosCustos`): o webhook de `claims` já religa ao pedido e reingere, mas a ingestão ainda não busca o claim em si para extrair o custo do frete de devolução — só a Fase 3/4 (ou uma iteração futura) deve fechar isso.
- `DEVOLVIDA_PARCIAL`: classificado corretamente por `mapearStatus`, mas a ingestão ainda trata como venda normal (não zera quantidade nem abate o valor estornado por item) — proporcionar isso corretamente exigiria ratear o `transaction_amount_refunded` por item, não especificado o suficiente para arriscar.

**Resultado ao final da fase:** `tsc`/`lint` limpos; `npm test` com os 505 testes passando (os 7 vermelhos da Fase 0 + 2 testes pré-existentes da DRE que encodavam a convenção antiga foram atualizados para a nova).
