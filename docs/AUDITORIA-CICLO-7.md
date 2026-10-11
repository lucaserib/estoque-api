# Auditoria — Ciclo 7 (Módulo Financeiro)

Documento de referência do ciclo. Atualizado ao final de cada fase.

## Fase 0 — Linha de base e verificação dos dados do Mercado Livre

### Checks (10/10/2026)

- `npx tsc --noEmit`: limpo.
- `npx next lint`: limpo.
- `npm test`: 19 arquivos, 127 testes, todos passando (linha de base antes desta fase).

### Restrição do ambiente

Idêntica à registrada em todo o Ciclo 6: este ambiente não tem `DATABASE_URL` (nenhuma migração pode ser testada contra um banco real) e não alcança `api.mercadolibre.com` (bloqueado por `PolicyAgent` do próprio ML). Toda verificação contra dados reais do Mercado Livre fica pendente para produção — é exatamente o que a rota de diagnóstico desta fase existe para viabilizar.

### O que foi feito

1. **Leitura do código a reaproveitar**: `src/lib/mlOrders.ts` (`fetchAllOrders`/`fetchOrdersWithFallback`, paginação e filtro de data já prontos), `src/services/mercadoLivreService.ts` (`getValidToken`/`refreshWithLock` com trava distribuída, `getOrder`, `processOrderWebhook` — ponto exato onde a Fase 3 vai pendurar a ingestão financeira), `src/lib/mlFetch.ts` (backoff com `Retry-After`), `src/lib/margem.ts` e `src/lib/custo.ts` (`resolverCustoProduto`, `calcularCustoKit` — fonte do CMV), `src/lib/pendencias.ts`, `src/services/reposicaoService.ts`, `src/app/api/dashboard/resumo/route.ts`, `ConfiguracaoGeral.aliquotaImposto` (Ciclo 6 Fase 5/9), `src/lib/permissoes.ts` (matriz de papéis), crons existentes (`bling-refresh`, `bling-sync`, `cadastro-incompleto`, `ml-webhook-retry` — todos no padrão `CRON_SECRET` que o cron financeiro da Fase 8 vai seguir).
2. **`GET /api/financeiro/diagnostico/mercado-livre?pedido=<id>`** (`src/app/api/financeiro/diagnostico/mercado-livre/route.ts`): só `ADMIN` (mesmo padrão de `usuarios/route.ts`, checagem direta de `role`, não a matriz de `permissoes.ts` — é um diagnóstico técnico, não uma permissão de produto). Busca `GET /orders/{id}`, `GET /orders/{id}/discounts` e, quando o pedido tem `shipping.id`, `GET /shipments/{id}/costs`; extrai `payments` do próprio objeto do pedido (a API do ML já embute isso, segundo a documentação — **não confirmado contra um pedido real**). `removerCamposSensiveis` tira recursivamente `buyer`, e-mail, nome, telefone, endereço, cartão e documento de qualquer nível da resposta antes de devolver — nenhum token sai do backend em nenhum momento (usado só para montar o header `Authorization`). 4 testes (`__tests__/route.test.ts`): 403 para quem não é ADMIN, 400 sem `pedido`, sanitização de dado pessoal confirmada campo a campo, e o caso de pedido sem `shipping.id` (sinaliza erro em `custosEnvio` sem quebrar a resposta).
3. **`docs/financeiro/fontes-mercado-livre.md`**: tabela de cada campo usado, endpoint, caminho na resposta e nível de confiança — a maioria marcada "Pendente de confirmação real" de propósito, porque é exatamente isso que ainda não foi verificado. Lista as 5 perguntas abertas mais importantes para quem rodar o diagnóstico em produção, na ordem de risco para a fórmula da DRE (a mais crítica: `sale_fee` é por unidade ou por linha).
4. **Escopo decidido para "escreva os mapeadores" do item 3 do documento**: os mapeadores de verdade (`canais/mercadoLivre/`, tipos `*Normalizada`) ficam para a Fase 3, que já está explicitamente no roteiro para isso, com testes de fixture também explícitos no item 4 daquela fase. Fazer isso duas vezes (uma versão preliminar agora, outra "de verdade" na Fase 3) seria retrabalho sem necessidade — a Fase 0 entrega o diagnóstico (para gerar os fixtures reais) e a documentação das perguntas abertas; a Fase 3 entrega o mapeador que responde essas perguntas com testes.

### O que ficou pendente desta fase

- Nenhuma das 5 perguntas abertas em `fontes-mercado-livre.md` foi respondida com dado real — todas dependem de rodar o diagnóstico em produção contra pedidos reais (um comum, um Full, um com desconto) antes da Fase 3 travar os mapeadores.
- `payments` sendo extraído direto de `order.payments` (sem chamada separada a `/payments/{id}`) é uma suposição baseada em documentação, não confirmada.

### Checks ao final da fase

- `npx tsc --noEmit`: limpo.
- `npx next lint`: limpo.
- `npm test`: 20 arquivos, 131 testes, todos passando (4 novos desta fase).

## Fase 1 — Modelo de dados, plano de contas e permissões

### O que foi feito

1. **`prisma/schema.prisma`**: 12 enums novos (`CanalVenda`, `StatusVendaCanal`, `GrupoDre`, `TipoLancamento`, `StatusLancamento`, `OrigemLancamento`, `Confianca`, `TipoContaFinanceira`, `FrequenciaRecorrencia`, `RegimeTributario`, `CancelamentoCompetencia`, `RateioCustoFixo`) e 11 modelos novos (`VendaCanal`, `VendaCanalItem`, `CategoriaFinanceira`, `ContaFinanceira`, `LancamentoFinanceiro`, `RecorrenciaFinanceira`, `FaturaCartao`, `GastoAdsCanal`, `CobrancaCanal`, `ResumoFinanceiroDiario`, `SincronizacaoFinanceira`), todos com `userId` (dono da conta, mesmo padrão do Ciclo 6 Fase 4) e `@@map` para tabela em snake_case. `ConfiguracaoGeral` ganhou `regimeTributario`, `cancelamentoNaCompetencia`, `rateioCustoFixo`, `custoEnvioFlex`, `usarImpostoEstimado`.
2. **Migração** (`prisma/migrations/20261010120000_financeiro_fase1_modelo/migration.sql`): escrita à mão (sem shadow DB neste ambiente). Antes de nomear qualquer enum/tabela/índice, conferi por `grep` contra **todas** as migrações anteriores — lição direta do incidente P3018 do Ciclo 6 (índice duplicado que quebrou o build). Toda constraint usa `DROP CONSTRAINT IF EXISTS` antes de recriar, todo índice usa `IF NOT EXISTS`, toda tabela usa `CREATE TABLE IF NOT EXISTS`. Conferido também que nenhum identificador passa de 63 bytes (limite do Postgres) — um nome de índice precisou ser encurtado manualmente.
3. **Seed do plano de contas** (`src/modules/financeiro/lancamentos/planoContasPadrao.ts`): as 20 categorias padrão da especificação, cada uma com o `grupoDre` correspondente à estrutura da DRE descrita no prompt. Idempotente via `findMany` (quais já existem) + `createMany` com `skipDuplicates: true` (trava mesmo em corrida). Todas marcadas `sistema=true` (não podem ser apagadas, só desativadas — regra para a tela de configurações da Fase 7). Ainda não é chamada por nenhuma rota: a aba Financeiro (que a chamaria no primeiro acesso) só existe a partir da Fase 7; a função está pronta e testada para quando essa rota existir.
4. **Permissões**: `FINANCEIRO_VER`/`FINANCEIRO_EDITAR` adicionadas à `MATRIZ` em `src/lib/permissoes.ts` (ADMIN: SIM/SIM; COMPRAS/ESTOQUE/VENDAS/LEITURA: NAO — COMPRAS fica como candidato mais provável a ganhar acesso configurável depois, não há tela para isso ainda). `src/modules/financeiro/permissoes.ts` criado como o ponto de import que os módulos do financeiro vão usar (`podeVerFinanceiro`/`podeEditarFinanceiro`/`exigirVisualizacaoFinanceiro`/`exigirEdicaoFinanceira`), por trás apenas delegando para `src/lib/permissoes.ts` — sem duplicar a matriz.
5. **Sidebar**: item "Financeiro" (`src/app/components/layout/Sidebar.tsx`) só aparece para quem `podeVer(papel, "FINANCEIRO_VER")`. Aponta para `/financeiro`, que ainda não existe (chega na Fase 7) — sem risco de link morto em produção porque o push final só acontece depois de todas as fases.
6. **Testes** (`src/modules/financeiro/lancamentos/__tests__/planoContasPadrao.test.ts`, 4 casos): cria as 20 categorias na primeira chamada; não duplica ao rodar duas vezes; isola corretamente entre duas contas diferentes; mesmo nome em contas diferentes não conta como duplicata.

### O que ficou pendente desta fase

- A chamada real do seed (no primeiro acesso à aba) só entra na Fase 7, junto com a própria aba.
- "COMPRAS configurável" (texto da spec) não ganhou tela de configuração — é só o valor padrão `NAO` na matriz por enquanto; se for necessário tornar isso configurável por conta, é uma decisão de produto para avaliar quando a Fase 7 estiver pronta.

### Checks ao final da fase

- `npx tsc --noEmit`: limpo.
- `npx next lint`: limpo.
- `npm test`: 21 arquivos, 135 testes, todos passando (4 novos desta fase).

## Fase 2 — Núcleo do domínio (funções puras, 100% testadas)

### O que foi feito

1. **`dominio/dinheiro.ts`**: `somar` (soma simples, só para ter um único lugar canônico), `ratear` (método do maior resto — divide um total em centavos proporcional a pesos sem nunca perder ou sobrar centavo; funciona com total negativo, cai para divisão igual quando todos os pesos são zero, e lança erro só no caso realmente impossível de pedir para dividir um total diferente de zero entre zero destinatários), `formatar` (centavos → "R$ 1.234,56" via `Intl.NumberFormat("pt-BR")`). Pegadinha registrada em comentário: o `Intl` usa espaço não separável (U+00A0) entre "R$" e o número, não espaço comum — os testes normalizam isso antes de comparar.
2. **`dominio/periodo.ts`**: início/fim de dia, semana (segunda a domingo) e mês, e `competenciaDe`, todos calculados de verdade no fuso de América/São_Paulo via `Intl.DateTimeFormat` (não fixa "-03:00" no código — continua correto se algum dia o Brasil voltar a ter horário de verão). Testado explicitamente o caso do enunciado da regra 4 do prompt: 23h50 em Brasília pertence ao dia anterior em UTC, e a competência de um instante próximo da virada do mês respeita o calendário de SP, não o de UTC.
3. **`dominio/formulas.ts`**: `calcularResultadoVenda(venda, itens, contexto)`, `ratearCustoVendaPorItem`, `calcularMargemContribuicao`, `calcularPontoEquilibrio`, `ratearCustoFixoPorProduto` (métodos FATURAMENTO/UNIDADE/NENHUM, usando `ConfiguracaoGeral.rateioCustoFixo`). Decisão de design registrada: a função não recebe `status` da venda — cancelamento/devolução não são um "modo especial" da fórmula, são só números diferentes (quantidade líquida, tarifa, frete, custo) que a camada de ingestão (Fase 3) resolve antes de chamar o domínio. Isso também significa que uma tarifa não reembolsada numa venda cancelada aparece como perda de verdade, em vez de ser escondida por um zeramento automático — mais fiel à regra "nenhum número inventado".
4. **`src/lib/margem.ts` passou a delegar para o domínio**: `calcularMargemUnitaria` agora chama `calcularMargemContribuicao` por dentro, em vez de repetir a subtração. Comportamento externo idêntico (mesma assinatura, mesmo resultado) — confirmado pela suíte de testes já existente (`src/lib/__tests__/margem.test.ts`, Ciclo 6), que não precisou de nenhuma alteração e continua passando.
5. **Testes** (`dominio/__tests__/{dinheiro,periodo,formulas}.test.ts`, 45 casos novos): os nove cenários pedidos no prompt — kit, 2 itens com frete único (rateio), cancelada, devolução parcial, produto sem custo, Flex, Full, item abaixo da taxa fixa, desconto custeado pelo ML × pelo vendedor — mais `calcularPontoEquilibrio` e `ratearCustoFixoPorProduto` nos três métodos.

### O que ficou pendente desta fase

- Nenhuma. A Fase 2 é só domínio puro; a ligação com dados reais (Prisma, API do ML) começa na Fase 3.

### Checks ao final da fase

- `npx tsc --noEmit`: limpo.
- `npx next lint`: limpo.
- `npm test`: 24 arquivos, 180 testes, todos passando (45 novos desta fase).

## Fase 3 — Adaptador Mercado Livre e ingestão de vendas

### O que foi feito

1. **`canais/tipos.ts`**: interface `AdaptadorCanalFinanceiro` e os tipos `*Normalizada` exatamente como descritos no prompt, com um desvio registrado: `obterPedido` devolve `VendaCanalNormalizada | null` (não só `VendaCanalNormalizada`) — `null` é o pedido ainda não ser financeiramente relevante (ver decisão 2 abaixo). Também ganhou `origemReal?` opcional, usado pela deduplicação entre canais (item 3).
2. **`canais/mercadoLivre/mapeador.ts` + `cliente.ts`**: mapeador puro (testável com fixtures, sem rede) e o cliente HTTP que implementa a interface usando `fetchMlWithBackoff` (`mlFetch`) e `MercadoLivreService.getValidToken`/`getOrder` (reaproveitados, não duplicados). Decisões de mapeamento, todas registradas em `docs/financeiro/fontes-mercado-livre.md`:
   - **Regime de competência real**: só pedidos com `status=paid` (→ `PAGA`) ou `cancelled` com algum pagamento aprovado (→ `CANCELADA`/`DEVOLVIDA`) entram no financeiro. Status transitórios (`confirmed`, `payment_required`, `payment_in_process`, `partially_paid`) ainda não viram linha nenhuma — `obterPedido` devolve `null` e a ingestão não cria nada, tentando de novo no próximo reprocessamento.
   - **`CANCELADA` × `DEVOLVIDA`**: via `order_request.return` (presença = devolução). Não confirmado contra pedido real — pergunta nova (6ª) em `fontes-mercado-livre.md`. As duas zeram a venda da mesma forma na margem, então o número financeiro não erra mesmo se a categorização dessas duas estiver trocada.
   - **`sale_fee` por unidade**: mantida a mesma convenção já usada em `sales-complete` e `dashboard/resumo` (× quantidade), para não introduzir uma segunda regra divergente enquanto a Fase 0 não confirma qual é a certa.
   - **Desconto do pedido**: `/orders/{id}/discounts` tratado como objeto único OU lista (soma a parte `seller` de cada entrada) — os dois formatos aparecem em exemplos da documentação.
   - **Custo do envio**: `senders[0].cost` menos `compensations[].amount` OU `compensation` (testa os dois formatos).
3. **`ingestao/sincronizador.ts`** — o núcleo da fase:
   - **Decisão de modelagem (não estava no prompt, resolvida durante a implementação)**: `VendaCanal.faturamentoBruto` grava sempre o valor **original** do pedido (preço × quantidade pedida), não importa o status — é o "quanto essa venda valia". Já a **margem de contribuição** usa quantidade **zerada** para `CANCELADA`/`DEVOLVIDA` (ver `dominio/formulas.ts`, Fase 2: a fórmula não conhece status, só recebe a quantidade que a ingestão decide passar). Isso permite `ResumoFinanceiroDiario.cancelamentos` somar o valor original perdido (linha própria da DRE, "Cancelamentos e devoluções") sem exigir um segundo campo no schema.
   - **Custo congelado**: ao reingerir um pedido já existente, o `custoUnitario` de cada item só é recalculado se estiver `null` — nunca sobrescreve um valor já gravado, mesmo que `Produto.custoMedio` tenha mudado depois. Testado explicitamente (reprocessar com custo do produto alterado preserva o valor antigo).
   - **Vínculo**: `ProdutoMercadoLivre` (por `mlItemId` + conta) primeiro, SKU normalizado (`normalizeSku`, já existente) depois. Sem nenhum dos dois: `produtoId: null`, pendência `SEM_VINCULO`, venda marcada incompleta — a venda entra mesmo assim, como pede o prompt.
   - **Frete por tipo de logística**: `fulfillment` (Full) → 0 (custo vem da cobrança mensal, Fase 4); `self_service` (Flex) → `ConfiguracaoGeral.custoEnvioFlex` (ou `null`/pendência `SEM_FRETE` se ainda não configurado, nunca 0 inventado); os demais → `obterCustoEnvio` de verdade.
   - **Pacote (carrinho) com frete único**: quando o pedido tem `pacoteExternoId`, o custo do envio (um só, para o pacote inteiro) é rateado entre todos os pedidos do mesmo pacote já conhecidos (`VendaCanal` com o mesmo `pacoteExternoId`), proporcional ao faturamento de cada um — reaproveitando `ratear`/`ratearCustoVendaPorItem` do domínio. Isso **reescreve o frete de pedidos-irmãos já ingeridos** quando um novo irmão chega (testado: ingerir A sozinho dá 100% do frete pra ele; ingerir B depois reparte entre os dois e atualiza A). Limite reconhecido: se os irmãos de um pacote nunca gerarem webhook próprio e nunca aparecerem na mesma janela de backfill/reprocessamento, o rateio fica incompleto — não há como descobrir os pedidos-irmãos sem consultar pelo menos um deles.
   - **Backfill retomável** (`continuarBackfill`): cursor em `SincronizacaoFinanceira` (`{desde, ate, offset}`), processa até 10 pedidos por chamada (cabe no tempo de uma função da Vercel) e devolve `EM_ANDAMENTO`/`CONCLUIDO` — a tela (Fase 7) chama de novo enquanto não concluir. 90 dias por padrão, até 365 configurável.
   - **Incremental**: `ingerirPedidoMercadoLivre(accountId, pedidoExternoId)`, chamada pelo webhook (item 4) e pelo reprocessamento diário.
   - **Reprocessamento**: `reprocessarUltimosDias` busca por `order.date_last_updated` dos últimos 3 dias e reingere cada um — pega cancelamento, devolução e custo de frete que chegam depois da venda original.
   - **`ResumoFinanceiroDiario`**: recalculado (não incrementado) a cada ingestão que afeta um dia, direto da soma dos `VendaCanal` daquele dia — simples e sempre consistente, sem acúmulo de erro de arredondamento.
4. **Deduplicação entre canais** (`ingestao/deduplicacao.ts`): `resolverOrigemCanonica`/`chaveCanonica` — mecanismo genérico testado (origem declarada por um canal-espelho vence a origem do próprio candidato), **sem** uso real ainda porque não há adaptador de ERP/Bling para pedidos neste ciclo. `VendaCanalNormalizada.origemReal` é o gancho para quando existir.
5. **Webhook incremental**: `MercadoLivreService.processWebhookEvent` (`case "orders"/"orders_v2"`) passa a chamar também `processOrderWebhookFinanceiro` (novo método privado, import dinâmico para não acoplar o service grande ao módulo financeiro em tempo de carregamento) — erro aí nunca derruba o processamento de estoque/notificações que já existia, só loga. Como a rota do webhook já chama `processWebhookEvent` dentro de `after()`, a ingestão financeira automaticamente não atrasa a resposta 200 — não foi preciso adicionar um `after()` próprio.
6. **Cron `api/cron/financeiro-diario`** (novo, registrado em `vercel.json` às 9h): reprocessa os últimos 3 dias de cada conta ML ativa, mesmo padrão `CRON_SECRET` dos crons existentes. Única rota de cron do financeiro de propósito — fases futuras (ads, cobranças, recorrências, snapshot, alertas) se somam aqui em vez de criar rotas novas, porque o plano Hobby da Vercel só roda cron 1x/dia por rota.
7. **`POST /api/financeiro/sincronizacao/importar-historico`**: dispara/continua o backfill de uma conta ML ativa da conta logada, atrás de `FINANCEIRO_EDITAR`. É só o backend — o botão com barra de progresso é Fase 7.
8. **Testes** (46 novos): mapeador com fixtures (pago, pacote com `pack_id`, cancelado, devolvido, Full — os 5 cenários pedidos), ingestão (vínculo nas duas formas, custo congelado nos dois sentidos, Flex sem custo configurado, Full sem chamar `obterCustoEnvio`, pacote reescrevendo o irmão, resumo diário separando cancelamento do faturamento válido), backfill (cria/retoma cursor, conclui), reprocessamento, deduplicação, e a emenda no webhook do `MercadoLivreService`.

### O que ficou pendente desta fase

- As 6 perguntas abertas em `docs/financeiro/fontes-mercado-livre.md` continuam sem confirmação real (nenhuma mudou nesta fase, uma nova foi adicionada: `order_request.return`), dependendo do diagnóstico da Fase 0 rodado em produção.
- `DEVOLVIDA_PARCIAL` e `EM_MEDIACAO` não são detectados automaticamente — o schema e o domínio suportam os dois, mas o mapeador não tem (ainda) um sinal confiável do ML para preenchê-los sem arriscar inventar dado. Fica para quando houver evidência real (diagnóstico) ou uma necessidade concreta de tratar isso manualmente.
- Rateio de pacote depende de pelo menos um pedido do pacote passar pela ingestão para os outros serem descobertos — não há chamada à API do ML que liste "todos os pedidos de um pack_id".

### Checks ao final da fase

- `npx tsc --noEmit`: limpo.
- `npx next lint`: limpo.
- `npm test`: 30 arquivos, 226 testes, todos passando (46 novos desta fase).

## Fase 4 — Publicidade, cobranças do ML e liberações

### Aviso de confiança

Diferente das Fases 0–3 (pedidos, descontos, frete — APIs centrais e estáveis do ML, já usadas desde o Ciclo 6), **Product Ads e Billing são a parte de menor confiança de todo o Ciclo 7**: nem os caminhos de URL foram confirmados contra uma conta real, só a documentação pública. Isso está registrado explicitamente em `docs/financeiro/fontes-mercado-livre.md` (nova seção) e todo o código é escrito para falhar graciosamente — qualquer endpoint errado vira lista vazia (log de erro, sem derrubar o cron), nunca um número inventado.

### O que foi feito

1. **Product Ads** (`canais/mercadoLivre/mapeadorAds.ts` + `listarGastosAds` em `cliente.ts`): busca o anunciante (`/advertising/advertisers`) e as métricas do dia (`/advertising/product_ads/ads`), grava em `GastoAdsCanal`, vincula ao produto pelo anúncio (reaproveitando o mesmo vínculo de vendas, extraído para `ingestao/vinculo.ts`). Rateio (`ingestao/ingestaoAds.ts`): recalculado do zero a cada ingestão do dia (nunca incrementado — reprocessar dá o mesmo resultado), cada anúncio rateia seu próprio custo só entre os itens dele no dia; um pedido com itens de anúncios diferentes recebe a soma de cada parte. Ads sem venda no dia não some: `GastoAdsCanal` é a fonte de verdade do total em `ResumoFinanceiroDiario.ads` (não mais a soma de `VendaCanal.adsAtribuido`), e a parte não alocada a nenhuma venda ainda reduz a margem do dia.
2. **Cobranças mensais** (`mapeadorCobrancas.ts` + `listarCobrancas`, paginado por `from_id`): grava em `CobrancaCanal` com `tipoNormalizado` (mapa fixo; qualquer código fora do mapa cai em `NAO_MAPEADO`, valor preservado, nada descartado). `coberturaPedido=true` para `TARIFA_VENDA`/`FRETE` (já aparecem no pedido, essa cobrança serve só para conciliação); as demais entram na DRE direto pela cobrança. **Não implementado**: notas de crédito (pedido explícito do prompt) — sem confiança nem no endpoint principal de billing, não arrisquei um segundo endpoint sem nenhuma base; fica como pendência explícita.
3. **Conciliação** (`relatorios/conciliacao.ts`): relatório mensal "Pedidos × Fatura" para `TARIFA_VENDA` e `FRETE` (os dois tipos que existem nos dois lados), diferença absoluta e percentual, alerta acima de 1%. Botão de ajuste (`gerarLancamentoAjusteConciliacao`) cria um `LancamentoFinanceiro` com `origem=CONCILIACAO`, `tipo=DESPESA` (fatura maior que o registrado) ou `RECEITA` (fatura menor), idempotente por `chaveExterna` (clicar de novo depois que a fatura mudar atualiza o mesmo lançamento). Resolve a categoria pelo nome do plano de contas padrão, chamando `seedPlanoContasPadrao` antes como garantia (Fase 1), já que o botão pode ser o primeiro contato da conta com o financeiro.
4. **Liberações do Mercado Pago** (`canais/mercadoPago/liberacoes.ts`): `ConfiguracaoGeral.usarRelatorioLiberacaoMercadoPago` novo (migração `20261011090000_financeiro_fase4_ads_cobrancas`, default `false`). Com a flag desligada, não chama a API nenhuma vez. Ligada, lê `/v1/account/release_report` da API do **Mercado Pago** (host diferente de `api.mercadolibre.com` — nem se o token do ML funciona lá foi confirmado) e devolve a lista normalizada **só para conferência manual** (Fase 7) — não alimenta nenhuma fórmula, não é persistido, não entra na DRE.
5. **Cron `financeiro-diario` estendido**: além do reprocessamento de 3 dias (Fase 3), agora também ingere os ads de ontem e a cobrança do mês corrente para cada conta, cada etapa com seu próprio try/catch (erro em ads de uma conta não impede a cobrança da mesma conta nem o processamento das outras contas).
6. **Rotas novas**: `GET /api/financeiro/conciliacao` (FINANCEIRO_VER), `POST /api/financeiro/conciliacao/ajuste` (FINANCEIRO_EDITAR), `GET /api/financeiro/liberacoes` (FINANCEIRO_VER, devolve `habilitado=false` sem chamar nada se a flag estiver desligada).
7. **Testes** (37 novos): mapeadores de ads/cobranças com fixtures, ingestão de ads (vínculo, idempotência, rateio simples, ads sem venda, item de dois anúncios diferentes na mesma venda, venda cancelada), ingestão de cobranças (idempotência, não mapeadas, capacidade ausente), conciliação (alerta, divisão por zero, DESPESA × RECEITA, idempotência do ajuste), liberações do Mercado Pago (flag desligada não chama a API, falha da API não quebra), cron estendido.

### O que ficou pendente desta fase

- Nenhum dos endpoints novos (Ads, Billing, release_report do MP) foi confirmado contra uma conta real — todos dependem do diagnóstico em produção, com risco maior que o das Fases 0–3 porque nem o caminho da URL é garantido.
- Notas de crédito da fatura mensal não são lidas.
- `DEVOLVIDA_PARCIAL`/`EM_MEDIACAO` continuam sem detecção automática (mesma pendência da Fase 3).

### Checks ao final da fase

- `npx tsc --noEmit`: limpo.
- `npx next lint`: limpo.
- `npm test`: 39 arquivos, 263 testes, todos passando (37 novos desta fase).

## Fase 5 — Lançamentos: custos fixos, únicos, cartão e compras

### O que foi feito

1. **`dominio/dinheiro.ts`**: nova função `dividirEmParcelas` (resto de centavos todo na última parcela, diferente de `ratear` que distribui pelo maior resto — é assim que parcelamento aparece numa fatura de verdade). **`dominio/periodo.ts`**: nova função `somarMeses` (aritmética de calendário em UTC puro, não no fuso de SP — "todo dia 10" é conceito de calendário, não de instante — com piso no fim do mês mais curto).
2. **Categoria nova no plano de contas** (`lancamentos/planoContasPadrao.ts`): "Compra de mercadoria (estoque)" (grupoDre `CMV`, mas nunca somada na DRE — ver decisão abaixo), adicionada à lista original da Fase 1 porque o item 6 desta fase cita essa categoria por nome sem ela ter entrado no seed original. Testes de contagem da Fase 1 atualizados (21 categorias, não mais 20).
3. **CRUD de lançamentos** (`lancamentos/servico.ts`): criar (PREVISTO ou já PAGO se vier com data de pagamento), listar com filtros (período por vencimento, status, categoria, conta, fornecedor, origem, tipo), atualizar, excluir, e três ações em lote — marcar como pago, alterar categoria, excluir previstos (**só previstos**: excluir um lançamento já pago em lote seria fácil demais de apertar por engano, não está no pedido original mas é uma salvaguarda de bom senso). "Custo único" não ganhou código próprio — é só `criarLancamento` com `origem=MANUAL`, não precisa de mais nada.
4. **Recorrência** (`lancamentos/recorrencias.ts`): gerador de lançamentos PREVISTO para os próximos 3 meses **cheios** (mês atual + 2, não "hoje + 90 dias corridos" — um corte por dia faria o cron gerar 2, 3 ou 4 meses dependendo só de que dia ele rodasse, o que não faz sentido para "próximos 3 meses"). Nunca gera para trás: se `inicio` é antigo, a janela começa no mês atual, não lá no passado. Idempotente por `geradoAte` (nunca reconsidera datas já cobertas) e por `chaveExterna` (trava mesmo se `geradoAte` for perdido). Editar pergunta "só daqui pra frente" (`aplicarAosPrevistos=false`, só a recorrência muda, os já gerados ficam como estavam) ou "também os previstos" (`true`, atualiza os PREVISTO já gerados, nunca os PAGO).
5. **Parcelamento** (`lancamentos/parcelamento.ts`): `criarCompraParcelada` gera N lançamentos com `grupoParcelamentoId` comum, valores via `dividirEmParcelas`, vencimentos via `somarMeses`. Competência é a mesma (data da compra) em todas as parcelas — a despesa foi incorrida uma vez, só o caixa se espalha.
6. **Cartão de crédito** (`lancamentos/cartao.ts`): `resolverMesReferenciaFatura` (compra até o dia do fechamento, inclusive, entra na fatura que fecha nesse dia — testado explicitamente o caso do dia exato, pedido no prompt) e `calcularFechamentoEVencimento`. `pagarFatura` cria **um único** lançamento `TRANSFERENCIA` (saída da conta bancária) e marca as despesas da fatura como `PAGO` — decisão registrada para a Fase 6 não somar as duas coisas no fluxo de caixa: as despesas da fatura contam na DRE pela competência da compra (já aconteceu), mas o único movimento de caixa de verdade é essa transferência, no vencimento da fatura.
7. **Compra de mercadoria → conta a pagar** (`lancamentos/pedidoCompra.ts`): `gerarContaAPagarDePedidoCompra` calcula o valor somando `custo × quantidade × multiplicador` de cada item do `PedidoCompra` já **confirmado**, categoria "Compra de mercadoria (estoque)", fora da DRE. **Não toca na rota de confirmação existente** (`src/app/api/pedidos-compra/route.ts`) — é um passo seguinte, opcional, aditivo, numa rota nova (`POST /api/financeiro/pedidos-compra/[id]/conta-a-pagar`), exatamente como "oferecer" sugere no prompt (um botão, não um efeito automático). Idempotente por `chaveExterna`; suporta parcelamento.
8. **Rotas** (todas atrás de `FINANCEIRO_VER`/`FINANCEIRO_EDITAR`): `/api/financeiro/lancamentos` (listar/criar), `/api/financeiro/lancamentos/[id]` (editar/excluir), `/api/financeiro/lancamentos/lote` (as 3 ações em lote), `/api/financeiro/recorrencias` (listar/criar) e `/[id]` (editar com `aplicarAosPrevistos`), `/api/financeiro/cartoes/compras` (registrar compra) e `/api/financeiro/cartoes/faturas/[id]/pagar`, `/api/financeiro/pedidos-compra/[id]/conta-a-pagar`.
9. **Escopo decidido para "exportação para xlsx"**: não há nenhuma rota de exportação server-side nesta fase. A única biblioteca `xlsx` já usada no projeto (`src/utils/excelExport.ts`) é 100% client-side (`XLSX.writeFile` dispara o download direto no navegador, sem buffer/`Content-Disposition`) em todo exemplo existente no código — a tela de lançamentos (Fase 7) vai buscar os dados pela própria rota de listagem (que já tem todos os filtros do item 7) e chamar essa mesma função, sem precisar de nenhuma rota nova.
10. **Testes** (83 novos): `dividirEmParcelas`/`somarMeses`, CRUD e lote de lançamentos, recorrência (geração, idempotência, `fim`, dia 31→fevereiro, as duas formas de edição), parcelamento (centavos, vencimentos, numeração), cartão (fechamento no dia exato, fatura compartilhada entre compras do mesmo mês, conta que não é cartão, pagamento soma e marca tudo como pago, fatura paga duas vezes falha), conta a pagar de pedido de compra (cálculo do valor, pedido não confirmado, idempotência, parcelamento), todas as rotas novas, cron com a geração de recorrências.

### O que ficou pendente desta fase

- Nenhuma tela foi construída (Fase 7) — só o backend.
- A real wiring entre "confirmar PedidoCompra" e "oferecer o botão de gerar conta a pagar" na interface é responsabilidade da Fase 7; o backend já está pronto e testado para quando o botão existir.

### Checks ao final da fase

- `npx tsc --noEmit`: limpo.
- `npx next lint`: limpo.
- `npm test`: 52 arquivos, 346 testes, todos passando (83 novos desta fase).
