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

## Fase 2 — Sincronização automática, retomável e visível

**Construído:**
- **F4 (erro por pedido)**: tabela nova `SincronizacaoFinanceiraErro` (`userId, canal, pedidoExternoId, etapa, mensagem, tentativas, ultimoErroEm, resolvidoEm`). `continuarBackfill` e `reprocessarUltimosDias` passaram a isolar cada pedido num try/catch próprio (`ingerirPedidoComRegistroDeErro`) — um pedido com erro não derruba mais o lote nem marca a sincronização inteira como `ERRO`; o erro fica registrado e é tentado de novo (até 5 tentativas, `TENTATIVAS_MAXIMAS_ERRO`) pela próxima chamada, via `reprocessarErrosPendentes`.
- **F4 (orçamento de tempo)**: `continuarBackfill` trocou o limite por quantidade (`LOTE_MAXIMO_POR_CHAMADA`) por um orçamento de tempo (`FINANCEIRO_TEMPO_MAXIMO_LOTE_MS`, default 40s), e passou a salvar o cursor **a cada página** (não só ao final da chamada) — um timeout da função não repete mais a mesma página para sempre.
- **Incremental de verdade**: `MercadoLivreAccount.ultimaSincronizacaoFinanceiraEm` (novo campo) grava quando `reprocessarUltimosDias` termina. A próxima chamada busca `desde = últimaSincronização − 2h` em vez de uma janela fixa de 3 dias, sem perder nada entre execuções; sem sincronização anterior, cai no padrão de 3 dias.
- **Orquestrador único** (`ingestao/orquestrador.ts`, `sincronizarFinanceiro(contaId, {modo, desde, ate})`): por modo (`INCREMENTAL`/`PERIODO`/`BACKFILL`) chama a sincronização de pedidos certa, depois ads do dia e cobranças de cada mês do período afetado. `obterTravaAtiva` consulta `SincronizacaoFinanceira` com `status=EM_ANDAMENTO` iniciada há menos de 10 minutos — trava por conta para dois cliques (ou duas abas) não rodarem juntos.
- Rotas novas: `POST /api/financeiro/sincronizacao` (`{accountId?, modo, desde?, ate?}`, só `FINANCEIRO_EDITAR`, respeita a trava) e `GET /api/financeiro/sincronizacao/status` (`FINANCEIRO_VER`: sincronização em andamento, última concluída, erros pendentes). `maxDuration = 60` nessas rotas e em `importar-historico`.
- Cron diário (`financeiro-diario`) passou a continuar um backfill já `EM_ANDAMENTO` (nunca inicia um novo sozinho — isso é gatilho de UI, Fase 5) e a chamar `reprocessarErrosPendentes` para cada conta ativa, além do que já fazia.

**Deixado pendente, com motivo:**
- O cron **não foi migrado** para chamar `sincronizarFinanceiro` (o orquestrador) em vez das funções individuais que já chamava — são exatamente as mesmas chamadas por baixo, e reescrever a rota trocaria uma bateria de testes já sólida por uma reescrita sem ganho de comportamento. O orquestrador está pronto para quando as telas da Fase 5 (que sim precisam dele, para o botão “Atualizar”) forem construídas.
- **Início automático do backfill ao abrir a tela** (barra de progresso "Importando suas vendas…") e o **painel "Saúde dos dados"**: são UI (Fase 5) — a Fase 2 deixou a base pronta (status via `GET /sincronizacao/status`, erros pendentes contáveis, trava por conta), mas não construiu nenhuma tela ainda.
- Notas de crédito e paginação `from_id`/`sort_by=ID` de cobranças (Fase 3) não foram tocadas nesta fase.

**Resultado ao final da fase:** `tsc`/`lint` limpos; `npm test` com 528 testes passando (23 novos: isolamento de erro por pedido, orquestrador, rotas de sincronização, cron).

## Fase 3 — Ads, cobranças e diagnóstico ampliado

**Construído:**
- **Diagnóstico ampliado**: `GET /api/financeiro/diagnostico/mercado-livre?tipo=envio&id=`, `?tipo=pagamento&id=`, `?tipo=claims&pedido=`, `?tipo=ads&dia=`, `?tipo=cobrancas&mes=` (ADMIN, sem dado pessoal). `envio` devolve bruto e mapeado lado a lado (`mapearEnvio`); `pagamento` e `claims` devolvem o bruto (sem mapeador ainda — ver pendências); `ads`/`cobrancas` devolvem a lista já normalizada pelo adaptador (não há "bruto" para uma lista, só para um registro único).
- **F10 (paginação de cobranças)**: `cliente.ts` passou a usar `sort_by=ID&order_by=ASC&from_id=<último id da página anterior>` em vez de `paging.next_from_id` (que a API não devolve) — antes só a primeira página de até 1000 itens era lida. Também passou a ler `CREDIT_NOTE` além de `BILL`.
- **F11/Fase3 item2 (ads)**: `PADS` mapeado para `PUBLICIDADE` em `mapeadorCobrancas.ts`. Na DRE, `custosVariaveis.publicidade` usa o dado diário (`GastoAdsCanal`) quando ele existe naquele mês; sem nenhum dado diário, cai para a cobrança `PADS` do mês — nunca soma os dois.

**Deixado pendente, com motivo:**
- **Mapeador de `claims`/`pagamento`**: o diagnóstico já expõe o bruto desses dois tipos para inspeção manual em produção, mas nenhum normalizador foi escrito ainda — os nomes de campo (`resource`/`resource_id` em claims, estrutura de `money_release_date`/`transaction_details` em pagamento) continuam só descritos em `docs/financeiro/fontes-mercado-livre.md` como não confirmados. Confirmar com o diagnóstico em produção antes de escrever o mapeador é o próprio objetivo desta fase.
- **Tipos `CV`/`CXD`** de cobrança (citados no diagnóstico de produção): sem confirmação do que representam, continuam caindo em `NAO_MAPEADO` (correto — o valor não é descartado, só não é categorizado) em vez de ganhar um mapeamento adivinhado.
- Conciliação mensal recalculada pelo botão "Atualizar" da DRE: UI, fica para a Fase 5.

**Resultado ao final da fase:** `tsc`/`lint` limpos; `npm test` com 537 testes passando.

## Fase 4 — Fontes do sistema e do ERP

**Construído:**
- **Conta a pagar automática**: ao confirmar um `PedidoCompra` (`PUT /api/pedidos-compra`), se `ConfiguracaoGeral.gerarContaAPagarAoConfirmarCompra` estiver ligado (default `true`), gera a conta a pagar `PREVISTO` automaticamente (`gerarContaAPagarDePedidoCompra`, já idempotente por `chaveExterna` desde o Ciclo 7) com vencimento `dataConclusao + prazoPagamentoPadraoDias` (novo campo, default 30 dias). Isolado em try/catch — uma falha aqui não derruba a confirmação do pedido nem o update de estoque. `scripts/backfill-contas-a-pagar-pedidos-compra.ts` cobre os pedidos confirmados nos últimos 90 dias que já existiam antes desta fase (rodar manualmente uma vez após o deploy — ver checklist da Fase 6).
- **Bling — contas a pagar e a receber**: `BlingService.getContasPagar`/`getContasReceber`/`getCategoriasReceitasDespesas` (reaproveitam `requestJson`, o limitador de 3 req/s e o header `enable-jwt` já existentes). `canais/erp/bling/contasFinanceiras.ts` grava cada conta como `LancamentoFinanceiro` (`origem: ERP`, `chaveExterna: bling:pagar:<id>` / `bling:receber:<id>`), casando fornecedor por `Fornecedor.blingContatoId` e categoria por `MapeamentoCategoriaBling` (nova tabela; sem mapeamento, cai em "Outras"). Liga/desliga por `ConfiguracaoGeral.blingContasAtivo` (default `false`). Rodando a cada execução do cron `bling-sync`, por conta Bling ativa, isolado em try/catch.
- Configurações do financeiro (`GET`/`PATCH /api/financeiro/configuracoes`) passaram a expor `diasLiberacaoPadrao`, `gerarContaAPagarAoConfirmarCompra`, `prazoPagamentoPadraoDias` e `blingContasAtivo` (campos que já existiam no banco desde as Fases 1 e 4, mas não tinham API) — pronto para a tela de Configurações da Fase 5 ler/escrever.

**Deixado pendente, com motivo:**
- **Pedidos de venda de outros canais via Bling** (item 3 do prompt): não implementado. Exigiria um adaptador `AdaptadorCanalFinanceiro` novo (`canal: CanalVenda.ERP`) e uma regra confiável para não duplicar vendas do Mercado Livre já ingeridas direto — o campo `VendaCanalNormalizada.origemReal` já existe para isso desde o Ciclo 7, mas sem nenhum pedido real do Bling para confirmar o formato, implementar agora arriscaria duplicar ou perder vendas de verdade. Ver `docs/financeiro/fontes-bling.md`.
- **Tela de mapeamento de categorias do Bling**: a tabela (`MapeamentoCategoriaBling`) e a leitura já existem; só falta a UI para o usuário criar os mapeamentos (Fase 5).
- **CMV confiável — reprocessar vendas quando o custo for preenchido depois**: não implementado nesta fase. O custo de um produto é alterado em pelo menos 5 rotas diferentes (`produtos/[id]`, `importar-custos`, `bulk-assign`, confirmação de compra, etc.); hookar um reprocessamento em cada uma sem nenhum teste de regressão nessas rotas tinha risco maior que o benefício dentro do tempo desta fase. O link "N vendas sem custo" na tela (Fase 5) já é possível sem isso — só não reprocessa automaticamente o que já foi gravado como incompleto.
- Tipo de retorno `situacao` do Bling (código numérico) não é usado para decidir `PAGO`/`PREVISTO` — ver `fontes-bling.md`.

**Resultado ao final da fase:** `tsc`/`lint` limpos; `npm test` com 545 testes passando.
