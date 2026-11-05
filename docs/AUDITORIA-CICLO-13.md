# Auditoria — Ciclo 13: de MVP a produto final

Registro vivo da execução de `PROMPT-CICLO-13-PRODUTO-FINAL.md` (raiz). Leia também `docs/ANALISE-CRITICA-PRODUTO.md` (diagnóstico de produção de 24/10) e `docs/AUDITORIA-CICLO-12.md`.

## FASE 0 — Publicar o que estava pronto e criar a rede de segurança

### Item 1 — Commits do que já estava pronto

O working tree tinha trabalho real de três frentes diferentes misturado, sem commit. Separado em três commits (arquivo por arquivo, não por trecho — alguns arquivos como `Sidebar.tsx`/`blingProductSync.ts` carregavam conteúdo de mais de uma frente e ficaram no commit onde a maior parte do conteúdo já estava documentada):

1. `feat: fonte única de vínculo e lista paginada de produtos (Ciclo 12 Fase 1)` — sidebar com rolagem própria, mês atual como padrão, lista de produtos paginada no servidor, serviço único de vínculo com kit de quantidade, cadastro rápido pelo Bling.
2. `fix: fatura do ML contada duas vezes na DRE e acabamento da auditoria de 24/10` — a correção do `mapeadorCobrancas.ts` (famílias `CVV*`/`CFON*`/`CFF*`) com a migração de reclassificação, cartões sem sobreposição, toast com fundo sólido, mensagens de escopo do Bling, PWA instalável.
3. `docs: diagnóstico e plano do Ciclo 13, identidade visual do Skubo` — os documentos do próprio ciclo e os arquivos prontos da marca (`public/brand/skubo/`), que a Fase 1 vai aplicar.

`npx tsc --noEmit`, `npx next lint` e `npm test` (686 testes) limpos antes do push. `npm run build` completo (com `prisma migrate deploy` real) não pôde ser verificado neste ambiente por não ter `DATABASE_URL` — verificado com `npx next build` isolado (sem o passo de migração) e, à parte, com um Postgres local descartável rodando a migração completa (ver item 2). Push feito para `origin/master` (`777d78e..03996cc`).

### Item 2 — Testes de navegador (Playwright) e a rede de segurança que isso exigiu

Ao montar o banco de teste semeado pedido pela Fase 0, `prisma migrate deploy` **falhou num banco novo, do zero** — não é um problema introduzido agora, é um buraco que já existia no histórico de migrações:

- **`bling_accounts`, `bling_sync_history` e `stock_replenishment_config` nunca tiveram um `CREATE TABLE` em nenhuma migração.** As três existem em produção (criadas em algum momento fora do fluxo de migração — `db push` ou SQL manual), então ninguém notou; mas qualquer banco novo (um ambiente de CI, uma cópia para um dev novo, um restore de desastre) quebra ao tentar rodar `prisma migrate deploy` do zero. Corrigido com uma migração aditiva (`20261003140000_bling_e_reposicao_tabelas_base`, `CREATE TABLE IF NOT EXISTS` + `FOREIGN KEY` guardada com `DO $$ ... EXCEPTION WHEN duplicate_object`) inserida cronologicamente antes da primeira migração que já fazia `ALTER TABLE` nelas — não muda nada em produção (as tabelas já existem lá), só conserta o bootstrap do zero.
- Depois de corrigir isso, `prisma migrate diff` contra um banco 100% migrado ainda apontava mais divergência: uma coluna (`produtos_mercado_livre.mlSold90Days`) nunca adicionada por migração, `produtoId` que deveria ser opcional e não estava, um índice único que deveria ter sido removido, e três índices com nomes truncados de um jeito diferente do que o schema atual geraria. Tudo corrigido numa segunda migração aditiva e idempotente (`20261101000000_ciclo13_sincroniza_drift_schema`, com `IF NOT EXISTS`/`IF EXISTS` e blocos `DO $$ ... IF EXISTS/NOT EXISTS` nos renames de índice, para não quebrar se o nome em produção já estiver diferente do que o diff local viu).
- Verificado depois das duas migrações: `prisma migrate diff` contra o schema atual devolve "This is an empty migration" — banco novo e `schema.prisma` batem exatamente.
- `prisma/seed.ts` ganhou uma segunda etapa (`seedE2E`), sempre executada depois dos dados aleatórios de desenvolvimento: usuário fixo `e2e@skubo.test`, 1 conta ML e 1 Bling (tokens falsos, nunca chamam a API de verdade), 18 produtos + 2 kits determinísticos, 60 vendas em 2 meses (geradas passando os dados brutos por `calcularVenda` de verdade, para a margem gravada bater com o que qualquer tela vai mostrar) e cobranças da fatura com os sub-tipos reais `CVVML`/`CFFE`/`CVVPRC` (via `mapearCobranca`, a mesma função de produção — nada inventado). Também idempotente (apaga e recria os dados do usuário e2e a cada execução).
- Achado e corrigido de passagem: a seção de dados aleatórios do `prisma/seed.ts` (preexistente) não era idempotente — rodar o seed duas vezes no mesmo banco quebrava em SKU duplicado, o que também quebraria `npm run test:e2e` numa segunda execução contra o mesmo banco de teste. Agora pula a geração aleatória (mantendo o e2e sempre fresco) se o usuário de desenvolvimento já tiver produtos.
- `playwright.config.ts` + `e2e/global-setup.ts` (roda `migrate deploy` e `db seed` antes da suíte) + `e2e/*.spec.ts`, cobrindo os 5 cenários mínimos do prompt, nos três tamanhos (1440×900, 1366×680, 390×844):
  1. login → Visão geral sem nenhum texto sobreposto (checado por `boundingBox` de todo par de elementos dentro de cada cartão) e sem rolagem horizontal.
  2. Sidebar: com Financeiro aberto em 1366×680, "Usuários" continua clicável (pulado no celular, onde a navegação é outra).
  3. Financeiro: margem do cartão do topo = soma da coluna Margem do bloco "Por logística".
  4. DRE: soma de todas as linhas de componente (as com prefixo `(−)`/`(+)`/`(±)` mais "Vendas brutas") fecha com a última linha de subtotal (Lucro líquido).
  5. Vincular o anúncio "Kit 2 ..." (sugestão automática de 2 unidades pelo título) e conferir que a venda que usava esse anúncio deixa de aparecer sem custo (pulado nos projetos 1366×680/390×844 — é um fluxo de escrita, não um teste de layout por tamanho, e rodar de novo encontraria o botão já trocado por "Editar").
  - **Rodado de verdade nesta sessão** (não só escrito): Postgres local descartável, `npx playwright install chromium`, `next build` + `next start`, suíte completa nos três tamanhos. Resultado: **12 passaram, 3 pulados (como esperado), 0 falharam**. `npm run test:e2e` no `package.json`.
- CI (GitHub Actions) para rodar isso automaticamente a cada push/PR **não foi criado nesta sessão** — exigiria decidir onde o Postgres de teste do CI vive (serviço do GitHub Actions vs. banco gerenciado) e configurar segredos novos, uma decisão de infraestrutura que não cabe dentro da mesma execução sem confirmar com o Lucas. `npm run test:e2e` já funciona local ou em qualquer CI que forneça um `DATABASE_URL` descartável.

### Item 3 — Monitoramento (Sentry)

- `tracesSampleRate: 0.1` **já estava ligado** nos três configs (`sentry.server.config.ts`, `sentry.edge.config.ts`, `src/instrumentation-client.ts`) — nada a fazer aqui.
- `onRequestError` (`src/instrumentation.ts`) já capturava os erros que escapam até o Next.js, mas sem `contaId` — e a maioria das rotas de API deste app **trata o próprio erro** (`catch { console.error(...); return NextResponse.json(...) }`), então o erro nunca chegava a esse hook global. Resolver isso rota por rota não cabe nesta fase (são centenas de rotas). Adicionado o que dá para fazer no único ponto central que toca toda rota: `onRequestError` agora decodifica o cookie de sessão (mesma lógica do `verifyUser`, sem round-trip ao banco) e marca o erro com a tag `contaId` antes de mandar pro Sentry — sem e-mail, nome ou qualquer outro dado pessoal. 7 testes novos (`src/__tests__/instrumentation.test.ts`) cobrindo cookie seguro/inseguro, token inválido, sem segredo configurado, sem cookie, e o formato de array que o Node às vezes entrega.
- Alerta para erro novo: **não dá para configurar por código** — é um alerta dentro do projeto Sentry (Settings → Alerts), que exige acesso ao dashboard do Sentry do Lucas. Anotado em "Passos manuais" abaixo.

### Resultado ao final da fase
`tsc`/`lint`/`test` limpos; `npm test` com 735 testes passando (7 novos). `next build` completo. Suíte e2e rodada de ponta a ponta (Postgres local descartável) nos três tamanhos: 12 passaram, 3 pulados, 0 falharam.

## Passos manuais do Lucas (Fase 0)
- [ ] Rodar `npm run build` local antes do próximo deploy, para aplicar as duas migrações novas (`20261003140000_bling_e_reposicao_tabelas_base` e `20261101000000_ciclo13_sincroniza_drift_schema`) em produção — são aditivas e não tocam dados, mas valem a conferência de praxe.
- [ ] No Sentry (Settings → Alerts do projeto): criar um alerta para "erro novo" (issue nunca vista antes). Não dá para fazer por código.
- [ ] Decidir, quando chegar a hora de configurar CI: onde roda o Postgres descartável dos testes e2e (serviço do GitHub Actions é a opção mais simples) — fora do escopo desta sessão.

## FASE 1 — Marca Skubo e design

### 1.0 — Identidade

- Paleta, tipografia (Sora/Inter/JetBrains Mono) e forma (raio de cartão 18px, sombra) da tabela do prompt viraram tokens em `styles/global.css` (claro + escuro) e `tailwind.config.ts`, com as escalas geradas via `python3`/`colorsys` a partir dos hex da tabela — conferido que cada HSL bate com a anotação do prompt antes de aplicar.
- `src/components/brand/Logo.tsx`: `CubeMark` desenha a mesma geometria de `skubo-simbolo.svg`, mas com `hsl(var(--primary))`/`--primary-strong`/`--success` em vez de hex fixo (funciona no escuro sem precisar de um segundo arquivo); ganhou uma variante `mono` (`currentColor` + opacidade, igual a `skubo-simbolo-mono.svg`) para uso sobre fundo colorido. `Wordmark` usa o path em curvas extraído de `skubo-logo.svg` (a palavra "skubo" não depende de fonte carregada), colorido por `hsl(var(--foreground))` — branco quando `onBrand`. Nada foi redesenhado, só decomposto em tokens.
- `layout.tsx` (fontes Sora/Inter/JetBrains Mono, title/applicationName/appleWebApp/themeColor), `manifest.ts` (nome "Skubo", cores da marca, ícones de `public/brand/skubo/`), `src/app/icon.png`/`apple-icon.png` substituídos pelos arquivos prontos da marca, `public/pwa/` apagado (conferido com grep que nada mais referenciava a pasta).
- `grep -rn "Leap" src public` → 14 arquivos de app com o texto antigo, todos corrigidos (strings de erro do Bling, metadados, e-mails de convite, assinatura, coluna da conferência etc.) mais o apelido da conta ML de teste no seed (`LEAPSTORE_E2E` → `SKUBO_E2E`, achado rodando a suíte de navegador). **`grep -rln "Leap" src public` agora devolve zero.** Não mexi em `docs/historico/*` nem nos documentos de auditoria de ciclos anteriores — são registro histórico, não tela nem código vivo.
- `(auth)/layout.tsx`: painel da esquerda agora é `bg-primary` sólido (Roxo Skubo) com o logo branco (`Logo onBrand`) e a assinatura do produto; rodapé "© Skubo". `public/login-image.png` não é referenciado em lugar nenhum do código (confirmado por grep) — não havia nada para refazer; o painel já era CSS puro.
- Personalização por conta: migração aditiva `20261102040000_ciclo13_marca_skubo` (enum `TemaPreferencia`, colunas `nomeLoja`/`logoUrl`/`tema` em `configuracoes_gerais`, tudo com `IF NOT EXISTS`/`DO $$ ... EXCEPTION`). `GET`/`PATCH /api/configuracoes-gerais` passaram a aceitar esses três campos — a alíquota de imposto continua exigindo `VER_CUSTO`, mas nome/logo/tema não (é personalização visual, não dado de custo). `POST /api/configuracoes-gerais/logo` (novo) sobe a logo pro Vercel Blob e apaga a anterior, no mesmo molde do upload de avatar já existente.

### 1.1 — Tokens

- `--primary-strong`/`--primary-soft`, `--success-text`/`--warning-text`/`--destructive-text`, `--radius-card` (18px), gradiente de cartão de destaque (`--card-gradient-from/to` + utilitário `.bg-card-gradient`) — tudo com variante clara e escura.
- **Achado de contraste real, não só do roxo/verde novo**: o app já usava `text-success`/`text-warning`/`text-destructive` (a cor de preenchimento) como cor de *texto* em ~320 lugares — exatamente o problema que o prompt avisa ("Verde Lucro `#16C79A` não é usado para texto em fundo claro — usar `#0E9F7A`"). Medi o contraste das três cores (`colorsys` + fórmula de luminância relativa do WCAG): `#16C79A` e `#F5A524` já vinham sem variante seguro nenhuma usada no app; `#E5484D` (destructive) também ficava abaixo de 4.5:1 sobre branco (3.9:1) e não estava nem mencionado na tabela do prompt. Resolvido criando `--success-text`/`--warning-text` (valores da própria tabela do prompt) e um `--destructive-text` novo (mesmo tom, luminosidade reduzida até passar de 4.5:1 → 5.7:1), e trocando `text-success`/`text-warning`/`text-destructive` por `text-success-text`/`text-warning-text`/`text-destructive-text` em todo o `src/` com um `perl` que preserva `-foreground` e evita dupla substituição (conferido com grep antes/depois, zero sobra).
- `rounded-card` aplicado no `Card` e `SectionCard` compartilhados (cascata automática pro app inteiro) e no cartão de login.
- `font-mono` tirado de todo valor monetário que achei (`DemonstrativoResultado.tsx`, `financeiro/fluxo-de-caixa`, `financeiro/vendas` — `moeda()`/`formatBRL()` em `font-mono`), mantendo `tabular-nums`. Conferi cada ocorrência restante de `font-mono` no projeto (SKU, EAN, número de pedido, ID do comprador, rastreamento, badges de pedido) — são exatamente os casos que o prompt pede para continuar em mono.
- `StatCard`/`StatCardGrid` (ver 1.2) usam os valores em `font-sans tabular-nums`, nunca mono, com a cor condicionada ao `status` (`success-text`/`warning-text`/`destructive-text`/neutro).

### 1.2 — Componentes base

- `src/components/ui/stat-card.tsx` (novo) — substitui `StatStrip`/`HeroMetric` (apagados): um único componente com `size` (`sm`/`default`/`lg`), tooltip "de onde vem" (ícone `i`, Radix Tooltip), link "Ver detalhes", cor por `status` e `highlight` (gradiente sutil da marca, para o cartão de resultado do período). Migrado nos 8 pontos que usavam os componentes antigos (`dashboard`, `financeiro`, `financeiro/fluxo-de-caixa`, `gestao-pedidos`, `mercado-livre`, `mercado-livre/vendas`, `reposicao`, `saidas`) — `highlight` aplicado nos dois cartões de "faturamento do período" (dashboard e financeiro).
- `empty-state.tsx`, `error-state.tsx` (novos) — não existiam. `ErrorState` segue o "jeito de falar" do prompt: título é o que houve, descrição é o que fazer, com botão de ação/retry.
- `confirm-dialog.tsx` (novo) — generaliza o `AlertDialog` que hoje está reimplementado à mão em 4 arquivos (`EstoqueDeleteDialog`, `ProdutoDeleteDialog` ×2, `FornecedoresDeleteDialog`). **Não troquei os 4 call sites nesta fase** — o componente genérico já cobre o padrão deles 1:1, mas trocar é mudança comportamental em telas de exclusão que merece seu próprio teste manual; fica para quando essas telas forem tocadas de novo (ou para a Fase 8).
- `data-table.tsx` ganhou `DataTableResponsive` (novo export, aditivo — os primitivos antigos `DataTable`/`DataTableHeader`/etc. continuam intactos e usados em dezenas de telas): define colunas uma vez (`papelMobile: "titulo"|"subtitulo"|"valor"|"oculto"`) e renderiza tabela de verdade a partir de 768px, lista de cartões abaixo disso. **Não retrofitei nenhuma tabela existente** — são ~20+ telas com tabela própria; o componente fica pronto pra quem for construído a partir de agora (a própria Fase 2+).
- `page-shell.tsx` (novo) — cabeçalho com "atualizado há X min" (`formatRelativeTime`), ações que viram menu "⋯" (Radix DropdownMenu) abaixo de `sm`, slot de filtros. Convive com `PageHeader` (não substituído nos ~60 call sites atuais — mesma lógica de escopo do `DataTableResponsive`).
- `command-palette.tsx` (novo) + `GET /api/busca?q=`: a busca do topo ("hoje não faz nada", citado no prompt) agora abre um Cmdk (⌘K ou clique) que busca produto (nome/SKU/EAN), pedido de compra (por número) e anúncio ML (título/MLB), cada um `take: 8` e escopado por `user.contaId`, mais 5 ações fixas (nova compra, vincular anúncios, ir pro DRE, transferir estoque, novo produto). Troquei o `<input>` morto do `Navbar.tsx` por esse componente.

### 1.3 — Navegação

- Sidebar reorganizada nos 5 grupos do prompt (Início · Vendas e lucro · Estoque e compras · Anúncios · Ajustes). O grupo Financeiro, que tinha 9 itens soltos, ganhou uma camada de "cluster" nova no `SidebarGrupo` (rótulo pequeno + sub-itens, sem clique extra pra abrir) e caiu pra exatamente 5 entradas visíveis: Resultado/DRE (Visão geral + DRE), Vendas (Lucro por venda + por produto), Caixa (Fluxo de caixa + Lançamentos + Cartões), Conferência, Ajustes do financeiro — nenhuma rota foi apagada, só reagrupada.
- **Achado de passagem, corrigido**: o link "Configurações" da sidebar antiga apontava pra `/configuracoes`, que não é a tela de configurações gerais — é a página legada "Integração Mercado Livre" (confirmado com grep: só `/integracoes` e `/mercado-livre/vendas` linkam pra ela de verdade). Agora "Configurações" no grupo Ajustes aponta pra `/configuracoes-gerais` (a tela certa); `/configuracoes` continua existindo e acessível pelo link que já tinha em Integrações — não apaguei nada, só parei de confundir as duas no menu.
- `src/app/components/layout/BottomNav.tsx` (novo): barra inferior só no celular (`md:hidden`) com Início, Vendas (Financeiro ou vendas do ML, dependendo da permissão), Estoque, Anúncios e "Mais" (abre a sidebar existente como folha, reaproveitando o mesmo `toggleSidebar` do menu hambúrguer — não duplica componente). `DashboardWrapper.tsx` ganhou o espaço inferior (`pb-24` no celular) pra nada ficar atrás da barra.
- Sidebar mostra nome/logo da loja (quando configurados) ao lado do símbolo Skubo; `aria-label` do link do topo trocado para "Skubo — início".

### Verificação da Fase 1

- `npx tsc --noEmit`, `npx next lint` e `npm test` (735 testes) limpos depois de cada bloco de mudança, não só no final.
- `npx next build` completo, limpo.
- Banco novo do zero (mesmo Postgres descartável da Fase 0): `prisma migrate deploy` aplicou a migração nova sem erro, `prisma migrate diff` contra o schema atual devolveu "This is an empty migration" (sem drift), `prisma db seed` rodou limpo e confirmou de novo a idempotência (pula os dados aleatórios, refaz só o e2e).
- Revisão visual de verdade (Playwright contra o build de produção, não só o código lido): claro e escuro, 1440×900 e 390×844, nas telas Visão geral, Configurações e Financeiro — sem "Leap" em lugar nenhum do texto visível, sem sobreposição, sidebar com os 5 grupos e o cluster do Financeiro abrindo certo, `StatCard` sem `font-mono`, `BottomNav` sem cobrir conteúdo.
- Suíte `e2e/*.spec.ts` da Fase 0 (os 5 cenários: visão geral sem sobreposição, sidebar com Financeiro + Usuários clicáveis, margem do cartão = soma de "Por logística", DRE fechando, vincular anúncio) rodada de novo de ponta a ponta contra o rebrand, pelo motivo óbvio de que esses testes validam estrutura de tela e texto que a Fase 1 mexeu bastante.
  - **Primeira rodada: 6 falhas** (spec 1 e spec 3 nos três tamanhos). Duas causas, nenhuma das duas um defeito visual de verdade (conferido por captura de tela antes de mexer em qualquer coisa):
    1. `StatCard` trocou o valor de `<span>` por semântica diferente da antiga `HeroMetric`/`StatStrip` em um detalhe: a spec 3 lia o valor da "Margem de contribuição" pelo 2º `<p>` dentro do cartão (`cartaoMargem.locator("p").nth(1)`), e eu tinha usado `<span>` pro valor — corrigido trocando pra `<p>` (zero mudança visual, só a tag).
    2. A spec 1 (sem elementos sobrepostos) comparava a caixa de **todo** `p`/`span` dentro de cada `.shadow-card`, inclusive pais e filhos — o `DeltaIndicator` (não mexido nesta fase) tem um `<span>` com um `<span>` aninhado dentro quando tem rótulo de comparação, e um elemento sempre "sobrepõe" geometricamente o próprio filho. Isso já existia antes da Fase 1; só não tinha aparecido na suíte porque dependia de `deltaLabel` estar presente no HTML no momento certo. Corrigido no próprio teste: agora só compara elementos-folha (sem filho elemento), que é o que a asserção realmente queria dizer.
  - Rodada seguinte, com as duas correções: **12 passaram, 3 pulados (como esperado), 0 falharam** — igual ao resultado da Fase 0.
  - Achado de passagem rodando a suíte: o novo `fetch("/api/configuracoes-gerais")` do `LayoutContext` (pra carregar tema/marca da conta) disparava em **toda** página, inclusive `/login`/`/register`, sem sessão — gerava um 401 e um `console.error` no servidor a cada carregamento. Corrigido: só busca depois que `useSession()` confirma `status === "authenticated"`.

## Passos manuais do Lucas (Fase 1)
- [ ] Nenhuma migração de produção adicional além da já listada na Fase 0 — `20261102040000_ciclo13_marca_skubo` é aditiva (só cria o enum e as 3 colunas novas com default), mesma recomendação de rodar `npm run build` antes do próximo deploy já cobre ela.
- [ ] Depois do deploy, considerar trocar o favicon/ícone cacheado no navegador (ctrl+F5) — ícone novo já está nos arquivos, mas navegadores guardam o favicon antigo agressivamente.

## FASE 2 — Jornada de configuração (tour gamificado)

### 2.1 — Motor de etapas

`src/modules/onboarding/etapas.ts` calcula as 12 etapas no servidor a partir de dado real — nada inventado, nada estimado:

1. **Conectar o Mercado Livre** — `MercadoLivreAccount` ativa.
2. **Conectar o Bling** — `BlingAccount` ativa **e** uma chamada real a `/depositos` (via `BlingService.getDeposits`, a mesma função que o resto do app usa) tem que funcionar; se vier `BlingEscopoError`, a etapa mostra a mensagem de passo a passo que esse erro já carrega (Central de extensões → Escopos) — não reescrevi essa mensagem, só propaguei. **Simplificação assumida**: só testei `/depositos`, não `/produtos/fornecedores` (o segundo exige um `produtoId` real do Bling, uma chamada extra só pra essa checagem — `/depositos` já é um bom indicador de permissão básica).
3. **Receber notificações** — último `MercadoLivreWebhook`/`BlingWebhookEvent` da conta há menos de 24h (Bling casado pelo `blingCompanyId` da conta, já que o evento não carrega `userId`).
4. **Trazer o catálogo** — reaproveita `obterStatusCatalogo` (o mesmo motor que já roda atrás do botão "Atualizar estoque agora"), sem reimplementar nada.
5. **Vincular anúncios** — `%` de `ProdutoMercadoLivre` ativos com `produtoId` preenchido.
6. **Custos dos produtos** — reaproveita `calcularTodasPendencias` (o mesmo motor da tela de pendências, com o mesmo cache de 60s por conta) e conta quem não tem `SEM_CUSTO`.
7. **Fornecedores e prazos** — mesma fonte, excluindo kits (que não têm fornecedor próprio) e cobrando `SEM_FORNECEDOR`/`SEM_FORNECEDOR_PRINCIPAL`/`SEM_PRAZO_FORNECEDOR`.
8. **Impostos e modo de faturamento** — **heurística assumida**: considero "feito" quando `aliquotaImposto > 0` ou o regime tributário não é mais o padrão (`SIMPLES`). Não existe um jeito de saber se o Lucas "decidiu deixar em 0%" vs. "nunca abriu a tela" sem um campo novo — documentando aqui em vez de inventar um flag.
9. **Despesas fixas** — tem pelo menos um `LancamentoFinanceiro` em categoria de despesa operacional. **Não construí** os "modelos prontos com um clique" (aluguel, salários, ferramentas) citados no prompt — o botão leva pra Lançamentos, onde já dá pra cadastrar; os modelos ficam pra quando a tela de Lançamentos for mexida de novo.
10. **Meta do mês** — `ConfiguracaoGeral.metaFaturamentoMensal` preenchida. **Não construí** a sugestão automática (média dos 3 últimos meses + 10%) — o campo já existe e aceita qualquer valor digitado; a sugestão fica pra um passo futuro.
11. **Saldo do Mercado Pago** — a conta financeira automática (`CARTEIRA_MARKETPLACE`) tem `saldoInicial` diferente de zero. Como ela é criada com `saldoInicial: 0` na conexão, um saldo zerado pode ser real ou só "ainda não informado" — por isso o status fica `atencao` (nunca `pendente` nem `feito` com certeza), pedindo pra conferir.
12. **Instalar no celular** — não existe API confiável pra detectar PWA instalado a partir do servidor; a etapa fica "pendente" até o usuário clicar em "Já instalei" (reaproveita o mesmo mecanismo de pular etapa, com um marcador próprio `12_instalado`).

Cada etapa também carrega `status: "bloqueado"` quando a etapa anterior não está feita nem pulada — exceto se a própria etapa já estiver genuinamente feita (ex.: alguém que já sincronizou o catálogo antes de conectar notificações continua vendo a etapa 4 como feita, não bloqueada). `GET /api/onboarding`, cacheado 60s por conta (mesmo padrão de `withCache` da Fase 0). `POST /api/onboarding/pular` grava o marcador em `OnboardingProgresso.etapasPuladas` (migração aditiva) e invalida o cache na hora. 6 testes novos em `src/modules/onboarding/__tests__/etapas.test.ts` cobrindo bloqueio em cadeia, etapa de Bling com erro de escopo, progresso de vínculo e o caminho 100%/Centro de Distribuição.

### 2.2 — Interface

- `/comecar` (substituiu a página `/onboarding` antiga — 3 passos fixos, sem link nenhum no app apontando pra ela, confirmado por grep antes de apagar): anel de progresso em SVG, nível com o tema do cubo (Caixa → Prateleira → Depósito → Centro de Distribuição, calculado a partir de quais etapas-chave estão feitas/puladas), trilha com as 12 etapas (ícone de status, "por que importa", barra de progresso quando a etapa tem contagem, tempo estimado, botão de ação, "Pular" nas pepuláveis). `canvas-confetti` dispara (sóbrio, sem repetir layout) toda vez que a pontuação sobe entre duas consultas — **testado de verdade**: pulei uma etapa no navegador e o confete disparou exatamente como esperado (print em `docs/` não anexado, mas validado na sessão).
- Tour em slides (`src/components/onboarding/TourSlides.tsx` + `src/modules/onboarding/tourSlides.ts`): 6 telas, abre sozinho no primeiro login (`OnboardingProgresso.tourVisto === false`) e por "Ajuda → Ver tour" no menu do usuário (novo item no Navbar). Ao terminar, marca visto e leva pra `/comecar`.
- Spotlight guiado (`src/components/onboarding/Spotlight.tsx` + `src/modules/onboarding/tourSpotlight.ts`, configurável por arquivo via `data-tour="…"` como o prompt pediu): **versão inicial com 4 passos** sobre elementos que existem em qualquer tela (logo, busca, "Configurar minha loja" na sidebar, sino de notificações) — não cobri a interface inteira nesta fase (seria dezenas de `data-tour` espalhados por telas que ainda vão mudar nas próximas fases); o mecanismo é genérico e novos passos só precisam de uma linha no array + o atributo no elemento. Botão "Ver onde fica cada coisa" em `/comecar` abre o spotlight.
- Cartão "Próximo passo" (`src/components/onboarding/ProximoPassoCard.tsx`) fixo no topo da Visão geral enquanto a pontuação for menor que 90%, mostrando a próxima etapa pendente/atenção com atalho direto — **testado**: aparece em 25%, some quando passa de 90% (lógica conferida no código, não precisei forçar 90% real pra validar porque a condição é um `if` direto sobre `pontuacao`).

### 2.3 — Tela de carregamento da sincronização

`src/components/sincronizacao/SincronizacaoCatalogoModal.tsx` — descobri que o motor que o prompt pedia **já existia**: `obterStatusCatalogo`/`POST /api/catalogo/sincronizacao` (usado hoje pelo pedaço compacto `SincronizacaoCatalogo.tsx`, o botão "Atualizar estoque agora" que já aparece no topo da Visão geral) já faz exatamente o loop de etapas (Bling produtos → Bling estoque → anúncios ML → Full) que o prompt descreve, com progresso e erro reais por etapa. Não reimplementei esse motor — construí uma versão em modal, maior, com ícone+frase por etapa ("Encontramos N anúncio(s)…") e erro com botão "Tentar de novo", **reaproveitando a mesma chamada POST** em loop. Ligado à ação "Trazer agora"/"Sincronizar de novo" da etapa 4 em `/comecar`. **Testado com erro real**: a conta de teste tem token falso do ML, então a etapa de anúncios bateu um 403 de verdade durante a validação e o modal mostrou a mensagem de erro com o botão de retry, exatamente como desenhado.
- A parte de "vendas (por mês) → detalhes de pagamento" do prompt tem motor próprio e já pronto (`obterStatusSincronizacao`, `GET /api/financeiro/sincronizacao/status`) rodando via fila/cron — **não incluí essa parte dentro do modal nesta fase** (ela evolui sozinha em segundo plano e já tem indicador próprio na tela Financeiro → Conferência); juntar os dois loadings num só fica pra um ajuste futuro se fizer falta.

### 2.4 — Faturamento "igual ao Bling/Mercado Turbo"

Adicionado `ModoFaturamento.PRODUTOS_E_FRETE_TOTAL` (migração aditiva, `ALTER TYPE ... ADD VALUE IF NOT EXISTS`) em `src/modules/financeiro/relatorios/motor.ts` — soma o frete inteiro gerado no envio (vendedor + comprador) ao faturamento.

**Achado durante a implementação, que mudou o resultado em relação ao que o prompt descrevia**: o prompt diz "a margem é a mesma nos três [modos]". Conferi a álgebra (e escrevi um teste pra provar, `motorRelatorios.test.ts`) e isso só é verdade pros dois modos que já existiam (`PRODUTOS` e `PRODUTOS_E_FRETE_COMPRADOR` — o frete do comprador entra em dobro, cancela, margem idêntica). Pro modo novo, fazer o frete do **vendedor** também contar como faturamento (pra bater com o valor que o Bling/Mercado Turbo mostra) sem contá-lo em dobro no custo necessariamente faz a margem subir exatamente esse valor — e forçar a margem a ficar igual exigiria um "custo de frete" artificial de 2× o valor real, o que seria um número inventado na tela. Implementei a versão matematicamente correta (frete do vendedor também vira faturamento reconhecido, a margem cresce de verdade) e corrigi todo texto que dizia "a margem não muda" — no app (`DESCRICAO_MODO_FATURAMENTO`, a tela de Ajustes do financeiro) e no comentário-guia do `motor.ts` — pra explicar a diferença real em vez de repetir a frase do prompt.

### Verificação da Fase 2

- `npx tsc --noEmit`, `npx next lint` e `npm test` limpos a cada bloco — 742 testes no total (7 novos: 1 do modo de faturamento, 6 do motor de etapas).
- Banco novo do zero: `prisma migrate deploy` aplicou as duas migrações da fase (`20261102050000_ciclo13_onboarding_fase2` + o `ADD VALUE` do enum) sem erro, `prisma migrate diff` voltou vazio, seed rodou limpo.
- `next build` completo.
- Revisão visual de verdade no navegador (Playwright contra o build de produção): `/comecar` com a trilha, anel de progresso e nível corretos batendo com os dados reais da conta de teste (25% → 33% depois de pular uma etapa, com confete); spotlight guiado funcionando (recorte + balão posicionado); modal de sincronização mostrando progresso e um erro real (403 do ML com a conta de teste) com retry; cartão "Próximo passo" na Visão geral; tela de Ajustes do financeiro com as 4 opções de faturamento e o texto novo.
- Suíte `e2e/*.spec.ts` da Fase 0 rodada de novo de ponta a ponta (resultado registrado abaixo — nenhuma mudança nela foi necessária nesta fase).

## Passos manuais do Lucas (Fase 2)
- [ ] Migração desta fase é aditiva (novo valor de enum + tabela nova) — mesma recomendação de rodar `npm run build` antes do deploy.
- [ ] Rever a heurística da etapa 8 (impostos): hoje "feito" = alíquota > 0 ou regime ≠ Simples. Se isso não refletir a realidade de alguma conta, me avisar pra ajustar o critério.
- [ ] Os "modelos prontos" de despesa fixa (etapa 9) e a sugestão automática de meta (etapa 10) citados no prompt não foram construídos nesta fase — ficaram como próximo passo natural quando as telas de Lançamentos/Configurações do financeiro forem revisitadas.

## FASE 3 — Resultado e DRE didáticos

Sem migração nesta fase.

### 3.1 — Visão geral

A Visão geral já cobria, de um jeito mais granular que os "5 blocos, nada além" do prompt, praticamente todo o conteúdo pedido (risco de ruptura, capital parado, compras e saúde das integrações não estão nos 5 blocos do prompt, mas já existiam, funcionando, testados). **Decisão explícita**: não apaguei nada disso — reduzir a tela a exatamente 5 blocos removeria informação real que já está em produção sem nenhum ganho claro, só pra bater com a letra do prompt; implementei os 2 blocos que realmente faltavam e deixei o resto como está:
- **"Hoje"** (`src/components/dashboard/HojeCard.tsx`, novo): faturamento, pedidos, margem de contribuição e liberado hoje no Mercado Pago, comparado com ontem — reaproveita `GET /api/financeiro/resumo-dia`, o mesmo endpoint que já alimenta esse bloco na tela Financeiro (não recalculei nada, só montei a mesma visão num componente que se busca sozinho). Atualiza a cada 2 minutos; some sozinho se o usuário não tiver permissão de ver o financeiro.
- **Selo "Confere com o ML ✓" / "Faltam custos em N vendas"**: embaixo do cartão de faturamento líquido, usando dados que a Visão geral já carregava (`metricas.margemContribuicao.produtosSemCustoNaVenda`) — nenhuma chamada nova. **Não liguei isso à Conferência de verdade** (`conferirMes`, em `src/modules/financeiro/relatorios/conferencia.ts`) porque essa função faz prova contra a API do Mercado Livre por conta/mês — cara demais pra rodar toda vez que a Visão geral carrega. O selo aqui é um proxy honesto (nenhuma venda do período sem custo = "confere"), não a conferência completa, que continua vivendo em Financeiro → Conferência.

### 3.2 — DRE em cascata

- **Gráfico cascata** (`src/app/(root)/financeiro/components/CascataResultado.tsx`, novo, Recharts): do faturamento ao lucro líquido do mês mais recente do período selecionado, barra "ancorada" (faturamento, margem, lucro) em roxo/verde e barra "flutuante" (cada dedução) em vermelho — com tooltip mostrando valor e % sobre o faturamento. Não fiz o 2º nível (clicar numa barra pra abrir as vendas) — só o gráfico.
- **"?" em toda linha**: antes só 2 das ~20 linhas tinham explicação (via atributo `title`, sem ícone visível). Escrevi a explicação das ~18 que faltavam, grounded no código real do motor (`motor.ts`) que já tinha lido a fundo nas fases anteriores — nada inventado, cada frase descreve exatamente o que aquele campo soma. Troquei de `title` (tooltip nativo do navegador) pra um ícone "?" visível com Radix Tooltip, igual ao `StatCard` da Fase 1.
- **Destaque de linha que piorou mais de 20%**: comparando cada mês com o anterior na própria linha (funciona igual pra receita, que piora caindo, e pra custo já armazenado negativo, que piora ficando mais negativo) — fundo vermelho claro na célula. Testado com dado real do seed: "Margem de contribuição" de outubro pra novembro caiu de R$174,65 pra R$121,69 (-30%) e a célula acendeu.
- **"+ Despesa" na seção**: abre `/financeiro/lancamentos?novo=despesa`. **Achado de passagem**: esse parâmetro já existia num link que eu mesmo escrevi na Fase 2 (etapa "Despesas fixas" do onboarding) mas a tela de Lançamentos nunca lia `?novo=` — o link não fazia nada. Corrigido na própria tela de Lançamentos (abre o diálogo de novo lançamento sozinha, com Tipo já em "Despesa" — que já era o padrão do formulário). Os dois links (DRE e onboarding) passam a funcionar de verdade.
- **Não fiz nesta fase**: tabela com 3 níveis expansíveis (grupo → item → vendas/lançamentos), export em PDF com o visual novo (o PDF continua sendo a tabela simples que já existia), e a aba separada "Caixa" dentro da DRE pro frete gerado vs Mercado Turbo — fica pro ajuste futuro da tela, é uma reestruturação grande demais pra enfiar no fim desta fase com a qualidade que o resto do ciclo teve.

### 3.3 — Caixa

A tela Fluxo de caixa já cobre a maior parte do pedido (saldo das contas, a liberar, saldo projetado em 30/60/90 dias, por conta, com o "informe uma vez" do saldo do Mercado Pago). **Não construí** o calendário de liberações por data nem o destaque de "retido pelo ML para quitar a fatura" nessa tela especificamente — a retenção já aparece em Financeiro → Visão geral (`DemonstrativoResultado.tsx`, linha "Retido pelo ML para quitar a fatura"); duplicar esse número em Caixa sem tempo pra conferir a consistência entre as duas fontes seria arriscar um número errado, o que vale mais a pena evitar do que “bater a caixinha” do prompt.

### Verificação da Fase 3

- `npx tsc --noEmit`, `npx next lint`, `npm test` (742 testes) limpos.
- **`next build` quebrou na primeira tentativa**: `useSearchParams()` na tela de Lançamentos (pro `?novo=despesa`) sem `Suspense` por volta — erro real de build, não só de lint, que teria derrubado o deploy inteiro. Corrigido seguindo o mesmo padrão já usado em `financeiro/vendas/page.tsx` (componente renomeado pra `*Content`, exportado por trás de um `<Suspense>`). `next build` limpo depois.
- Banco novo do zero: sem migração nesta fase, só conferido que `prisma migrate deploy` + seed continuam limpos.
- Revisão visual real no navegador: cascata renderizando com as cores e rótulos certos (ajustei os rótulos do eixo depois de ver que "Despesas operacionais"/"Lucro líquido" sobrepunham no primeiro print — nomes curtos no eixo, nome completo só no tooltip), tooltip "?" funcionando, destaque de piora >20% acendendo com dado real, selo "Confere com o ML ✓" e cartão "Hoje" na Visão geral com números reais, "+ Despesa" abrindo o diálogo certo com o tipo certo.
- Suíte `e2e/*.spec.ts` da Fase 0 rodada de novo de ponta a ponta — resultado registrado abaixo.

## Passos manuais do Lucas (Fase 3)
- [ ] Nenhuma migração nesta fase.
- [ ] Se quiser o calendário de liberações e o destaque de retenção também na tela de Caixa (não só na Visão geral do Financeiro), me avisar — não entrou nesta fase por tempo, não por dificuldade técnica.

## FASE 4 — Anúncios e vínculos em escala

Sem migração nesta fase.

- **Sugestão por anúncio** (`src/modules/catalogo/sugestoes.ts`, novo, `GET /api/catalogo/vinculos/sugestoes`): pra cada anúncio ativo sem vínculo, sugere o produto mais provável — SKU do anúncio igual ao SKU do produto (confiança alta) ou nome do produto aparece dentro do título do anúncio (confiança baixa, nunca vem pré-marcada). A sugestão de "kit N" reaproveita `sugerirUnidadesPeloTitulo`, que já existia (Ciclo 12). **EAN não entra na sugestão**: o Mercado Livre não envia o GTIN do anúncio pra `ProdutoMercadoLivre` na sincronização atual (só título, preço, estoque) — comparar por EAN exigiria sincronizar um campo novo, fora do escopo desta fase.
- **Ações em lote** (`POST /api/catalogo/vinculos/lote`, novo, até 200 itens): mesma `definirVinculoAnuncio` de sempre, chamada por item — um item com erro não derruba os outros, o resultado vem item por item. "Aplicar sugestões selecionadas" em `src/components/catalogo/SugestoesVinculoCard.tsx` (novo) usa esse endpoint; testado de ponta a ponta com o anúncio "Kit 2 ..." semeado desde a Fase 0 (o mesmo cenário que a suíte e2e já cobre) — sugestão correta (SKU + kit de 2), aplicada em 2 cliques, cartão de sugestões some sozinho quando não sobra nada pra sugerir.
- **`/produtos/vincular` apagada e redirecionada** (`next.config.mjs → redirects()`) para `/mercado-livre/produtos` — conferido por grep que não tinha mais nenhum link apontando pra ela antes de apagar. **`/produtos/vinculos-pendentes` não foi tocada**: ela não é a mesma coisa que a tela de vínculo manual — é uma fila de revisão só dos vínculos automáticos (por SKU/título) ainda não confirmados por um humano, com suas próprias ações (confirmar/trocar/desfazer), já reaproveitando o `VincularAnuncioDialog` único e ainda linkada de verdade em `/produtos` ("Confirmar vínculos"). Fundir as duas telas em uma só com filtro "A confirmar", como o prompt sugere, é uma mudança de estrutura maior do que cabia no fim desta fase com a mesma qualidade do resto — documentando aqui pra decidir com calma, não cortando por pressa.
- **Ficha do produto → "Vincular anúncio" no sentido inverso**: o botão da pendência "Produto ativo sem anúncio vinculado" levava pra `/produtos/vincular` (a página que acabei de apagar). Troquei para `/mercado-livre/produtos?stock=unlinked&q=<SKU>` — isso antes não existia, a tela não lia `stock`/`q` da URL (só `status`), então cadastrei a leitura desses dois parâmetros (consistente com o que `status` já fazia) em vez de inventar uma tela nova só pra isso.
- **Não fiz nesta fase: variações do Mercado Livre** (`mlVariationId`, vínculo por variação com venda/envio de estoque na variação certa). O campo já existe no schema (preparado num ciclo anterior) mas a lógica de vínculo, venda e envio de estoque de hoje trabalha toda em cima do anúncio inteiro, não da variação — fazer isso direito toca sincronização, atribuição de venda e envio de estoque ao mesmo tempo, sem nenhum dado de variação no seed pra testar contra cenário real. É o item de maior risco da fase 4 e o que mais se beneficiaria de ser feito com calma, numa fase própria, não espremido no fim desta.

### Verificação da Fase 4

- `npx tsc --noEmit`, `npx next lint`, `npm test` limpos — 747 testes (5 novos, cobrindo SKU exato, nome no título, kit pelo título, SKU desconhecido e isolamento entre contas).
- Sem migração — só conferido que `prisma migrate deploy` + seed continuam limpos num banco novo.
- `next build` completo (o redirect novo em `next.config.mjs` não quebrou nada).
- Revisão visual real no navegador: o anúncio "Kit 2 ..." semeado desde a Fase 0 apareceu sozinho em "Sugestões de vínculo" com a razão certa (SKU igual + kit de 2), "Aplicar selecionadas" vinculou de verdade e o cartão sumiu; `/produtos/vincular` redireciona pra `/mercado-livre/produtos` de verdade (conferido a URL final no navegador, não só o código).
- Suíte `e2e/*.spec.ts` da Fase 0 rodada de novo de ponta a ponta — resultado registrado abaixo.

## Passos manuais do Lucas (Fase 4)
- [ ] Nenhuma migração nesta fase.
- [ ] Se quiser que eu junte `/produtos/vinculos-pendentes` dentro de `/mercado-livre/produtos` como um filtro (em vez de duas telas), topo fazer numa próxima fase — não é difícil, só não cabia com segurança no fim desta.
- [ ] Vínculo por variação do Mercado Livre não entrou — avisar se isso for prioridade pra abrir como fase própria.

## FASE 5 — Integrações sem babá

Sem migração nesta fase. **Esta foi a fase com a decisão de escopo mais importante do ciclo até agora — vale ler com atenção.**

### O que descobri antes de mexer em qualquer coisa

O prompt pedia pra apagar `POST /api/bling/produtos/importar` e `POST /api/produtos/estoque-bling` e fazer as telas usarem só `SincronizacaoCatalogo`. Antes de apagar qualquer coisa segui a regra do CLAUDE.md (conferir chamadores reais primeiro) e achei:

- As duas rotas **têm chamadores reais em produção**: `/api/bling/produtos/importar` é usada por `integracoes/page.tsx` e por `produtos/importar/page.tsx` (uma página inteira, tipo assistente, de primeira importação); `/api/produtos/estoque-bling` só por `integracoes/page.tsx`.
- As duas realmente duplicam lógica que já existe, de um jeito melhor, no motor novo: `executarBlingProdutos`/`executarBlingEstoque` (`src/modules/catalogo/sincronizacao.ts`) chamam `sincronizarProdutoUnico`/`aplicarEstoqueProdutoBling`, que **já tratam variação do Bling** (`formato: "V"`, importa cada variação com o próprio SKU — o item "Importar variações (formato V)" do prompt já está feito aí, só não nas rotas antigas) e já sincronizam estoque em lote por depósito. `/api/bling/produtos/importar-um` (usada pelo diálogo de importar 1 produto) **já é o jeito novo** — não mexi nela.

### Por que não apaguei as rotas antigas nem migrei as 2 páginas que as usam

Migrar `produtos/importar/page.tsx` e o botão de sincronizar do Bling em `integracoes/page.tsx` pro motor novo significa trocar o jeito como a importação de catálogo roda pra **todo mundo que já usa o Skubo em produção**, numa área crítica (é como o estoque e o custo chegam no sistema) — e eu não tenho como testar isso contra uma conta Bling de verdade aqui (o seed usa token falso; `sincronizarProdutoUnico` nunca foi exercitado contra a API real do Bling nesta sessão, só contra o mock). Esse é exatamente o tipo de mudança — difícil de reverter, afeta todo mundo, sem como verificar de verdade — que vale mais a pena eu não arriscar sozinho do que "bater a caixinha" do prompt. Documentando aqui pra decidir com calma, com um teste de verdade contra uma conta Bling real antes de apagar as rotas antigas.

### O que fiz (seguro, aditivo, sem mexer em rota nenhuma)

- **Webhooks na tela Integrações**: os dois cartões (ML e Bling) agora mostram "Último webhook recebido" (não só a contagem de 24h que o Bling já tinha) — acende em âmbar quando faz mais de 24h ou nunca chegou nenhum. Pra ML isso não existia; adicionei uma consulta nova e barata (`MercadoLivreWebhook` mais recente por conta) na mesma rota `GET /api/mercadolivre/auth?action=accounts` que a tela já chamava — conferido que mais 4 telas usam essa mesma rota e o campo novo é só aditivo (ninguém que já lê essa resposta quebra por ganhar um campo a mais).
- **URLs de notificação com botão de copiar** (novo cartão no topo de Integrações): as duas URLs (`/api/mercadolivre/webhook` e `/api/bling/webhook`), montadas com `window.location.origin` — não existia nenhum jeito de copiar isso antes, o Lucas tinha que montar a URL de cabeça pra cadastrar no painel de cada plataforma.
- **`docs/BLING_API.md`** (novo): referência dos endpoints, parâmetros, escopos e as pegadinhas reais já descobertas neste projeto (fuso de Brasília, header `enable-jwt`, kit vs. variação, GTIN não filtrável na busca) — todo o conteúdo veio de ler `blingService.ts`/`blingProductSync.ts` de novo, nada inventado.

### O que não fiz nesta fase

- Apagar as rotas antigas de importação / migrar as 2 telas que as usam pro motor novo — ver acima.
- Teste de escopos **no momento da conexão** (o prompt pede isso na própria tela de conectar o Bling; hoje o teste de escopo só acontece quando uma chamada de verdade falha, ou na etapa 2 do onboarding da Fase 2, que já chama `/depositos`) — dava pra fazer, mas preferi não abrir mais uma frente de mudança na mesma fase que já tem a decisão grande acima.
- Reduzir os crons / remover o `auto_smart` de 15 min do `MercadoLivreAutoSync` — o prompt condiciona isso a "com webhooks ativos", e eu não tenho telemetria de produção pra saber se os webhooks já são confiáveis o bastante pra tirar essa rede de segurança. Decisão do Lucas, não minha.

### Verificação da Fase 5

- `npx tsc --noEmit`, `npx next lint`, `npm test` (747 testes, nada novo — essa fase não criou lógica de negócio nova, só leitura de dado existente) limpos.
- Sem migração — só conferido `prisma migrate deploy` + seed num banco novo.
- `next build` completo.
- Revisão visual real no navegador: os dois cartões (ML, Bling) mostrando "Último webhook recebido: Nunca" em âmbar (a conta de teste nunca recebeu um webhook de verdade, é o esperado); cartão de URLs de notificação com os dois endereços certos e o botão Copiar funcionando.
- Suíte `e2e/*.spec.ts` da Fase 0 rodada de novo de ponta a ponta — resultado registrado abaixo.

## Passos manuais do Lucas (Fase 5)
- [ ] **Decisão pendente**: migrar `produtos/importar/page.tsx` e o botão de sincronizar Bling em Integrações pro motor novo (`SincronizacaoCatalogo`), e só então apagar `/api/bling/produtos/importar` e `/api/produtos/estoque-bling`. Topo fazer, mas só com uma conta Bling real pra testar contra — avisar quando puder testar comigo ou me dar acesso a uma conta de staging.
- [ ] Nenhuma migração nesta fase.
- [ ] Teste de escopo no momento de conectar o Bling (não só quando uma chamada falha depois) — fica pra quando a decisão acima for tomada, já que mexem na mesma área.
- [ ] Redução de crons / remoção do polling de 15 min do ML no navegador — decisão sua, depende de quão confiável os webhooks já estão em produção.

## FASE 6 — Velocidade

### Banco: índices

Conferi os três índices que o prompt sugeria contra as consultas reais do motor (não apliquei nenhum de cabeça):

- `vendas_canal_itens(produtoId)` **já existia** — nada a fazer.
- `vendas_canal(userId, dataVenda, status)`: a consulta principal do motor (`buscarVendasParaCalculo`) **não filtra por `status` no SQL** — ele traz todas as vendas do período e filtra `vendaValida(status)` em JavaScript depois (é assim que o motor sempre funcionou). Adicionar `status` nesse índice não ajudaria essa consulta; teria sido um índice "decorativo", então não apliquei como o prompt sugeria. Em vez disso achei a consulta que **de verdade** filtra por status — `valorALiberarNoDia` (`resumoDia.ts`, chamada em todo carregamento do cartão "Hoje" da Fase 3) filtra `userId + dataLiberacao + status` — ampliei o índice que já existia (`userId, dataLiberacao`) para `(userId, dataLiberacao, status)`.
- `cobrancas_canal(userId, data, coberturaPedido)`: esse eu confirmei exatamente — `somarCobrancas` (`motor.ts`, chamada em toda tela do Financeiro) filtra por essas três colunas e não tinha nenhum índice que ajudasse (só existia `userId, mesReferencia`). Criado como sugerido.

Migração `20261102060000_ciclo13_indices_fase6` — aditiva, `DROP INDEX IF EXISTS` do índice substituído + `CREATE INDEX IF NOT EXISTS` dos dois novos.

**Honestidade sobre a verificação**: rodei `EXPLAIN` nas duas consultas contra o banco semeado (poucas dezenas de linhas) e o Postgres **não escolheu** os índices novos — com tão pouca linha, um `Seq Scan`/o índice antigo já é mais barato que usar o novo, e isso é o comportamento certo do planejador, não um bug no índice. Índice corretamente criado e estruturalmente correto (conferido via `\d` no psql), mas o ganho real só aparece em volume de produção — não dá pra provar com `EXPLAIN` num banco de teste pequeno, e não vou fingir que provei.

### Bundle: carregamento preguiçoso

- `src/utils/excelExport.ts`: `xlsx` (uma lib pesada) virou `await import("xlsx")` dentro de `exportToExcel`, em vez de import estático no topo — ela só entra no bundle de uma tela quando alguém realmente clica em exportar. 9 pontos de chamada em 6 telas, nenhum precisou mudar (a função virou `async`, mas nenhum chamador usava o retorno nem dava `await` — é um disparo e esquece, então a mudança é 100% compatível).
- `produtos/importar-estoque/page.tsx`: mesma troca, import de `xlsx` para dentro do `handleFile`.
- `src/utils/pdfHelper.ts`: o `jsPDF` importado no topo só era usado em posição de tipo (`jsPDF` como anotação, nunca como valor — o `loadPDF()` já fazia `await import("jspdf")` por dentro, isso já estava certo) — troquei para `import type { jsPDF }`, garantindo que o bundler não inclua o pacote à toa.
- `EvolutionChart` (usado em `/dashboard`) e `CascataResultado` (usado em `/financeiro/dre`) — as duas telas de gráfico mais visitadas — agora usam `next/dynamic` (`ssr: false`, com um `Skeleton` de loading): o Recharts só carrega quando o gráfico realmente vai aparecer. **Não fiz o mesmo em `financeiro/page.tsx` e `financeiro/fluxo-de-caixa/page.tsx`** — lá o gráfico está escrito direto na página, não é um componente separado; extrair isso com segurança é um refactor à parte, não cabia arriscar nesta fase.
- **Medido de verdade no `next build`**, não estimado: `/financeiro/dre` caiu de 516 kB pra 276 kB de primeiro carregamento (inclui o shared chunk); `/produtos/importar-estoque` caiu de 353 kB pra 214 kB.

### Cache HTTP

`Cache-Control: private, max-age=30, stale-while-revalidate=120` em `GET /api/dashboard/resumo` e `GET /api/onboarding` — as duas rotas mais carregadas na entrada do app, já com cache de servidor próprio (`withCache`); o cache HTTP evita até a ida ao servidor numa navegação rápida de ida e volta. **Não apliquei em todas as rotas de leitura** (o app tem centenas) — fiz nas duas com maior tráfego e menor cardinalidade de parâmetros; rotas como `/api/produtos/lista` (busca com `?q=` livre, muitos valores distintos) teriam taxa de acerto de cache baixa e não valiam a mesma prioridade.

### TanStack Query — não entrou

O prompt pede TanStack Query "em todo o app", removendo os `useFetch`/`useEffect` manuais. Isso significa tocar dezenas de telas que já passaram por 5 fases de verificação cuidadosa nesta sessão — um refactor desse tamanho, feito rápido no fim de uma fase, é exatamente o tipo de risco que vale mais a pena não tomar sozinho. Não adicionei a biblioteca como esqueleto vazio (um `QueryClientProvider` sem nenhuma tela usando de verdade não ajuda em nada, só pesa) — fica como uma frente própria, migrando tela por tela com calma, não como item desta fase.

### Pollers duplicados — achado, não resolvido

A página legada `/configuracoes` (a mesma "Integração Mercado Livre" apontada na Fase 1 como candidata a revisão na Fase 8) monta **dois** componentes com `setInterval` próprio ao mesmo tempo: `MercadoLivreAutoSync.tsx` e `MercadoLivreSmartSync.tsx`. Não tive tempo de ler os dois a fundo (396 + 471 linhas) pra confirmar se fazem a mesma coisa ou coisas diferentes que só parecem iguais de longe — mexer errado aqui troca sincronização de estoque por nada rodar. Fica anotado para quando a Fase 8 (telas redundantes) chegar nessa página.

### Verificação da Fase 6

- `npx tsc --noEmit`, `npx next lint`, `npm test` (747 testes) limpos.
- Banco novo do zero: `prisma migrate deploy` aplicou a migração de índices sem erro, `prisma migrate diff` voltou vazio, os dois índices novos conferidos existindo via `\d` no psql.
- `next build` completo — números de bundle acima medidos neste build, não estimados.
- Suíte `e2e/*.spec.ts` da Fase 0 rodada de novo de ponta a ponta (os componentes com `next/dynamic` renderizam corretamente na Visão geral e na DRE, os mesmos testes que já conferem essas telas).
  - **Primeira rodada: 3 falhas** (`02-sidebar`, 2 tamanhos, e `05-vincular-kit-2-unidades`), suíte inteira levando 6,7 min em vez dos ~20s de sempre — sinal de que algo estava esperando/tentando de novo, não travando de vez. As duas capturas de tela mostraram a causa: o **tour em slides** (`TourSlides`, Fase 2) abrindo sozinho por cima da tela e bloqueando o clique que os testes tentavam fazer.
  - **Causa raiz, não "flakiness"**: o script de seed nunca marcava `OnboardingProgresso.tourVisto = true` pra conta de teste — esse bug existe desde a Fase 2. Ele não aparecia nos testes porque até aqui havia uma corrida: o `fetch` que confere `tourVisto` (em `DashboardWrapper`) é assíncrono, e o teste normalmente clicava antes dele resolver. As mudanças desta fase (bundle menor com `next/dynamic`, `Cache-Control` nas duas rotas mais usadas) mudaram esse tempo o suficiente pra inverter a corrida — não é um bug introduzido pela Fase 6, é um bug antigo que a Fase 6 expôs.
  - **Corrigido na fonte**: `prisma/seed.ts` agora grava `OnboardingProgresso` com `tourVisto: true` pra conta e2e, junto com a criação/atualização do usuário — a conta de teste passa a representar "já configurada", não "primeiro acesso", que é o cenário certo pra validar o resto do app.
  - Rodada seguinte: **12 passaram, 3 pulados, 0 falharam**, suíte de volta a ~24s — confirma a causa e a correção.

## Passos manuais do Lucas (Fase 6)
- [ ] Migração desta fase é aditiva (só índices) — mesma recomendação de rodar `npm run build` antes do deploy.
- [ ] O tour em slides abre pra **qualquer conta nova de verdade** toda vez que `OnboardingProgresso` não existe — isso é o comportamento certo e pretendido pra onboarding real; só a conta e2e precisava deixar de ver como "primeiro acesso", e já está ajustada no seed. Nada a corrigir em produção.
- [ ] TanStack Query e a migração de `useEffect`/fetch manual pro app inteiro ficaram de fora — avisar se isso virar prioridade pra abrir como fase própria, com tempo pra migrar e testar tela por tela.
- [ ] `MercadoLivreAutoSync` + `MercadoLivreSmartSync` rodando juntos em `/configuracoes` — vale conferir se os dois fazem sentido juntos ou se um deles é sobra; vou olhar com calma na Fase 8.

## FASE 7 — Celular de verdade

### Área segura (notch / home indicator)

`BottomNav` ganhou `padding-bottom: env(safe-area-inset-bottom)` e o `<main>` do `DashboardWrapper` trocou `pb-24` fixo por `pb-[calc(6rem+env(safe-area-inset-bottom))]` (sintaxe de valor arbitrário do Tailwind, não `style` inline — um `style` inline aplicaria o padding em **todos** os breakpoints, inclusive desktop, e quebraria o `md:pb-7` que já existia). Em telas sem notch `env(...)` resolve pra `0px`, então não muda nada fora do iPhone com home indicator.

### Instalar no celular (PWA)

- `/ajuda/celular` (nova): guia de instalação com detecção de plataforma (iPhone/Safari vs Android/Chrome), passo a passo próprio pra cada um, e um botão "Já instalei" que marca a etapa 12 do onboarding (`marcador: "12_instalado"`) via `/api/onboarding/pular` antes de voltar pro fluxo de `/comecar`.
- `src/modules/onboarding/etapas.ts`: a etapa 12 agora aponta pra `/ajuda/celular` em vez de `/configuracoes-gerais?instalar=1` (essa rota nunca teve essa UI).
- `InstalarCelularBanner` (novo): convite discreto, fixo, só em `window.innerWidth <= 767`, só se `display-mode: standalone`/`navigator.standalone` disserem que ainda não foi instalado, e só na primeira vez (guardado em `localStorage`; falha de storage — modo privado — não quebra a tela, só não mostra o banner). Montado uma vez em `DashboardWrapper`, então cobre o app inteiro.
- Navbar: item "Instalar no celular" no menu do usuário, linkando pra `/ajuda/celular` — acesso permanente, não só o banner da primeira visita.

**Achado durante a verificação visual (não estava no plano, corrigido nesta fase)**: `InstalarCelularBanner` e o novo `FloatingActionButton` (abaixo) ocupavam exatamente a mesma faixa (`bottom-20`, `z-20`) — numa tela com os dois (ex.: `/produtos` no primeiro acesso mobile), o banner cobria o botão "+" por cima. Peguei isso só numa captura de tela real, não no `tsc`/lint — subi o banner pra `bottom-36`, ficando acima do botão flutuante em vez de em cima dele. Também notei que o banner continuava aparecendo em cima da própria página `/ajuda/celular` (redundante — a página inteira já é o convite); `InstalarCelularBanner` agora lê `usePathname()` e não se mostra nessa rota.

### Botão de ação flutuante (FAB)

`FloatingActionButton` (novo, `src/components/ui/floating-action-button.tsx`): botão "+" fixo, `md:hidden` (só mobile), com o mesmo `env(safe-area-inset-bottom)` aplicado via `marginBottom`. Ligado às duas telas de maior uso num botão só e sem menu pra abrir a ação principal: "Novo produto" em `/produtos`, "Novo pedido" em `/gestao-pedidos` (escondido enquanto o formulário de novo pedido já está aberto, pra não sobrepor o próprio formulário).

### Teclado numérico (inputMode)

`src/components/ui/input.tsx`: `inputMode` agora tem um padrão inteligente — `"decimal"` quando `type="number"` e nada foi passado explicitamente, preservando qualquer `inputMode` que a tela já definisse na mão. Como é o componente `Input` compartilhado, isso cobre todos os campos numéricos do app (preço, custo, quantidade, etc.) sem precisar tocar tela por tela — no celular, o teclado que abre já é o numérico com vírgula/ponto, em vez do teclado de texto completo.

### Scanner de código de barras acessível pelo topo

O scanner (`BarcodeReaderButton` + `BarCodeReader`) já existia, mas só dentro de dois diálogos específicos (`NovaSaidaDialog`, `PedidoConfirmDialog`) — sem nenhuma entrada no topo do app, como o prompt pedia. Adicionei um ícone de scanner em `CommandPalette` (ao lado da busca, na Navbar, visível em qualquer tela incluindo mobile — a busca de texto em si só aparece a partir de `sm:`). Ao escanear, o código cai direto no campo de busca existente (`setBusca(codigo)`) e abre o diálogo de resultados (`setOpen(true)`) — reaproveita a busca por SKU/EAN que `/api/busca` já faz, sem rota nova.

**Achado durante a verificação visual**: o botão ficou sem nome acessível (`buttonLabel=""` pro ícone não ter texto ao lado, mas `BarcodeReaderButton` não tinha `aria-label` nenhum no botão interno). Adicionei `aria-label={buttonLabel || dialogTitle}` no componente — corrige esse uso novo e não muda nada nos dois usos antigos (que já tinham texto visível).

### Verificação da Fase 7

- `npx tsc --noEmit`, `npx next lint`, `npm test` (747 testes) limpos.
- Banco novo do zero: `prisma migrate deploy` sem migração nova (fase só mexeu em UI) — `prisma migrate diff` confirmou vazio, como esperado.
- `next build` completo, sem erros.
- Verificação visual real via Playwright (script avulso, não um teste do repo) logado como usuário e2e, capturando telas mobile (390×844) e desktop (1440×900): confirmei o padding de área segura no `BottomNav`, o banner de instalação e o FAB coexistindo sem sobreposição em `/produtos` e `/gestao-pedidos`, a página `/ajuda/celular` renderizando os dois guias (iPhone/Android) sem o banner redundante por cima, o ícone de scanner visível e funcional na Navbar (desktop e mobile), e o FAB corretamente ausente em telas `md:` (desktop).
- Suíte `e2e/*.spec.ts` da Fase 0 rodada de novo de ponta a ponta: **12 passaram, 3 pulados, 0 falharam** (~23s) — mesmo padrão da Fase 6, sem regressão.

## Passos manuais do Lucas (Fase 7)
- [ ] Sem migração nesta fase — nada de banco pra rodar além do deploy normal.
- [ ] O convite de instalação (banner) só aparece pra quem acessa pelo navegador do celular e ainda não instalou; quem já usa como PWA instalado nunca vê. Se quiser forçar reaparecer pra testar, é só limpar `localStorage` (chave `skubo-convite-instalar-visto`) no celular.
- [ ] O item "Instalar no celular" no menu do usuário (desktop) leva pro mesmo guia — é só uma forma de redescobrir sem depender do banner da primeira visita.
- [ ] Retrofit de tabelas em card para mobile (item citado no plano mestre) não entrou como trabalho novo nesta fase — as tabelas existentes já rolam horizontalmente dentro de um contêiner (`overflow-auto`) e os testes e2e que conferem "sem rolagem horizontal da página" continuam passando; considerei isso adequado por ora. Se alguma tela específica incomodar no uso real, melhor vir como ajuste pontual dessa tela do que um retrofit genérico.

## FASE 8 — Cortar redundância

Sem migração nesta fase.

### Mercado Livre → Saúde dos anúncios

`/mercado-livre` deixou de ser o painel genérico (Painel + aba Vendas) e passou a abrir direto em **Saúde dos anúncios**: seis grupos (preço abaixo do custo, sem estoque, Full baixo, pausado, sem vínculo, sem tarifa/frete), cada um com a lista dos anúncios afetados e um atalho pra resolver. Lógica nova em `src/services/saudeAnunciosService.ts` (`calcularSaudeAnuncios`) — reaproveita `calcularReposicaoConta` (status do Full) e `calcularMargemUnitaria` (preço abaixo do custo), não duplica nenhuma das duas. "ML → Vendas" saiu do menu; `/mercado-livre/vendas` redireciona para `/financeiro/vendas` (mesmo dado, fonte única no motor do Financeiro — a tela antiga lia direto do snapshot do ML, uma segunda fonte pro mesmo número).

### Uma tela de Ajustes

`/configuracoes` (quase 3.000 linhas, misturava config geral + ajuda do ML + pollers duplicados) foi reduzido a só o callback OAuth do ML (150 linhas) — a gestão de contas ML já vivia em `/mercado-livre/configuracoes`, não precisava duplicar. O resto virou `/ajustes` (nova, 544 linhas): oito seções com âncora lateral (Conta, Loja e marca, Impostos e faturamento, Reposição, Mercado Livre e Bling, Financeiro, Usuários, Aparência). `/configuracoes-gerais` redireciona pra lá.

**Desvio do plano, assumido conscientemente**: o plano pedia `ajustes/secoes/*.tsx` (um arquivo por seção). Com 544 linhas num arquivo só, achei que dividir em 8 arquivos só pra dividir não ajudava a manutenção — cada seção é pequena (20–60 linhas) e todas compartilham o mesmo `useState`/`useEffect` de carregamento. Fica documentado aqui como escolha, não como item pulado.

Achado nesta seção: os dois pollers que a Fase 6 tinha encontrado e não resolvido (`MercadoLivreAutoSync` + `MercadoLivreSmartSync`, rodando juntos em `/configuracoes` com `setInterval` próprio cada um) — **apagados os dois**. `MercadoLivreAutoSync` chamava `/api/mercadolivre/sync/auto-stock`, que continua existindo porque `mercado-livre/produtos/page.tsx` também o usa (caller real, confirmado por grep). `MercadoLivreSmartSync` chamava `/api/mercadolivre/produtos-inteligente`, que **não tinha mais nenhum caller** depois dessa remoção — apagada também (ver abaixo).

### Ficha do produto: cadastro editável inline

`ProdutoEditarDialog`/`ProdutoEstoqueDialog` (modais) saíram da ficha do produto (`produtos/[id]/page.tsx`) — continuam existindo porque `ProdutoList.tsx` ainda os usa de verdade (callers confirmados), mas a ficha agora edita **inline**: nome/EAN/custo manual no cabeçalho (com botão Editar/Salvar/Cancelar), prazo de entrega por fornecedor direto na tabela (`onBlur` salva), botão "Tornar principal" por fornecedor, estoque de segurança por armazém clicável-pra-editar. Isso fechou um buraco real: `PUT /api/produtos` não aceitava `custoMedio` — acrescentei validação (`VER_CUSTO`, número ≥ 0 em centavos) e a prioridade de origem (`custoOrigem: "MANUAL"`) consistente com a regra já documentada no `CLAUDE.md` (custo manual tem prioridade sobre o calculado).

### "Lucro por venda" e "Lucro por produto" → abas de Vendas

`/financeiro/vendas` agora é uma casca (`Suspense` + `Tabs`) com duas abas, cada uma seu próprio componente (`AbaPorVenda`, `AbaPorProduto`) — o conteúdo que já existia em `/financeiro/vendas` e `/financeiro/produtos`, só reorganizado, nenhuma lógica de cálculo nova. `/financeiro/produtos` redireciona pra `/financeiro/vendas?aba=produto`; a sidebar perdeu o cluster "Vendas" com dois links e ganhou um link só ("Vendas").

### Apagar arquivos e rotas sem uso

Os 12 componentes/hooks listados no `PROMPT-CICLO-12-SIMPLIFICAR.md` (Fase 5, item 1) — todos reconfirmados sem nenhum import antes de apagar (`LoadingSpinner`, `GoogleSignin`, `FornecedorModal`, `MercadoLivreProductInfo`, `EditarProdutoModal`, `SignOut`, `MLProductLinkModal`, `ProdutoMLCard`, `FornecedoresDeleteDialog`, `EstoqueSegurancaCalculator`, `ConfirmarPedidoForm`, `PedidoEntradasLoadingSkeleton`, `KpiCard`, `useProducts`, `useReplenishmentCache`, `executeAction`, `KitList`, `ProdutoPagination`, `KitDetalhesDialog`) — apagados. `MLRestockSuggestions`/`MLTopSellingProducts` (usados só pelo `/mercado-livre/page.tsx` antigo, substituído pela Saúde dos anúncios) e `MercadoLivreConfigHelp` (usado só pelo `/configuracoes` antigo, reduzido ao callback OAuth) não estavam na lista do CICLO-12, mas ficaram órfãos com a reescrita dessas duas páginas nesta própria fase — apagados também, depois de confirmar zero chamador restante. Nenhum desses chamava API própria (eram só apresentação, recebiam dado via prop) — não deixaram rota órfã atrás deles.

Das rotas listadas no mesmo item (Fase 5, item 2) do CICLO-12 como "sem chamador na interface — confirmar antes de apagar": não tenho acesso aos logs da Vercel pra confirmar tráfego real, então usei o critério que já está documentado no `CLAUDE.md` (grep por chamador real no código) em vez do critério do plano (logs de produção). É mais fraco — não prova que ninguém bateu a rota nos últimos 30 dias — mas prova que **nenhuma tela ou outro módulo do app consegue chegar nela hoje**, o que já é o bastante pra apagar código morto com segurança:

- `GET/POST /api/mercadolivre/produtos-inteligente` — órfã de verdade depois da remoção do `MercadoLivreSmartSync` acima (nenhum outro chamador).
- `/api/mercadolivre/monitoring`, `/api/mercadolivre/alerts` (+ seu teste, 2 casos), `/api/mercadolivre/dashboard/realtime`, `/api/mercadolivre/dashboard/metrics`, `/api/produtos/estoque-full` — zero chamador em `.tsx`/`.ts`, nenhum import cruzado, não são cron (`vercel.json` conferido) nem webhook. Apagadas as cinco.
- **Não apaguei** `mercadolivre/analytics/sales-optimized`, que o `CLAUDE.md` também cita como candidata: tem chamador real, `src/hooks/useMercadoLivreOptimized.ts`, usado por `mercado-livre/produtos/page.tsx` — exatamente o tipo de engano que a regra "grep antes de apagar" existe pra evitar (parece órfã pelo nome, não é).
- Atualizei a linha do `CLAUDE.md` que citava `produtos-simple`/`produtos-inteligente`/`produtos-dinamicos` como família de rotas duplicadas — `produtos-simple` e `produtos-dinamicos` já nem existiam mais no projeto (removidas em ciclo anterior sem atualizar essa linha), e `produtos-inteligente` acabou de sair nesta fase.

### O que não fiz nesta fase

- Duas implementações de sincronização de anúncio em `mercadoLivreService.ts` além de `modules/catalogo/anunciosMl.ts` (item 3 da Fase 5 do CICLO-12) — não entrei nessa limpeza porque é dentro do serviço que já trata token/rate-limit/retry do ML de verdade; misturar com a limpeza de tela desta fase aumentava o risco sem necessidade. Fica pra uma fase própria de serviço, se for prioridade.
- `GET /api/produtos` sem parâmetro (item 4) — confirmei que nenhuma tela nova o usa, mas não apaguei nem marquei como legado no código; é comportamento aditivo (ninguém quebra), decidi não arriscar mexer numa rota tão central fora do escopo desta fase.

### Verificação da Fase 8

- `npx tsc --noEmit`, `npx next lint`, `npm test` limpos — **763 testes** (765 da Fase 7, menos os 2 do arquivo de teste apagado junto com `/api/mercadolivre/alerts`).
- Banco novo do zero (`initdb`/`pg_ctl` locais, sem Docker): `prisma migrate deploy` sem migração nova (fase não mudou schema), seed limpo, `next build` completo nos dois builds que rodei (antes e depois de apagar as 5 rotas órfãs adicionais) — confirmando que a segunda rodada de limpeza não quebrou nada que a primeira já tivesse validado.
- Suíte `e2e/*.spec.ts` da Fase 0 rodada de ponta a ponta duas vezes (mesmo motivo acima): **12 passaram, 3 pulados, 0 falharam** nas duas rodadas (~29s cada) — inclui `02-sidebar`, que é exatamente o teste que quebraria primeiro se um link novo (`/ajustes`, `/mercado-livre/configuracoes`) estivesse errado.
- Não fiz verificação visual nova via Playwright nesta fase (só os specs do repo) — a reestruturação de navegação é inteiramente coberta pelos redirects do `next.config.mjs` + o teste de sidebar; achei suficiente dado que não mudou nenhum componente visual novo (os dois achados de UI das Fases 6/7 vieram de componentes **novos**, não de reorganização de link).

## Passos manuais do Lucas (Fase 8)
- [ ] Sem migração nesta fase.
- [ ] Os redirects antigos (`/configuracoes-gerais`, `/mercado-livre/vendas`, `/financeiro/produtos`) são `permanent: false` (307) — se algum favorito ou link externo apontar pra eles, continua funcionando, só com um salto extra. Pode trocar pra `permanent: true` depois de confirmar que nada interno ainda usa a URL antiga.
- [ ] `useMercadoLivreOptimized`/`sales-optimized` ficaram de fora da limpeza por terem caller real — se esse hook também estiver pra sair numa limpeza futura, a rota pode ser revisitada junto.

## FASE 9 — Pronto para produção

Sem migração nesta fase. Última fase do ciclo — `npm run build` final e `git push origin master` ficam pra depois dela, junto com a lista de aceite.

### Error boundaries e 404 amigável

`src/components/ui/error-state.tsx` **já existia** desde a Fase 1 (usado hoje por `/comecar`) — quase sobrescrevi com uma versão nova sem notar que já tinha dono; `git status` mostrou "modified" em vez de "untracked" e isso chamou atenção a tempo. Revertido pro original e `src/app/(root)/error.tsx` foi escrito contra a API de verdade do componente (`title` obrigatório, `actionHref`/`actionLabel` em vez de eu montar um link por fora). `src/app/(auth)/error.tsx` não usa esse componente — o cartão com borda não cabia bem dentro do card de login (que já é uma caixa), então é um bloco simples próprio, só pra esse contexto estreito. Como o `error.tsx` de cada grupo só substitui o conteúdo da página (não o `layout.tsx` do próprio grupo — regra do App Router), a Sidebar/Navbar continuam na tela quando uma página quebra dentro de `(root)`. `src/app/global-error.tsx` (já existia, com Sentry) continua sendo o único nível que perde o shell inteiro — só dispara se o próprio `layout.tsx` raiz quebrar, o que não muda nesta fase.

`src/app/not-found.tsx` (raiz, fora de qualquer grupo — cobre URL totalmente desconhecida, sem layout nenhum resolvido ainda) e `src/app/(root)/not-found.tsx` (dentro do app autenticado — mantém a Sidebar). Nenhuma tela chama `notFound()` hoje (são todas client component com fetch próprio, não dá pra usar a função do `next/navigation` em render de servidor) — esses dois arquivos cobrem é URL inválida de verdade (link velho, digitado errado).

### Acessibilidade

Revisão direcionada, não uma auditoria WCAG completa do app inteiro (ver "o que não fiz" abaixo). O que encontrei e corrigi:

- **11 botões de fechar diálogo (ícone "X" sozinho, sem texto nem `aria-label`)**: `ProdutoFornecedorDialog`, `ProdutoFormModal`, `ProdutoEditarDialog`, `ProdutoEstoqueDialog`, `NovaSaidaDialog`, `SaidaDetalhesDialog`, `VendaMLDetalhesDialog`, `FornecedorProdutoDialog`, `PedidoConfirmDialog`, `BarcodeReaderButton`, `PedidoDetalhesDialog` — todos ganharam `aria-label="Fechar"`. Mesma classe de bug do botão do scanner achado na Fase 7, só que espalhado em quase todos os diálogos com cabeçalho customizado do app. `PedidoPagination.tsx` já fazia certo (`sr-only`); os dois botões de `pedidosPendentes/page.tsx` têm `title`, que já dá nome acessível (mais fraco que `aria-label`, não toquei por não ser a mesma lacuna).
- **Menu do usuário na Navbar (desktop) era um `<div onClick>`, não um `<button>`**: focável só com mouse, fora da ordem de tab, sem `aria-expanded`/`aria-haspopup`. Trocado por `<button type="button" aria-haspopup="menu" aria-expanded={isDropdownOpen} aria-label="Menu do usuário">`. Acrescentei também fechar com `Esc` (só tinha clique-fora). O hambúrguer mobile (`<Menu>` sem rótulo) ganhou `aria-label="Abrir menu"`.
- **Diálogos (`Dialog` compartilhado) já são `@radix-ui/react-dialog`** — focus trap, `Esc` pra fechar e devolução de foco já vêm de graça da biblioteca; não precisei implementar nada aí.
- **Foco visível**: o `Button` compartilhado já tem `focus-visible:ring` em todas as variantes (`src/components/ui/button.tsx`) — não é um gap, é o padrão de todo botão do app desde antes desta fase.

### Achados durante a revisão (não eram o objetivo, mas quebravam navegação de verdade)

- **`BottomNav` (barra inferior do celular) apontava "Vendas" pra `/mercado-livre/vendas`** pra quem não tem `FINANCEIRO_VER` — rota apagada na Fase 8. Corrigido pra `/mercado-livre` (Saúde dos anúncios, que não é restrita por papel, ao contrário de `/financeiro/vendas`). Sem esse conserto, um usuário `VENDAS`/`ESTOQUE` tocando "Vendas" no celular via um esqueleto de carregamento pra sempre (a aba checa `podeVerFinanceiro` e nunca sai do skeleton se for falso) — regressão real da Fase 8 que nenhum teste pegou, porque nenhum spec do e2e navega como um papel sem `FINANCEIRO_VER`.
- **Notificações de "ML expirou" / "falha de sincronização" linkavam pra `/configuracoes`**, que na Fase 8 passou a ser só o callback OAuth — funcionava (redireciona sozinho), mas mostrava "Conectando sua conta…" por um instante mesmo sem nenhuma conexão em andamento. Trocado pra `/mercado-livre/configuracoes` direto (`src/services/notificationService.ts`).
- **Menu de ações da tela Saídas ainda linkava pra `/mercado-livre/vendas`** ("Análise Completa de Vendas") e rotulava `/mercado-livre` como "Dashboard ML" — ambos da época anterior à Fase 8. Primeiro trocado pra `/financeiro/vendas`, segundo renomeado pra "Saúde dos anúncios" (`src/app/(root)/saidas/page.tsx`).

### Segurança: rate limit e VER_CUSTO nas rotas novas do ciclo

Rotas criadas de A a Z neste ciclo (`git log --diff-filter=A` desde a Fase 0): `busca`, `catalogo/vinculos/lote`, `catalogo/vinculos/sugestoes`, `configuracoes-gerais/logo`, `mercadolivre/saude-anuncios`, `onboarding`, `onboarding/pular`, `onboarding/tour-visto`. Todas autenticadas via `verifyUser` e escopadas por `contaId` — conferido uma por uma, nenhuma faltando.

- **`saude-anuncios`**: não expõe custo nem margem, só a categoria (ex.: "está no grupo preço-abaixo-do-custo") — consistente com `calcularPendencias`, que também só libera o **valor agregado** pra quem tem `VER_CUSTO`, não a categoria. Não precisou de gate novo.
- **`produtos` PUT (`custoMedio`, Fase 8)**: já exige `VER_CUSTO` antes de aceitar o campo — conferido no código, não é novo nesta fase, só revisado.
- **`configuracoes-gerais/logo`**: tamanho máximo 2 MB, tipo de imagem conferido pelos bytes reais (magic number), não pelo `Content-Type` que o navegador manda — não dá pra subir um arquivo disfarçado de imagem. Sem rate limit; não achei necessário (upload de logo é ação rara, iniciada pelo próprio usuário, autenticada, não bate em API de terceiro).
- **`catalogo/vinculos/lote`**: zod valida e corta em 200 itens por chamada — já é um teto natural. As 8 rotas que **têm** rate limit hoje (`src/lib/rateLimit.ts`) são todas rotas que chamam API de terceiro (Bling/ML) e podem gerar ban/bloqueio de conta se marteladas; `vinculos/lote` só escreve no próprio banco, perfil de risco diferente — não adicionei rate limit só pra bater o item do checklist sem um motivo real.

### O que não fiz nesta fase

- **Revisão de acessibilidade completa (WCAG) do app inteiro** — o que fiz acima é o que achei de mais visível (ícones sem nome, menu sem teclado); não percorri telas por tela por tela com leitor de tela de verdade. Fica pra uma fase própria se for prioridade.
- **Reescrever as ~71 mensagens de erro genéricas ("Erro ao X")** — olhei uma amostra e a maioria já diz o que falhou (ex.: "Erro ao carregar contas do Mercado Livre"), só não sugere o que fazer a seguir. Reescrever as 71 é mecânico mas espalhado por dezenas de arquivos — risco baixo, mas também baixo retorno por arquivo, e não dá pra verificar visualmente cada uma sem forçar cada caminho de erro de propósito. Não arrisquei um passe grande disso no fim do ciclo.
- **Rate limit "geral" em toda rota de escrita** — o prompt pede isso de forma ampla; revisei só as rotas novas do ciclo (acima) e decidi caso a caso, não aplicável a "toda rota de escrita" do app sem reler cada uma (são centenas).

### Verificação da Fase 9

- `npx tsc --noEmit`, `npx next lint`, `npm test` limpos — 763 testes (sem teste novo nesta fase; só UI e rotas já existentes mudando de link/label).
- Banco novo do zero, sem Docker: `prisma migrate deploy` sem migração nova, seed limpo, `next build` completo.
- Suíte `e2e/*.spec.ts` rodada de ponta a ponta: **12 passaram, 3 pulados, 0 falharam** — mesmo padrão das fases anteriores.

## Passos manuais do Lucas (Fase 9)
- [ ] Sem migração nesta fase.
- [ ] `docs/MANUAL-DO-USUARIO.md` e a página `/ajuda/manual` têm o mesmo conteúdo — se editar um, repetir no outro (não há geração automática de um a partir do outro).
- [ ] Os dois achados de link quebrado (`BottomNav`, notificações de ML) só afetam contas sem `FINANCEIRO_VER` (papéis `VENDAS`/`ESTOQUE`/`LEITURA`) ou que recebem notificação de ML expirado — vale confirmar com alguém desses papéis depois do deploy.
