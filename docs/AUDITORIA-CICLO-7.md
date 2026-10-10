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
