# Leap Stock — Prompt definitivo (plano mestre do produto)

Documento autocontido para o Claude Code executar no repositório `estoque-api` (Next.js 15, Prisma, Postgres, Vercel). Ele substitui os prompts de ciclo anteriores como referência única do que o software tem de ser. Leia inteiro antes de começar, siga as Partes **na ordem** e não desfaça nada da Parte 2.

**Ao final de cada fase:** `npx tsc --noEmit`, `npx next lint`, `npm test` e `npx next build` limpos; commit em português descrevendo o que mudou e por quê; uma seção nova em `docs/AUDITORIA-CICLO-11.md` com "Construído / Pendente com motivo / Números conferidos". No fim, `git push origin master`.

---

## Parte 1 — O que o produto é e as regras que não se quebram

O Leap Stock é o painel de gestão de um seller do Mercado Livre que usa o Bling como ERP. Ele precisa responder com números que batem com o ML e o Bling:
1. **Quanto vendi e quanto sobrou**: faturamento, margem e lucro por dia, mês, produto e logística.
2. **Onde está meu estoque**: depósito local (Bling) e Full (ML); o que está a caminho (pedidos de compra) e o que está parado.
3. **O que preciso comprar e quando**: reposição pela venda real, prazo do fornecedor e estoque Full.
4. **Como está meu caixa**: saldo do Mercado Pago, o que vai liberar, contas a pagar e a receber.

**Regras invioláveis**
- **Uma fórmula, um lugar.** Todo número do Financeiro sai de `src/modules/financeiro/relatorios/motor.ts` (`calcularVenda`, `calcularIndicadores`, `agruparVendas`). Nenhuma rota ou tela calcula faturamento, margem ou lucro por conta própria. Se um número novo for preciso, ele entra no motor e ganha teste. As definições estão em `docs/financeiro/definicoes.md`; mantenha esse arquivo atualizado a cada mudança.
- **A data de uma venda é a de criação do pedido**, no fuso America/Sao_Paulo (`src/modules/financeiro/dominio/periodo.ts`). Nunca use `date_closed` nem os limites em UTC.
- **Faturamento = preço × quantidade dos pedidos não cancelados.** Desconto de campanha é informativo. A retenção `fee_spl` afeta o caixa, nunca a margem.
- **Dinheiro em centavos (`Int`).** Converter só na borda da UI (`formatBRL`). Nunca mostrar float cru (ex.: `232490.00000000003`).
- **Escopo por `user.contaId`** em toda consulta de negócio.
- **Nada de número inventado**: o que falta aparece como "—" com o motivo (sem custo, aguardando detalhe, sem vínculo).
- **Integrações sempre retomáveis**: toda leitura em massa de API externa tem cursor persistido, orçamento de tempo (≤ 45 s por requisição na Vercel) e trava por conta. Nunca um loop único que pode passar de 60 s.
- **Telas leem snapshots do banco.** Chamadas à API do ML ou do Bling ficam nas sincronizações, nunca no carregamento de uma tela comum. A exceção é a Conferência, que existe justamente para isso.
- Migrações aditivas e idempotentes (`IF NOT EXISTS`); componentes de UI existentes; textos em português claro; responsivo nos dois temas; sem comentários de narração no código.

---

## Parte 2 — Base já construída (Ciclo 10): preservar

Leia `docs/AUDITORIA-CICLO-10.md`. Resumo do que existe e não deve ser reescrito:

| Peça | Onde | Papel |
|---|---|---|
| Motor de cálculo | `modules/financeiro/relatorios/motor.ts` | fonte única do Financeiro e do dashboard |
| Ingestão em lote | `modules/financeiro/ingestao/lote.ts` | grava pedidos do `/orders/search` sem chamadas extras |
| Detalhamento | `modules/financeiro/ingestao/enriquecimento.ts` | pagamento do MP (tarifa, frete, retenção, líquido, liberação) |
| Fila financeira | `modules/financeiro/ingestao/fila.ts` | período (mês recente → antigo), incremental, fatura, ads; trava por conta |
| Status e reimportação | `modules/financeiro/ingestao/statusSincronizacao.ts` | `VERSAO_DADOS_FINANCEIROS` reimporta uma vez quando a regra muda |
| Provedor de sincronização | `app/(root)/financeiro/components/SincronizacaoFinanceira.tsx` | chama `/processar` enquanto houver pendência e recarrega as telas |
| Conferência | `modules/financeiro/relatorios/conferencia.ts` + tela | ML × app pedido a pedido; "Corrigir o mês" em lote |
| Fatura do ML | `canais/mercadoLivre/mapeadorCobrancas.ts` | formato `charge_info`/`sales_info`, offset, BILL + CREDIT_NOTE, Full |
| Saldo | `relatorios/saldoContas.ts` | carteira MP = saldo informado + liberado + lançamentos |
| Catálogo e estoque | `modules/catalogo/{anunciosMl,sincronizacao}.ts` | Bling produtos → Bling estoque → anúncios ML → estoque Full, retomável |
| Diagnóstico | `GET /api/financeiro/diagnostico/mercado-livre?tipo=bruto&caminho=...` | payload real da API (ADMIN, só GET, sem dado pessoal) |

---

## Parte 3 — Verificação em produção logo após o deploy (obrigatória, antes de qualquer fase nova)

Use o navegador logado como ADMIN e as rotas abaixo. Registre os números em `docs/AUDITORIA-CICLO-11.md`.

1. **Importação concluída**: abra o Financeiro e acompanhe a faixa de progresso até "Dados em dia". `GET /api/financeiro/sincronizacao/status` deve terminar com `pendente: false` e `vendasComFalhaDeDetalhe` baixo. Para cada venda com falha, leia `enriquecimentoErro` e corrija a causa.
2. **Conferência**: outubro e setembro de 2026 com "O mês bate com o Mercado Livre". O alvo medido em 18/10:
   - outubro: 158 pedidos válidos de 164, 193 unidades, faturamento R$ 5.618,36;
   - setembro: 105 válidos de 115, R$ 3.431,41;
   - cada mês anterior com venda também tem de bater.
   Se não bater, a causa vai para a auditoria e é corrigida no mapeador ou na ingestão, nunca maquiando o total.
3. **Venda de referência**: pedido 2000019043297364 (R$ 34,70) com tarifa R$ 2,99, frete R$ 6,85, retenção R$ 12,14 (fora da margem), líquido R$ 12,72 e liberação em 16/11.
4. **Mesma venda, mesmo número**: em Vendas, DRE, Visão geral, dashboard principal e Produtos, os totais do mês são idênticos. Escreva um teste de integração que garanta isso, se ainda faltar algum caminho.
5. **Fatura do ML**: `?tipo=bruto&caminho=/billing/integration/periods/key/2026-09-01/group/ML/details?document_type=BILL%26limit=5` → confira os campos reais contra `mapeadorCobrancas.ts` e ajuste o que divergir (nomes, sinal de bônus, sub-tipos). Depois, reprocesse a fatura de setembro e outubro. "Cobranças não mapeadas" deve ficar perto de zero, e a soma por tipo deve bater com o resumo `/billing/integration/periods/key/{key}/summary/details`.
6. **Ads**: descubra o endpoint certo de Product Ads com o diagnóstico bruto (anunciante: `/advertising/advertisers?product_id=PADS` com `Api-Version: 1`; métricas diárias por campanha e anúncio). Implemente `listarGastosAds` com o payload real. Sem acesso, a tela diz "Ads pela fatura (PADS)" e usa a fatura, sem contar duas vezes.
7. **Estoque**: em Produtos, "Atualizar estoque agora" até "Estoque e anúncios atualizados".
   - os produtos ligados ao Bling mostram o saldo local do depósito;
   - os anúncios Full mostram o estoque disponível (`/inventories/{id}/stock/fulfillment`; confira o payload real pelo diagnóstico bruto e ajuste `getFulfillmentStock`);
   - a reposição e o dashboard deixam de mostrar "sem estoque" em produto que tem Full.
8. **Saldo**: em Fluxo de caixa, "Informar saldo" com o valor do app do Mercado Pago. No dia seguinte, o saldo calculado tem de bater com o app, a menos de saques ou pagamentos não lançados (registre-os como lançamentos na conta).

---

## Parte 4 — Fases do produto completo

### Fase 1 — Catálogo, vínculos e cadastro (base de tudo)
1. **SKU do anúncio**: gravar o `seller_sku` (atributo `SELLER_SKU` ou `seller_custom_field`) em `ProdutoMercadoLivre.mlSellerSku` dentro de `sincronizarAnuncioMl`. A tela "Confirme estes vínculos" passa a listar também os vínculos em que o SKU do anúncio é diferente do SKU do produto (caso conhecido: MLB4019629019, SKU `KITADAPPRE`, ligado a `KITADAPUSB`). Ação de trocar o vínculo em um clique.
2. **Kits**: confirmar que a venda de um kit baixa os componentes na reposição e que o CMV do kit é a soma dos componentes. Kit com componente sem custo fica `null` e aparece como pendência.
3. **Pendências de cadastro em massa** (hoje: 35 sem fornecedor, 19 sem custo, 25 sem preço, 8 sem EAN, 8 sem vínculo ML): uma tela única "Completar cadastro", com filtro por pendência e edição em linha de custo, fornecedor principal e preço; importação por planilha (já existe `importar-custos`); e "aplicar este custo às vendas sem custo desde DD/MM", que reprocessa as vendas pelo lote com `forcar`.
4. **Imagens**: um script/rota ADMIN que regrava no Vercel Blob todas as `imagemUrl` assinadas do S3 do Bling (`X-Amz-*`, `Expires=`) já salvas, porque elas expiram.
5. **Webhooks**:
   - **ML**: a tela Integrações mostra o último webhook por tópico (`orders_v2`, `items`, `shipments`, `payments`, `claims`). O webhook `orders_v2` detalha a venda na hora (já faz) e o `items` chama `sincronizarAnuncioMl` (já faz).
   - **Bling**: hoje chegam 0 em 24 h. Diagnostique a configuração (URL, eventos de produto e estoque, assinatura HMAC), mostre na tela e reprocesse o pendente.
6. Remover as rotas duplicadas de produto e ML que ficaram sem chamador (`grep` antes de cada remoção): `produtos-simple`, `produtos-inteligente`, `produtos-dinamicos`, `analytics/sales-*`. A tela `/mercado-livre/produtos` deve ler `salesData` de `VendaCanal` (motor), e não recalcular vendas pela API com float.

### Fase 2 — Estoque e reposição confiáveis
1. **Demanda pela fonte única**: `reposicaoService` passa a ler as vendas de `VendaCanal`, já sincronizadas, em vez de buscar 90 dias de pedidos no ML a cada cálculo. A janela é configurável (30, 60 ou 90 dias), com peso maior para os últimos 30.
2. **Estoque Full**: disponível, em trânsito (`transfer`, `inbound`) e indisponível separados na reposição e na ficha do produto. Cobertura em dias pelo Full e pelo local separadamente, e sugestão de "enviar ao Full" quando o local tiver e o Full estiver acabando.
3. **Ponto de pedido**: estoque de segurança, prazo do fornecedor e dias de liberação do Full. Mostrar a data provável de ruptura e o valor a comprar.
4. **Capital parado**: produtos sem venda há mais de 60 ou 90 dias, com o valor pelo custo.
5. **Movimentações**: toda mudança de estoque tem origem (Bling, Full, saída manual, pedido de compra, transferência). Tela de histórico por produto e alerta de divergência quando o Bling e o app discordam.

### Fase 3 — Compras e contas a pagar
1. Pedido de compra → ao confirmar o recebimento: entra no estoque, recalcula o custo médio e gera a conta a pagar (já existe; validar ponta a ponta com teste).
2. Pedido de compra gerado pela reposição, agrupado por fornecedor, com o multiplicador da caixa.
3. **Remessas ao Full**: cadastro de envio (data, custo do frete ou coleta, itens e quantidades); o custo é rateado por unidade e entra no custo das vendas Full desses itens. Integrar com a fatura (coleta Full `CFCB`) para não contar duas vezes.

### Fase 4 — Financeiro de gestão
1. **Despesas fixas e recorrentes**: tela simples (aluguel, pessoal, software…) gerando lançamentos por competência; o ponto de equilíbrio e o lucro líquido passam a fazer sentido.
2. **Cartão e contas**: conciliação de fatura de cartão e extrato bancário por importação OFX/CSV.
3. **Bling contas a pagar/receber** (já existe a leitura): mostrar no fluxo de caixa sem duplicar lançamentos.
4. **Metas e alertas**: meta mensal, alerta de venda com prejuízo, de margem do produto abaixo do mínimo e de ruptura em X dias, por notificação e por e-mail opcional.
5. **Exportações**: DRE, vendas e produtos em Excel e PDF com os mesmos números do motor.

### Fase 5 — Dashboard principal e saúde dos dados
1. O dashboard principal (`/dashboard`) mostra hoje e o período: faturamento, margem e lucro (motor), estoque local e Full, ruptura, capital parado, caixa e pendências. Todo número tem link para a tela de detalhe.
2. Uma página **Saúde dos dados** juntando tudo:
   - financeiro: cobertura da Conferência, vendas sem detalhe e sem custo;
   - catálogo: último sync do Bling, do ML e do Full, anúncios com erro;
   - webhooks por tópico, tarefas com erro e fatura não mapeada.
   Cada item com a ação que resolve.
3. Formatação única: moeda, percentual, datas no fuso de SP, nomes de logística (Full, Flex, Coleta…) e de status em português. Nenhum enum cru na tela.

### Fase 6 — Segurança, permissões e operação
1. `VER_CUSTO` e `FINANCEIRO_*` checados no servidor em todas as rotas que devolvem custo, margem ou financeiro.
2. Papel configurável de acesso ao financeiro para além do ADMIN.
3. Logs estruturados com `contaId` e etapa em toda sincronização; Sentry nas rotas de cron.
4. Limites de taxa respeitados (Bling 3 req/s; ML com backoff) e tempo limite em toda chamada externa (`mlFetch`).

### Fase 7 — Testes de aceitação
- Fixtures reais (sem dados pessoais) de pedido, pagamento, envio, fatura e estoque Full em `src/modules/**/__tests__/fixtures`.
- Testes de ponta a ponta do motor: o mesmo mês dá o mesmo número em todas as telas.
- Teste de retomada de cada sincronização (financeira e catálogo) com "timeout" no meio.
- Checklist final na auditoria com os números da Parte 3 conferidos de novo.

---

## Parte 5 — Passos manuais do Lucas (fora do código)
1. App do Mercado Livre → Notificações: URL `https://estoque-api-4iqj.vercel.app/api/mercadolivre/webhook` com os tópicos `orders_v2`, `items`, `shipments`, `payments` e `claims`.
2. Bling → configurações de webhook: URL `/api/bling/webhook` com os eventos de produto e estoque.
3. Financeiro → Fluxo de caixa → "Informar saldo" com o saldo atual do Mercado Pago.
4. Financeiro → Configurações: alíquota de imposto, modo de faturamento, regras de frete por logística (Flex ou entrega própria) e despesas fixas.
5. Produtos → "Completar cadastro": custo e fornecedor dos produtos pendentes.
