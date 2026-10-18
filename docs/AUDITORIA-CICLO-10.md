# Auditoria — Ciclo 10: fonte única, sincronização que termina e estoque que chega

Feito direto no código (não por prompt), depois da reclamação: "a Conferência vê o Mercado Livre, mas o app não busca; faturamento, lucro e estoque não batem".

## O que estava errado em produção (18/10/2026, conta LEAPSTORE)

| Medida | Mercado Livre | Leap Stock antes |
|---|---|---|
| Outubro (1 a 18) | 164 pedidos, 193 unidades, R$ 5.618,36, 6 cancelados | 56 pedidos, 65 unidades, R$ 2.094,90 (34% de cobertura) |
| Setembro | 115 pedidos, 134 unidades, R$ 3.431,41, 10 cancelados | 1 pedido (0,9%) |
| Estoque local | — | 0 em todos os 36 produtos (sincronização do Bling nunca terminou; só 6 produtos com `blingId`) |
| Estoque Full | 361 unidades disponíveis nos anúncios | 0 na reposição e no dashboard (anúncios sincronizados pela última vez em 10/10, sem `mlLogisticType`) |

### Causas
1. **A importação de pedidos nunca alcançava o mês atual.** O backfill automático começava 365 dias atrás e andava dia a dia, gravando pedido a pedido com 4 a 6 chamadas à API cada. Só avançava 8 s por consulta de status, com a tela aberta.
2. **"Corrigir" na Conferência estourava o tempo.** Ela reprocessava os 108 pedidos faltantes um por um, com todas as chamadas, numa requisição de 60 s.
3. **A data da venda era a de fechamento** (`date_closed`), e não a de criação, que é o critério do ML e da própria Conferência. Pedidos perto da meia-noite caíam no dia ou no mês errado.
4. **Cinco fórmulas diferentes.** Resumo, DRE, dashboard, produto e logística calculavam cada um por conta própria. A margem da DRE incluía a receita de vendas sem custo com CMV zero; a do resumo, não. O "lucro líquido" era a margem menos um rateio de despesa fixa. O dashboard principal subtraía o desconto de campanha da receita. Os lançamentos cancelados entravam na DRE.
5. **A fatura do ML** era lida com campos inventados e paginação errada: 572 linhas com valor zero e id vazio.
6. **O saldo do Mercado Pago** dependia de uma API que responde 403 para o token do ML. A carteira nunca era criada.
7. **O sync de anúncios lia só os primeiros 50** de 55 anúncios, era manual e não gravava o estoque Full no armazém. O sync de produtos e estoque do Bling rodava num cron sem cursor nem orçamento de tempo e nunca terminava, e por isso não marcava a conclusão.
8. Na tela, o waterfall subtraía descontos, aparecia "meta batida" sem meta cadastrada, percentuais como +1.059% sobre uma venda, a logística com o nome cru (`fulfillment`), links para páginas inexistentes (`/financeiro/vendas/{id}`) e "Lucro estimado" igual à margem.

## O que foi feito

### Financeiro — sincronização (`src/modules/financeiro/ingestao/`)
- `lote.ts`: a etapa rápida grava em lote os pedidos que o `/orders/search` já devolve completos, sem chamada extra. Pula o pedido que não mudou; com `forcar`, regrava.
- `enriquecimento.ts`: a etapa de detalhe busca o pagamento do Mercado Pago (tarifa, frete, retenção, líquido, liberação) e a logística, 4 vendas por vez, das mais recentes para as mais antigas. Desiste de uma venda depois de 5 falhas e grava o motivo (`enriquecimentoErro`).
- `fila.ts` reescrita:
  - o período vai do mês mais recente para o mais antigo, uma página de 50 pedidos por vez, com cursor `{inicioJanela, offset}`;
  - o incremental usa `date_last_updated` desde a última sincronização menos 2 h;
  - uma execução por conta (`MercadoLivreAccount.financeiroProcessandoAte`);
  - o tempo que sobra vai para o detalhamento.
- `statusSincronizacao.ts`: o status não processa nada, só informa (tarefa, mês sendo importado, vendas aguardando detalhe, webhooks). `VERSAO_DADOS_FINANCEIROS = 10` faz o app reimportar 400 dias uma única vez, com `forcar`.
- Rotas: `POST /api/financeiro/sincronizacao/processar` (45 s); `POST /sincronizacao` e `/importar-historico` enfileiram e processam.
- `SincronizacaoFinanceiraProvider` (layout do Financeiro): enquanto houver pendência, chama `/processar` em sequência; as telas recarregam sozinhas (`useAoAtualizarDados`).
- Conferência: `corrigirMes` busca o mês uma vez e grava em lote o que falta ou diverge. Compara também data e tarifa e lista os pedidos "sobrando" (gravados no mês errado).
- Cron diário: corrige o mês atual e o anterior, roda o incremental, lê a fatura dos dois meses e processa a fila.
- `mlFetch`: tempo limite de 15 s por chamada e espera máxima de 5 s em 429.

### Financeiro — cálculo (`src/modules/financeiro/relatorios/motor.ts`)
- `calcularVenda`, `calcularIndicadores` e `agruparVendas`: as definições estão em `docs/financeiro/definicoes.md`. DRE, resumo do dia e do período, série diária, por logística, lucro por produto, lista e detalhe de vendas e o dashboard principal usam só o motor. O `ResumoFinanceiroDiario` deixou de ser lido e escrito.
- Modo de faturamento (Configurações): `PRODUTOS` (igual ao ML), `PRODUTOS_E_FRETE_COMPRADOR` e `PRODUTOS_MENOS_FRETE`. A margem é igual nos três.
- Ponto de equilíbrio sem despesas → "Cadastre as despesas fixas". A projeção do mês usa os dias transcorridos de verdade. Variação percentual só sobre base relevante.
- Fatura do ML: mapeador no formato documentado (`charge_info.detail_id/detail_amount/detail_sub_type/concept_type`, `sales_info`, `items_info`), paginação por `offset` até `total`, BILL + CREDIT_NOTE, `/group/ML/details` + `/group/ML/full/details`. As linhas antigas quebradas são apagadas na reingestão.
- Saldo: a carteira "Mercado Pago — <apelido>" é criada sozinha. Saldo = último saldo informado + líquido das vendas liberadas + lançamentos pagos; "a liberar" = liberações futuras das vendas válidas. Fluxo de caixa ganhou "Informar saldo".
- Diagnóstico ADMIN `?tipo=bruto&caminho=...` (somente GET, com prefixos permitidos e dados pessoais removidos) para confirmar payloads reais de fatura, ads e saldo.

### Catálogo e estoque (`src/modules/catalogo/`)
- `anunciosMl.ts`: uma única `sincronizarAnuncioMl` (preço por `sale_price`, estoque, status, logística, tarifa e frete estimados, estoque Full), usada pelo catálogo, pelo botão de sincronizar e pelo webhook `items`. `listarIdsAnunciosMl` pagina todos os anúncios (scan acima de 1.000). `atualizarEstoqueFullDosAnuncios` grava o Full no armazém `FULL_ML`.
- `sincronizacao.ts`: etapas retomáveis com cursor (produtos do Bling → saldo do Bling por depósito, 50 por chamada → anúncios do ML → estoque Full). Estado em `SincronizacaoCatalogo`. Uma etapa com erro não bloqueia as outras.
- `garantirArmazensParaDepositos` vincula o depósito do Bling ao armazém local existente (mesmo nome, ou o único local quando o depósito é o padrão), em vez de criar um armazém duplicado.
- Rotas: `GET/POST /api/catalogo/sincronizacao` e o cron `/api/cron/catalogo-diario` (06:45 UTC). O cron `bling-sync` ficou só com webhooks e contas financeiras.
- `SincronizacaoCatalogo` (componente) em Produtos, Dashboard e Reposição: roda sozinho se a última atualização tiver mais de 6 h; "Atualizar estoque agora" força.

### Telas
- **Visão geral:** pontos de atenção reais, faturamento com variação, indicadores sem redundância, "Do faturamento ao lucro" em tabela com % e a seção Caixa.
- **DRE:** coluna Total, % sobre a receita bruta, linhas zeradas escondidas e avisos de qualidade.
- **Vendas:** busca por pedido, produto ou SKU; colunas de tarifa, frete, custo e margem; detalhe com as cobranças do pagamento e o ajuste de frete.
- **Conferência:** "Corrigir o mês".
- **Configurações:** escolha do modo de faturamento.
- **Fluxo de caixa:** "Informar saldo".

## Verificação
- `tsc`, `next lint` e `next build` sem erros; `vitest`: 622 testes passando, com testes novos do motor, do lote, do detalhamento, da fila, da conferência, da fatura, do saldo, do status e do catálogo.
- Depois do deploy, conferir em produção (passo a passo em `PROMPT-DEFINITIVO-LEAP-STOCK.md`, Parte 3).
