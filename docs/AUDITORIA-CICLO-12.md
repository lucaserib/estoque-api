# Auditoria — Ciclo 12: simplificar e configurar rápido

Registro vivo da execução de `PROMPT-CICLO-12-SIMPLIFICAR.md` (raiz). Fase 1 executada em 19/10/2026 sobre o Ciclo 11 completo (até `46334ec`, Fase 6 — custo travado no servidor). Os conflitos com a Fase 5/6 (link "Saúde dos dados" na sidebar e `VER_CUSTO` na ficha do produto) foram resolvidos mantendo os dois lados.

## Verificação

- `npx tsc --noEmit` limpo (fora `scripts/` e `prisma/seed.ts`, que já dependiam do client gerado localmente).
- `npm test`: **125 arquivos, 726 testes passando** (+25 novos neste ciclo; 4 testes da rota de vínculos pendentes reescritos para o contrato novo).
- `next lint` sem avisos.
- `next build`: compilou todas as páginas e rotas (ver nota no fim).

## Fase 1 — o que mudou, por pedido

### Sidebar (Financeiro some em tela baixa)
- `src/app/components/layout/Sidebar.tsx` — reescrita: topo e rodapé fixos, lista com `min-h-0 flex-1 overflow-y-auto`; grupo abre sozinho quando a rota ativa é dele; rota ativa reconhece sub-caminhos (`/produtos/123` acende Produtos); recolhida no desktop, o ícone do grupo leva à primeira tela; rodapé com "Recolher menu".
- `src/app/context/LayoutContext.tsx` — no celular a sidebar começa fechada e fecha ao navegar (`closeSidebarOnMobile`); no desktop lembra a escolha; `localStorage` com try/catch.
- `src/app/DashboardWrapper.tsx` — `min-w-0` no conteúdo (tabela larga não empurra a página).

### Mês atual como período padrão
- `src/modules/financeiro/dominio/periodo.ts` — `resolverPeriodoRapido` (mês atual / mês anterior / 7–90 dias) e `OPCOES_PERIODO_RAPIDO`. Mês atual compara com o mesmo trecho do mês anterior; no dia 31 de março não invade março.
- `src/app/api/dashboard/resumo/route.ts`, `src/app/(root)/dashboard/page.tsx` — padrão "Mês atual"; rótulos vêm do servidor.
- `src/app/api/mercadolivre/analytics/sales-complete/route.ts`, `src/app/(root)/mercado-livre/vendas/page.tsx` — mesmos presets; período personalizado agora usa os limites do dia em SP (antes `setHours` em UTC puxava 3h do dia anterior).

### Produtos: ativos e mais vendidos primeiro, carregamento progressivo
- `src/modules/catalogo/listaProdutos.ts` + `GET /api/produtos/lista` — paginação, filtros e ordenação no servidor; vendas de 90 dias do Financeiro (fonte única), com venda de kit somada ao componente; sem histórico, cai no `mlSold90Days`; estoque local sem o armazém Full; kits com "dá para montar" e custo pela composição; pendências anexadas; custo some sem `VER_CUSTO`.
- `src/app/(root)/produtos/components/ProdutoList.tsx` — reescrito: rolagem infinita (IntersectionObserver + botão), atalhos de pendência, busca com debounce, ordenação, abas Produtos · Kits · Inativos.
- `src/app/(root)/produtos/page.tsx` — cabeçalho enxuto (Confirmar vínculos · Atualizar catálogo · Mais · Novo produto); o botão "Vincular pendentes" que nunca aparecia (`pendingCount` fixo em 0) saiu.

### Vínculo anúncio → estoque e kit de quantidade
- `src/modules/catalogo/vinculos.ts` — **fonte única** do vínculo: `definirVinculoAnuncio`, `confirmarVinculoAnuncio`, `obterOuCriarKitDeQuantidade`, `descreverComposicao`. Vínculo salvo vira `MANUAL` + confirmado + `syncStatus: "pending"` (entra no próximo envio automático, que já pula Full e divide por kit).
- `src/modules/financeiro/ingestao/sincronizador.ts` — `revincularVendasDoAnuncio` refaz produto, custo, CMV, margem e pendências das vendas já gravadas do anúncio, sem chamar o ML. `prepararItens` só mantém o custo congelado se o produto do item não mudou.
- Rotas que delegam para o serviço: `POST /api/catalogo/vinculos` (nova), `POST /api/mercadolivre/produtos/link`, `POST /api/produtos/vincular-manual`, `PATCH /api/produtos/vinculos-pendentes` (que também passou a aceitar `unidadesPorVenda` e a não acusar "SKU divergente" quando o anúncio de kit usa o SKU do produto unitário).
- `src/components/catalogo/VincularAnuncioDialog.tsx` + `src/modules/catalogo/unidadesAnuncio.ts` — diálogo único (busca, unidades por venda com sugestão pelo título, desvincular).
- Telas: `mercado-livre/produtos` (o vínculo não gravava — corrigido; "Editar"/"Desvincular" funcionam), `produtos/vinculos-pendentes` (troca pelo diálogo em vez de digitar SKU), ficha do produto (`produtos/[id]/AnunciosDoProduto.tsx`: uma tabela só, com anúncios de kit e margem por venda).
- `GET /api/mercadolivre/produtos` devolve `composicao` e `mlSellerSku`; `GET /api/produtos/[id]` devolve `anunciosViaKit`, custo de kit pela composição e não transforma custo nulo em 0.
- `src/services/reposicaoService.ts` — Full somado de todos os anúncios Full ativos; kit nunca gera compra; kit parado no Full conta como estoque do componente (`estoqueEmKitsUnidades`); "estoque local" do kit = quantos dá para montar.
- `src/lib/pendencias.ts`, `src/services/pendenciasService.ts` — kit não cobra fornecedor/prazo/EAN; produto vendido só dentro de kit com anúncio não fica "sem anúncio".

### Bling
- Data do filtro incremental em hora de Brasília (`formatarDataHoraBrasilia`) — `modules/catalogo/sincronizacao.ts` e a rota antiga de importação.
- `src/services/blingProductSync.ts` — componentes removidos do kit saem; componente faltando é importado na hora; saldo de kit ignorado no webhook; busca do produto existente por `blingId` antes de SKU (e reaproveita produto inativo com o mesmo SKU); cache de 10 min do contato do fornecedor.
- `src/services/blingWebhookProcessor.ts` + `cron/bling-sync` — erro permanente fecha o evento; cron com orçamento de tempo.
- `src/services/blingService.ts` — `buscarProdutos` (SKU exato + nome). Rotas `GET /api/bling/produtos/buscar` e `POST /api/bling/produtos/importar-um`; diálogo `produtos/components/ImportarDoBlingDialog.tsx`.

## Testes novos
- `modules/catalogo/__tests__/vinculos.test.ts` — kit criado/reaproveitado, sufixo de SKU em colisão, base kit recusada, desvincular, conta errada, limites.
- `modules/financeiro/ingestao/__tests__/revincular.test.ts` — "kit com 2" passa a custar 2 unidades e perde `SEM_VINCULO`; custo histórico mantido no mesmo produto; desvincular.
- `modules/catalogo/__tests__/listaProdutos.test.ts` — ordem, venda de kit no componente, Full fora do local, kits, paginação, filtros, fallback de vendas.
- `modules/catalogo/__tests__/unidadesAnuncio.test.ts`, `modules/financeiro/dominio/__tests__/periodoRapido.test.ts`, acréscimos em `reposicaoService.test.ts`, `pendencias.test.ts`, `blingWebhookProcessor.test.ts`, `vinculos-pendentes/__tests__/route.test.ts`.

## Checklist manual (produção — só o Lucas consegue)
- [ ] Notebook com tela baixa: abrir Financeiro na sidebar e rolar até "Configurações"; recolher/expandir; celular: menu abre por cima, fecha ao tocar fora e ao navegar.
- [ ] Visão geral abre em "Mês atual"; trocar para "Mês anterior" e conferir com o DRE do mês.
- [ ] Produtos abre com ativos e mais vendidos no topo; rolar até o fim carrega o resto; aba Kits mostra o kit de adaptadores com "dá para montar".
- [ ] **Kit de 2 adaptadores**: em ML → Anúncios e vínculos, abrir o anúncio do kit → produto Adaptador → 2 unidades → Salvar. Conferir: aparece "Kit 2x …" na aba Kits; a ficha do Adaptador mostra os dois anúncios (1 un. e 2 un.); Financeiro → Lucro por venda de uma venda antiga do kit mostra custo de 2 adaptadores; Reposição do Adaptador soma a demanda do kit ×2; o estoque enviado ao anúncio do kit é metade do adaptador (se não for Full).
- [ ] Produtos → Novo produto → Buscar no Bling: buscar um SKU novo, importar, conferir custo, EAN, fornecedor e estoque.
- [ ] Bling: alterar um produto no Bling e rodar "Atualizar catálogo" 30 min depois — a alteração tem que chegar (antes podia ser pulada pelo fuso).

## Nota sobre o build
`next build` não roda neste ambiente de nuvem porque `next/font/google` não alcança o Google Fonts (bloqueio de rede, não do código). Numa cópia com as fontes trocadas por um stub, o build completo passou (compilação, tipos e geração das páginas). Rodar `npm run build` na máquina local antes do deploy, por garantia.
