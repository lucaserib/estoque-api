# Leap Stock — Ciclo 12: simples de usar, rápido de configurar

Documento autocontido de execução para o Claude Code. O app já é completo e robusto; o problema agora é **informação demais, repetida em vários lugares, e configuração lenta**. Este ciclo não cria módulo novo: ele corta, junta e deixa o caminho óbvio. A régua de cada mudança é: *um lojista com 30 SKUs e uma operação com 3.000 SKUs conseguem configurar e usar sem pedir ajuda?*

A **Fase 1 já foi executada** (seção "Estado de partida"). Execute as fases 2 a 6 **na ordem**. Ao final de cada fase: `npx tsc --noEmit`, `npx next lint`, `npm test`, commit descritivo em português e registro em `docs/AUDITORIA-CICLO-12.md`. Ao final, `npm run build` e `git push origin master`.

**Regras inegociáveis:** dinheiro em centavos (`Int`); dia e mês sempre no fuso `America/Sao_Paulo`; escopo por `contaId`; `VER_CUSTO` aplicado no servidor; nenhum número inventado ("—" com motivo quando faltar); migrações aditivas com `IF NOT EXISTS`; sem comentários no código além dos que explicam um "porquê"; TypeScript estrito; componentes de UI existentes; responsivo (notebook de 768 px de altura e celular) e nos dois temas. **Uma informação, um lugar:** catálogo lê de `modules/catalogo/listaProdutos.ts`, vínculo grava por `modules/catalogo/vinculos.ts`, Financeiro calcula por `modules/financeiro/relatorios/motor.ts`. Antes de apagar qualquer rota ou componente, `grep` por chamadores (inclusive crons em `vercel.json`).

---

## Princípios do ciclo

1. **Uma informação, um lugar.** Se um número aparece em duas telas, uma linka para a outra em vez de recalcular.
2. **O padrão já é o que importa.** Período padrão = mês atual. Lista padrão = ativos, mais vendidos primeiro.
3. **Cadastro vem do Bling; à mão é exceção.**
4. **Vínculo anúncio → estoque responde duas perguntas:** qual produto sai e quantas unidades. "Kit com 2" com o mesmo SKU é caso normal.
5. **Nada some por causa do tamanho da tela.**
6. **Toda ação repetitiva tem versão em lote.**

### O caminho de configuração que o app inteiro deve conduzir
| # | Passo | Onde | Usuário | App |
|---|---|---|---|---|
| 1 | Conectar | Integrações | Autoriza Bling e ML | Webhooks, tokens criptografados |
| 2 | Trazer o catálogo | Produtos → Atualizar catálogo | Um clique | Bling (produtos, custo, fornecedor, EAN, foto, kits) → estoque por depósito → anúncios ML → Full |
| 3 | Revisar vínculos | ML → Anúncios e vínculos | Confirma sugestões em lote; nos kits informa N unidades | Sugere por SKU/EAN/título; cria kit de quantidade; refaz custo das vendas antigas |
| 4 | Completar cadastro | Produtos → "Precisa de atenção" | Resolve só o que aparece | Some quando está certo |
| 5 | Usar | Visão geral · Reposição · Financeiro | — | Mês atual, o que comprar, o que enviar ao Full, lucro real |

Onboarding (`/onboarding`), pendências e botões de "próximo passo" apontam sempre para o próximo item desta tabela.

---

## Estado de partida (Fase 1 — já feita, não refazer)

Detalhes em `docs/AUDITORIA-CICLO-12.md`. O que já existe e deve ser reaproveitado:

- **Sidebar** (`components/layout/Sidebar.tsx`): rola sozinha, grupo abre na rota ativa, recolher no rodapé, fecha no celular ao navegar.
- **Período rápido**: `resolverPeriodoRapido` / `OPCOES_PERIODO_RAPIDO` em `modules/financeiro/dominio/periodo.ts` (mês atual padrão, comparação com o mesmo trecho do mês anterior). Usado no dashboard e em Vendas do ML.
- **Lista de produtos**: `GET /api/produtos/lista` (`modules/catalogo/listaProdutos.ts`), paginada, ordem ativos → vendas 90d (venda de kit soma no componente) → estoque → nome; `ProdutoList.tsx` com rolagem infinita e abas Produtos · Kits · Inativos.
- **Vínculo único**: `modules/catalogo/vinculos.ts` (`definirVinculoAnuncio`, `confirmarVinculoAnuncio`, `obterOuCriarKitDeQuantidade`, `descreverComposicao`) + `POST /api/catalogo/vinculos`; as rotas antigas (`mercadolivre/produtos/link`, `produtos/vincular-manual`, `produtos/vinculos-pendentes`) delegam para ele. `revincularVendasDoAnuncio` (em `ingestao/sincronizador.ts`) refaz custo/CMV das vendas já gravadas.
- **Diálogo** `components/catalogo/VincularAnuncioDialog.tsx` com busca e "unidades por venda" (`modules/catalogo/unidadesAnuncio.ts` sugere pelo título).
- **Cadastro rápido do Bling**: `GET /api/bling/produtos/buscar`, `POST /api/bling/produtos/importar-um`, `produtos/components/ImportarDoBlingDialog.tsx`.
- **Bling corrigido**: data incremental em hora de Brasília (`formatarDataHoraBrasilia`), componentes removidos saem do kit, componente faltando é importado, saldo virtual de kit ignorado, busca por `blingId` antes de SKU, webhook com erro permanente é fechado, cache de contato.
- **Reposição**: Full somado de todos os anúncios Full, kit nunca gera compra, kit no Full conta no componente.

---

## FASE 2 — Vínculos em escala (operação grande revisa 3.000 anúncios em minutos)

1. **Uma tela só para vínculo.** `mercado-livre/produtos` passa a ser o único lugar. Filtros no topo, com contagem: *Todos · Sem vínculo · A confirmar · Kit · SKU divergente*. `/produtos/vincular` e `/produtos/vinculos-pendentes` viram `redirect()` para o filtro correspondente; o botão "Confirmar vínculos" de Produtos e a pendência `SEM_VINCULO_ML` da ficha apontam para lá.
2. **Paginação no servidor** em `GET /api/mercadolivre/produtos` (hoje devolve todos os anúncios da conta de uma vez), com os mesmos filtros e rolagem infinita, igual a `ProdutoList`.
3. **Sugestão por anúncio**: para cada anúncio sem vínculo ou não confirmado, o servidor devolve `sugestao: { produtoId, nome, sku, unidadesPorVenda, motivo: "SKU_EXATO" | "EAN" | "TITULO_KIT" | "SIMILARIDADE", confianca }`. Regra: SKU exato do anúncio (`mlSellerSku`) → produto; se o título indicar kit (`sugerirUnidadesPeloTitulo`) e o produto for unitário, `unidadesPorVenda` vem preenchido; EAN do anúncio (atributo `GTIN`) → produto; por último similaridade (`productMatchingService`).
4. **Ações em lote**: checkbox por linha + "Aplicar sugestões selecionadas" e "Confirmar selecionados". Rota nova `POST /api/catalogo/vinculos/lote` que recebe até 200 itens `{ anuncioId, produtoId, unidadesPorVenda }`, chama `definirVinculoAnuncio` para cada um e devolve sucesso/erro por item (sem abortar o lote inteiro). Barra de progresso no cliente se passar de 50.
5. **Matching automático já com quantidade**: em `productMatchingService`, quando o vínculo automático cair num produto unitário e o título indicar kit, gravar via `obterOuCriarKitDeQuantidade` como **não confirmado** (`vinculoConfirmado: false`), para o usuário só confirmar.
6. **Variações do ML**: hoje um anúncio com 3 cores aponta para um produto só. Cada variação tem SKU próprio (`attribute_combinations` + `SELLER_SKU`). Gravar uma linha de vínculo por variação (`ProdutoMercadoLivre.mlVariationId` já existe; ajustar o `@@unique` com migração aditiva para `[mlItemId, mercadoLivreAccountId, mlVariationId]` usando `COALESCE` ou coluna gerada). `vincularProduto` (financeiro) passa a usar `variacaoExternaId` do item da venda. Envio automático de estoque atualiza a variação certa.
7. **Sentido inverso**: na ficha do produto, botão "Vincular anúncio" abre busca de anúncios sem vínculo e usa o mesmo diálogo.

**Testes**: sugestão por SKU/EAN/título; lote com item inválido não derruba os outros; variação vincula e a venda da variação cai no produto certo; redirects.

---

## FASE 3 — Bling: um caminho só para importar e sincronizar

1. **Apagar a importação duplicada.** `POST /api/bling/produtos/importar` roda um laço longo dentro de `after()` (estoura o tempo de função com catálogo grande) e duplica a etapa `BLING_PRODUTOS` de `modules/catalogo/sincronizacao.ts`. Trocar os botões de `integracoes/page.tsx` e `produtos/importar/page.tsx` por `<SincronizacaoCatalogo />` e remover a rota e `pollBlingSyncHistory` se ficarem sem uso. Idem `POST /api/produtos/estoque-bling` (duplica `BLING_ESTOQUE`).
2. **Tela Integrações enxuta**: um cartão por integração (Bling, Mercado Livre) com status, última sincronização de cada etapa (vem de `GET /api/catalogo/sincronizacao`), botão "Reconectar" quando expirado e "Atualizar catálogo". Sem botões separados de produtos/estoque/imagens.
3. **Conferir os parâmetros da API v3 em produção** e documentar em `docs/BLING_API.md`: `GET /produtos` com `criterio=5&tipo=P` traz kits (formato `E`) e variações (`V`)? Se variações não vierem, trocar para `tipo=T` e tratar o pai (`C`) como não estocável. Registrar o payload real (sem dados sensíveis) como fixture de teste.
4. **Variações do Bling**: produto com formato `V` vira um `Produto` por variação (SKU da variação); o pai não entra no estoque nem na reposição.
5. **Webhooks**: tela Integrações mostra os últimos eventos recebidos por tipo (`BlingWebhookEvent`) e avisa se nenhum `stock.*` chegou nas últimas 24h ("verifique a assinatura dos webhooks no app do Bling").
6. **Criar produto no Bling a partir do Leap** (opcional, só se o resto estiver pronto): cadastro manual com Bling conectado oferece "também criar no Bling" (`POST /produtos` da API v3) para não existir SKU só de um lado.

**Testes**: fixture real de produto com variação e de kit; rota antiga removida sem chamadores; status da sincronização por etapa.

---

## FASE 4 — Cortar redundância, tela por tela

| Tela | Hoje | Fazer |
|---|---|---|
| Sidebar → Financeiro | 9 itens | 6: **Visão geral · Vendas** (abas: por venda / por produto) **· DRE · Caixa** (abas: fluxo / lançamentos / cartões) **· Conferência · Configurações**. Rotas antigas redirecionam para a aba certa. |
| Mercado Livre → Painel e Vendas | Repetem faturamento/unidades da Visão geral e do Financeiro com outra fonte (API do ML ao vivo) | Painel vira **"Saúde dos anúncios"**: pausados, sem estoque, sem vínculo, Full baixo, sem tarifa/frete, preço abaixo do custo — cada item clicável abrindo Anúncios e vínculos filtrado. "Vendas" sai do menu (redirect para Visão geral). |
| Configurações | 4 telas: `/configuracoes` (2.981 linhas), `/configuracoes-gerais`, `/mercado-livre/configuracoes`, `/financeiro/configuracoes` | **Uma** tela com seções em abas laterais: Empresa e impostos · Reposição · Mercado Livre · Financeiro · Usuários · Aparência. Quebrar `/configuracoes/page.tsx` em um componente por seção (`configuracoes/secoes/*.tsx`). Rotas antigas redirecionam. |
| Ficha do produto | Abas Dados / Fornecedores / Estoque / ML / Histórico + 3 diálogos | Uma coluna: cabeçalho com números → **Onde é vendido** (`AnunciosDoProduto`, já pronto) → **Cadastro** editável inline (nome, EAN, custo, fornecedor principal, prazo, estoque de segurança) → Histórico. Diálogos de editar/fornecedor/estoque deixam de ser necessários aqui. |
| Visão geral | Hero + faixa + pendências + onde está o estoque + gráfico + vários blocos | No máximo 5 blocos: resultado do mês · o que fazer hoje (pendências críticas + ruptura) · onde está o estoque · evolução · top produtos. "Saúde dos dados" (Ciclo 11) fica só na sua página e com um link. |
| Saídas | `GET /api/produtos?armazemId=` ignora o armazém e baixa o catálogo inteiro | Busca com `/api/produtos/lista?q=` + estoque do armazém escolhido. |
| Onboarding | Baixa a lista inteira para contar produtos | Usa `contagens` de `/api/produtos/lista` e segue a tabela "caminho de configuração". |

Critério de aceite da fase: nenhum número de venda/margem calculado fora de `motor.ts`; nenhuma tela com dois blocos mostrando o mesmo número; todas as telas usáveis em 1366×768 e 390×844.

---

## FASE 5 — Limpeza técnica

1. **Apagar arquivos sem nenhum import** (conferido na Fase 1; reconfirme com `grep`):
   `src/app/components/{LoadingSpinner,GoogleSignin,FornecedorModal,MercadoLivreProductInfo,EditarProdutoModal,SignOut}.tsx`, `src/app/components/MercadoLivre/{ProdutoMLCard,MLProductLinkModal}.tsx`, `src/components/{FornecedoresDeleteDialog,EstoqueSegurancaCalculator,ConfirmarPedidoForm,PedidoEntradasLoadingSkeleton}.tsx`, `src/components/dashboard/KpiCard.tsx`, `src/hooks/useProducts.ts`, `src/app/hooks/useReplenishmentCache.ts`, `src/lib/executeAction.ts`, `src/app/(root)/produtos/components/{KitList,ProdutoPagination}.tsx`, `src/app/(root)/produtos/components/dialogs/KitDetalhesDialog.tsx`.
2. **Rotas sem chamador na interface** — confirmar nos logs da Vercel dos últimos 30 dias antes de apagar: `mercadolivre/monitoring`, `mercadolivre/alerts`, `mercadolivre/dashboard/realtime`, `produtos/estoque-full`, `mercadolivre/produtos-inteligente`, `mercadolivre/analytics/sales-optimized` (e as variantes citadas no `CLAUDE.md`).
3. **Duas implementações de sincronização de anúncio** que sobraram em `mercadoLivreService.ts` além de `modules/catalogo/anunciosMl.ts`: deixar só a do catálogo.
4. `GET /api/produtos` sem parâmetro (catálogo inteiro com relações) fica só para compatibilidade e é marcado como legado; nenhuma tela nova usa.
5. Atualizar o `CLAUDE.md` (fontes da verdade e rotas) com o que mudou.

---

## FASE 6 — Verificação

1. `npx tsc --noEmit`, `npx next lint`, `npm test`, `npm run build` limpos.
2. `docs/AUDITORIA-CICLO-12.md` com o que foi feito por fase e a lista de aceite abaixo.
3. Commit final e `git push origin master`.

### Lista de aceite (o Lucas confere depois do deploy)
- [ ] Notebook com tela baixa: Financeiro abre na sidebar e todos os itens aparecem; celular: menu abre por cima e fecha ao navegar.
- [ ] Visão geral e Vendas abrem em "Mês atual"; "Mês anterior" bate com a DRE do mês.
- [ ] Produtos abre com ativos e mais vendidos no topo e carrega o resto ao rolar; aba Kits mostra "dá para montar".
- [ ] **Kit de 2 adaptadores (mesmo SKU, dois anúncios)**: anúncio do kit → Adaptador → 2 unidades → salvar. A aba Kits mostra "Kit 2x …"; a ficha do Adaptador mostra os dois anúncios (1 un. e 2 un.); uma venda antiga do kit em Lucro por venda tem custo de 2 adaptadores; a Reposição do Adaptador soma a demanda do kit ×2; o estoque enviado ao anúncio do kit (se não for Full) é metade do adaptador.
- [ ] Anúncios e vínculos: filtro "Sem vínculo" → selecionar tudo → "Aplicar sugestões" vincula em lote, com kits já com a quantidade.
- [ ] Novo produto → Buscar no Bling: SKU novo importado com custo, EAN, fornecedor, foto e estoque.
- [ ] Produto alterado no Bling aparece no Leap após "Atualizar catálogo".
- [ ] Integrações mostra uma linha por etapa com a última sincronização; não há mais botões duplicados.
- [ ] Configurações é uma tela só; Financeiro tem 6 itens no menu; ML → Saúde dos anúncios no lugar de Painel/Vendas.

---

## Passos manuais do Lucas
1. No app do Bling (central de desenvolvedores): webhooks `product`, `stock`, `virtual_stock` e `product_supplier` apontando para `https://estoque-api-4iqj.vercel.app/api/bling/webhook`.
2. Depois do deploy da Fase 2: abrir ML → Anúncios e vínculos → filtro "Kit" e conferir as quantidades sugeridas antes de aplicar em lote.
3. Depois da Fase 3: rodar "Atualizar catálogo" uma vez e conferir em Integrações que as quatro etapas terminaram.
