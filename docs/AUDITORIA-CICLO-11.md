# Auditoria — Ciclo 11: execução de PROMPT-DEFINITIVO-LEAP-STOCK.md

Registro vivo de execução das Partes 3 e 4 do plano mestre (`PROMPT-DEFINITIVO-LEAP-STOCK.md`, raiz do projeto). A Parte 2 (base do Ciclo 10) foi conferida e preservada — nenhuma reescrita.

## Parte 3 — Verificação em produção

A maior parte desta parte pede para abrir o navegador logado como ADMIN em produção e comparar números com o app do Mercado Livre — nenhum passo assim pôde ser executado nesta sessão (sem acesso a produção nem à internet pública; `api.mercadolibre.com`/`api.mercadopago.com` seguem bloqueados neste ambiente de desenvolvimento, como documentado desde o Ciclo 6). Separado por item:

**Confirmado por leitura de código (sem precisar de produção):**
- **Item 1 (importação concluída)**: `statusSincronizacao.ts` já expõe `pendente`, `vendasAguardandoDetalhes` e `vendasComFalhaDeDetalhe` exatamente como o item descreve; `enriquecimentoErro` já é gravado por venda (Ciclo 10). Nada a corrigir no código — só a conferência visual em produção.
- **Item 5 (fatura do ML)**: `mapeadorCobrancas.ts` já está no formato documentado (`charge_info`/`sales_info`/`items_info`, paginação por offset, BILL + CREDIT_NOTE) — confirmado por leitura, não é a versão antiga sem teste. Reprocessar setembro/outubro em produção e comparar com `/summary/details` é uma ação operacional (botão "Corrigir o mês" na Conferência), não uma mudança de código.
- **Item 6 (Ads)**: corrigido — o endpoint de anunciante usava `Api-Version: 2`; o prompt confirma que o certo é `Api-Version: 1` (`canais/mercadoLivre/cliente.ts`, `listarGastosAds`). O endpoint de métricas diárias por campanha/anúncio não veio com detalhe suficiente no prompt para confirmar o payload — continua como está, com o fallback já existente para o PADS da fatura (`motor.ts`'s `origemAds`, nunca soma os dois).
- **Item 7 (estoque Full)**: `getFulfillmentStock` já implementado contra `/inventories/{id}/stock/fulfillment`, já grava disponível/em trânsito/indisponível separados em `ProdutoMercadoLivre`. Confirmar o payload real e que a reposição não mostra "sem estoque" com Full disponível depende de rodar "Atualizar estoque agora" em produção.
- **Item 8 (saldo)**: "Informar saldo" já está implementado e com UI (Fluxo de caixa), confirmado por leitura (`ajustarSaldoConta`, rota `contas-financeiras/[id]/ajustar-saldo`). Bater com o app do MP no dia seguinte é uma conferência manual.

**Construído nesta sessão:**
- **Item 4 (mesma venda, mesmo número)**: novo teste de integração em `motorRelatorios.test.ts` que isola o pedido de referência (2000019043297364) sozinho no mês e confirma a mesma margem de contribuição e o mesmo faturamento em `gerarDre`, `gerarResumoPeriodo` (o caminho que o dashboard principal usa, confirmado por leitura de `api/dashboard/resumo/route.ts`), `gerarLucroPorProduto` e `listarVendasComLucro` — os cinco lugares citados no item (Vendas, DRE, Visão geral, dashboard, Produtos) ficam cobertos por um único teste determinístico, sem depender de produção.

**Deixado como checklist manual (itens 2, 3, 7 parcial, 8 parcial) — só o Lucas pode confirmar:**
- [ ] Conferência de outubro (158/164 pedidos válidos, 193 unidades, R$ 5.618,36) e setembro (105/115, R$ 3.431,41) com "O mês bate com o Mercado Livre".
- [ ] Pedido 2000019043297364: tarifa R$ 2,99, frete R$ 6,85, retenção R$ 12,14, líquido R$ 12,72, liberação 16/11 — já é exatamente o fixture usado nos testes do motor; confirmar que o valor real do pedido em produção bate com o que o fixture assume.
- [ ] Depósito local do Bling aparecendo no saldo do produto; anúncios Full mostrando estoque disponível; reposição e dashboard sem "sem estoque" falso.
- [ ] Saldo do Mercado Pago batendo com o app oficial no dia seguinte ao "Informar saldo".

## Parte 4 — Fases do produto completo