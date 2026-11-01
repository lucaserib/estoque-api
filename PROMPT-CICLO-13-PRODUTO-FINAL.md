# Skubo (ex-Leap Stock) — Ciclo 13: de MVP a produto final

Documento autocontido de execução para o Claude Code. Leia antes `docs/ANALISE-CRITICA-PRODUTO.md` (auditoria em produção de 24/10/2026, conta LEAPSTORE) e `docs/AUDITORIA-CICLO-12.md`. **Este ciclo substitui as Fases 2 a 6 do Ciclo 12** (elas estão incorporadas aqui).

A base de dados está correta (as vendas batem 100% com o Mercado Livre). O que falta é **confiança, guia, acabamento e velocidade**. O usuário final é um lojista do Mercado Livre que abre o app no notebook e no celular, quer saber em 10 segundos "quanto vendi, quanto ganhei, o que falta comprar e o que está errado", e não quer clicar em "Atualizar" nunca.

Execute as fases **na ordem**. Ao final de cada fase: `npx tsc --noEmit`, `npx next lint`, `npm test`, testes de navegador da Fase 0, commit descritivo em português e registro em `docs/AUDITORIA-CICLO-13.md`. Ao final, `npm run build` e `git push origin master`.

**Regras inegociáveis** (as de sempre, mais quatro novas): dinheiro em centavos; dia e mês no fuso de São Paulo; escopo por `contaId`; `VER_CUSTO` no servidor; nada inventado ("—" com o motivo); migrações aditivas e idempotentes; TypeScript estrito. **Novas:**
1. **Uma informação, um lugar, um nome.** Cada número tem uma definição (glossário em `docs/financeiro/definicoes.md`) e o mesmo rótulo em todas as telas.
2. **Todo aviso tem um botão que resolve.** Nenhuma pendência sem ação.
3. **Toda tela tem os quatro estados desenhados:** carregando (skeleton com o formato final), vazio (explica e oferece o próximo passo), erro (diz o que houve e como tentar de novo) e cheio.
4. **Formatação única:** `formatBRL`, `formatPercent` (vírgula, "29,1%"), `formatNumberBR`, datas `dd/MM`; nenhum `toFixed` em tela.

---

## Estado de partida

Já feito e **não publicado** (está no Mac, sem commit — commitar primeiro, Fase 0):
- **Ciclo 12 Fase 1**: sidebar que rola; mês atual como padrão; lista de produtos paginada com rolagem infinita; serviço único de vínculo com "unidades por venda" (kit de quantidade); cadastro rápido pelo Bling; correções do Bling (data em hora de Brasília, kits, saldo virtual, webhook com erro permanente).
- **Correções desta auditoria (24/10)**:
  - `mapeadorCobrancas.ts` + migração `20261024120000_ciclo13_reclassifica_cobrancas`: linhas `CVV*`, `CFON*`, `CFF*` da fatura do ML deixam de ser contadas de novo na DRE (outubro: margem de 1,5% → ~29%).
  - `StatStrip`/`HeroMetric` sem sobreposição; toasts com fundo sólido; topo do app cabe no celular.
  - Bling: `BlingEscopoError` com mensagem que diz qual escopo marcar; produto sem SKU vira aviso; pai de variações importa as variações; histórico marca sincronização presa como "Interrompida".
  - App instalável: `src/app/manifest.ts`, ícones em `public/pwa/`, `viewport` com `themeColor`.

---

## FASE 0 — Publicar o que está pronto e criar a rede de segurança

1. Commit do que está no working tree em dois commits (Ciclo 12 Fase 1; correções da auditoria 24/10). `npm run build` local. Push e deploy.
2. **Testes de navegador (Playwright)** em `e2e/`, rodando contra `next start` com banco de teste semeado (`prisma/seed.ts` ampliado com: 1 conta ML, 1 Bling, 20 produtos, 2 kits, 60 vendas em 2 meses, cobranças da fatura com os sub-tipos reais `CVVML`, `CFFE`, `CVVPRC`). Cenários mínimos, em 1440×900, 1366×680 e 390×844:
   - login → Visão geral sem nenhum elemento sobreposto (verificar com `boundingBox` que o valor e a nota de cada cartão não se cruzam) e sem rolagem horizontal;
   - sidebar: com Financeiro aberto em 1366×680 o item "Usuários" é alcançável;
   - Financeiro: margem do topo = soma do bloco "Por logística";
   - DRE: soma das linhas = resultado;
   - vincular anúncio com "2 unidades" e conferir custo da venda.
   `npm run test:e2e` no `package.json`; rodar na CI da Vercel (ou GitHub Actions) antes do deploy.
3. **Monitoramento**: o Sentry já está instalado — ligar `tracesSampleRate` em 0.1, capturar erros de API com `contaId` (sem dados pessoais) e criar alerta para erro novo.

**Aceite**: deploy no ar com DRE de outubro mostrando ~R$ 2.050 de margem antes de completar custos; e2e verde nos três tamanhos.

---

## FASE 1 — Marca Skubo e design: de "rústico" para produto

Objetivo: o app precisa parecer confiável na primeira olhada. Hoje tudo é cinza, mono e do mesmo peso. **O produto passa a se chamar Skubo** (Leap Stock não tem domínio disponível).

### 1.0 Identidade Skubo (fazer primeiro — tudo abaixo usa estes tokens)

Prancha de referência: `docs/marca/skubo-identidade.png`. Arquivos prontos em `public/brand/skubo/` (não redesenhar, só usar):
`skubo-simbolo.svg` (símbolo colorido), `skubo-simbolo-mono.svg` (usa `currentColor`), `skubo-logo.svg` (símbolo + palavra, fundo claro), `skubo-logo-branco.svg` (fundo escuro), `skubo-icone.svg` / `skubo-icone-maskable.svg` (ícone de app) e os PNG `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-icon.png` (180), `icon.png` (64). A palavra "skubo" no logo já está em curvas (Sora 600), não depende de fonte.

**Conceito.** Skubo = SKU + cubo. O símbolo é uma caixa isométrica roxa (o estoque) com a tampa verde levantando (o lucro saindo dela e a reposição chegando antes de faltar). Assinatura: *"O estoque e o lucro da sua loja, num cubo só."* Nome sempre em minúsculas no logo ("skubo") e com inicial maiúscula no texto corrido ("o Skubo avisa…").

**Cores** (substituem o verde Leap; HSL para os tokens shadcn):

| Token | Uso | Claro | Escuro |
|---|---|---|---|
| `--primary` (Roxo Skubo) | marca, botão principal, link, foco | `#5B3DF5` · `250 90% 60%` | `#8B74FF` · `250 100% 73%` |
| `--primary-strong` | hover/pressed, face escura do cubo | `#3F25C9` · `250 69% 47%` | `#6A4DFF` |
| `--primary-soft` | fundos de pílula, seleção, cartão destaque | `#F3F0FF` · `252 100% 97%` | `250 40% 18%` |
| `--success` (Verde Lucro) | positivo, meta, "confere" | `#16C79A` (preenchimento) / `#0E9F7A` (texto) | `#3EE0B5` |
| `--warning` (Âmbar Atenção) | estoque baixo, pendência | `#F5A524` (texto `#B7791F`) | `#F7B955` |
| `--destructive` (Vermelho Prejuízo) | ruptura, margem negativa, erro | `#E5484D` | `#FF6369` |
| `--foreground` (Tinta) | texto e números | `#16132B` · `248 39% 12%` | `#EDEBF7` |
| `--muted-foreground` | rótulos, notas | `#6E6893` | `#A39DC2` |
| `--background` (Névoa) | fundo da página | `#F7F6FB` · `252 38% 97%` | `#0E0C1A` · `249 37% 7%` |
| `--card` | cartões | `#FFFFFF` | `#17142A` · `248 35% 12%` |
| `--border` | bordas | `#E7E4F2` | `#2A2645` |

Gráficos: série principal Roxo Skubo, comparação `#B9ABFF`, lucro Verde Lucro, custos/quedas `#E5484D` com 85% de opacidade; nunca mais de 5 cores num gráfico. Amarelo do ML e verde do Bling só aparecem nos logos dessas integrações. Checar contraste AA de todo texto (o Verde Lucro `#16C79A` **não** é usado para texto em fundo claro — usar `#0E9F7A`).

**Tipografia** (`src/app/layout.tsx`, substituindo IBM Plex): **Sora** 600/700 para títulos de página, título de seção, valores-herói e marca; **Inter** 400/500/600 para interface e números (`font-variant-numeric: tabular-nums`, `letter-spacing: -0.01em` nos valores); **JetBrains Mono** 500 só para SKU, MLB e número de pedido. Escala: título 28/34 Sora 600 (`-0.02em`), seção 18/24 Sora 600, valor-herói 32–40 Inter 600, valor de cartão 28 Inter 600, corpo 14/22, rótulo 13 Inter 500 `muted-foreground`, nota 12.

**Forma.** Raio: cartões 16–20 px, botões e campos 10 px, pílulas 999 px. Sombra de cartão `0 1px 2px rgba(22,19,43,.04), 0 8px 24px rgba(22,19,43,.05)`; cartão destaque com gradiente `#FFFFFF → #F3F0FF` (escuro: `#17142A → #221C45`). Ícones Lucide com traço 1,75. Toast: fundo sólido, borda esquerda de 4 px na cor do status (já implementado; só trocar as cores).

**Jeito de falar.** Direto, de vendedor para vendedor, em "você". Toda mensagem diz **o que houve** e **o que fazer**, com um link de ação. Nada de "Erro ao…" sozinho. Exemplos: "O Bling não deixou ler o estoque. Falta marcar *Estoques* nas permissões do app — leva 1 minuto. **Ver como →**" · "O lucro de 105 vendas está incompleto — faltam custos nos produtos delas. **Preencher agora →**".

**Aplicar o nome e a marca em todo o app** (lista atual de "Leap Stock" no código — conferir de novo com `grep -rn "Leap" src public`):
- `src/components/brand/Logo.tsx`: `CubeMark` passa a desenhar o símbolo Skubo (mesma geometria de `skubo-simbolo.svg`, com cores dos tokens para funcionar no escuro); texto vira o logo em curvas (importar o path de `skubo-logo.svg`), não texto com fonte.
- `src/app/layout.tsx` (title "Skubo — estoque, reposição e lucro para quem vende no Mercado Livre", `applicationName`, `appleWebApp.title`, `themeColor` claro `#F7F6FB` / escuro `#0E0C1A`), `src/app/manifest.ts` (name "Skubo", short_name "Skubo", `background_color`/`theme_color` `#5B3DF5`, ícones de `public/brand/skubo/`), `src/app/icon.png` e `src/app/apple-icon.png` (substituir pelos de `public/brand/skubo/`), apagar `public/pwa/` depois de apontar o manifest para os novos.
- Telas e textos: `(auth)/layout.tsx` (lado da marca com fundo Roxo Skubo, logo branco e a assinatura; rodapé "© Skubo"), `register`, `onboarding`, `assinatura`, `configuracoes-gerais`, `integracoes`, `financeiro/conferencia` (coluna "Skubo"), `Sidebar.tsx` (aria-label), `mercadopago/subscribe` (descrição do plano "Skubo — Plano …"), `blingService.ts` (mensagem de escopo e observação "Ajuste Skubo"), e-mails e notificações, `README`/`CLAUDE.md`.
- `public/login-image.png`: refazer no estilo da marca (cubos roxos com tampa verde, fundo `#0E0C1A`) ou trocar por composição em CSS.
- **Domínio:** enquanto não houver domínio próprio, continua `estoque-api-4iqj.vercel.app`. Quando trocar: atualizar `NEXTAUTH_URL`, `ML_REDIRECT_URI`, `BLING_REDIRECT_URI`, a URL de redirecionamento no app do ML e do Bling, as URLs de webhook e o `start_url` do PWA — **na mesma janela**, senão o login e as integrações quebram. Deixar o endereço antigo redirecionando (301) para o novo.

**Personalização por conta** (substitui o item "cor da marca" de 1.1): a marca do app é sempre Skubo; a conta personaliza **nome e logo da loja** (aparecem no topo da sidebar, ao lado do símbolo, e no cabeçalho dos PDFs) e o **tema** claro/escuro/sistema.

**Aceite 1.0**: nenhum "Leap" no código ou nas telas; ícone novo ao instalar no celular; logo legível de 16 px (favicon) a 120 px; claro e escuro revisados.

### 1.1 Tokens (em `styles/global.css` e `tailwind.config.ts`)
- **Marca**: tokens da tabela de 1.0, com escalas completas geradas a partir de cada cor (`--primary-50…900`, `--success-…`, `--warning-…`, `--destructive-…`) para fundos suaves de status.
- **Números**: tirar a fonte mono dos valores grandes (Inter com `tabular-nums`); mono só em SKU, MLB e código de pedido. Valor positivo em `--success` (texto `#0E9F7A`), negativo em `--destructive`, neutro em `foreground`.
- **Hierarquia**: título de página 24/28 semibold; valor principal 32–40; rótulo 13 medium em `muted-foreground`; nota 12. `leading-tight` em todo valor (nunca `leading-none`).
- **Superfícies**: cartões com borda + sombra suave; cartão de destaque (resultado do mês) com gradiente sutil da cor da marca.
- **Personalização por conta** (`ConfiguracaoGeral`): nome e logo da loja (upload no Vercel Blob, já usado em imagens) e tema claro/escuro/sistema, como definido em 1.0. Migração aditiva com `nomeLoja`, `logoUrl`, `tema`.

### 1.2 Componentes base (em `src/components/ui/`)
- `StatCard` (substitui `StatStrip`/`HeroMetric`): rótulo, valor, variação (seta + %), nota, ícone, cor de status, tooltip "de onde vem" e link "ver detalhes". Nunca sobrepõe: valor com `break-words`, nota em linha própria.
- `PageShell`: cabeçalho fixo com título, subtítulo de atualização ("atualizado há 2 min"), ações e slot de filtros; no celular as ações viram um menu "⋯".
- `EmptyState`, `ErrorState`, `Skeleton*` no formato final de cada bloco.
- `Toast`: já corrigido; padronizar mensagens (título curto + descrição + ação "Desfazer"/"Ver") e usar **um** import (`@/components/ui/sonner`).
- `ConfirmDialog` único para ações destrutivas (hoje cada tela tem o seu).
- `DataTable` responsivo: abaixo de 768 px vira lista de cartões (definir por coluna qual vira título, subtítulo e valor).
- `CommandPalette` (⌘K e o campo de busca do topo, que hoje **não faz nada**): busca produto por nome/SKU/EAN, pedido por número, anúncio por MLB, e ações ("Nova compra", "Vincular anúncios", "Ir para DRE"). Rota `GET /api/busca?q=` com limite de 8 por tipo.

### 1.3 Navegação
- Desktop: sidebar com **5 grupos** — Início · Vendas e lucro · Estoque e compras · Anúncios · Ajustes. Financeiro passa de 9 para 5 itens (Resultado/DRE · Vendas · Caixa · Conferência · Ajustes do financeiro).
- Celular: **barra inferior** com Início, Vendas, Estoque, Anúncios e "Mais" (abre o resto em folha). Sidebar só no desktop.

**Aceite**: revisão visual em claro e escuro nos três tamanhos; contraste AA; nenhum `font-mono` em valor monetário; cor da marca da conta aplicada sem recarregar.

---

## FASE 2 — Jornada de configuração (tour gamificado)

O app já sabe tudo o que falta. Em vez de espalhar isso em listas, ele **conduz**.

### 2.1 Motor de etapas
`src/modules/onboarding/etapas.ts` calcula, no servidor, o estado de cada etapa a partir dos dados reais (uma consulta por etapa, cacheada 60 s). `GET /api/onboarding` devolve `{ etapas: [{ id, titulo, porque, status: "feito"|"pendente"|"bloqueado"|"atencao", progresso: { feito, total }, acao: { rotulo, href | acaoInline } , minutosEstimados }], pontuacao, nivel }`.

Etapas, nesta ordem (cada uma só libera quando a anterior está feita ou pulada):
1. **Conectar o Mercado Livre** — conta ativa e token válido.
2. **Conectar o Bling** — conta ativa **e escopos ok** (testa `/depositos` e `/produtos/fornecedores`; se `BlingEscopoError`, a etapa mostra o passo a passo do Bling com prints).
3. **Receber notificações** — último webhook do ML e do Bling há menos de 24 h; se não, mostra as URLs com botão copiar e onde colar.
4. **Trazer o catálogo** — sincronização do catálogo concluída; mostra o carregamento ao vivo (2.3).
5. **Vincular anúncios** — `% de anúncios ativos vinculados`; abre a tela de vínculo em lote filtrada em "Sem vínculo", com sugestões já marcadas (ex.: os 4 anúncios do Borrifador).
6. **Custos dos produtos** — `% de produtos ativos com custo`, ordenados por faturamento sem custo (o que mais pesa primeiro); edição em linha e importação por planilha.
7. **Fornecedores e prazos** — `% com fornecedor principal e prazo`.
8. **Impostos e modo de faturamento** — regime, alíquota e "como você quer ver o faturamento" (2.4).
9. **Despesas fixas** — aluguel, salários, ferramentas (para o lucro líquido e o ponto de equilíbrio); modelos prontos com um clique.
10. **Meta do mês** — sugerida pelo histórico (média dos 3 últimos meses + 10%).
11. **Saldo do Mercado Pago** — informar uma vez.
12. **Instalar no celular** — instruções por sistema (2.5).

### 2.2 Interface
- **Tela "Configurar minha loja"** (`/comecar`): coluna com as etapas em formato de trilha (ícone, título, "por que importa" em uma linha, barra de progresso, tempo estimado, botão de ação). Topo com **anel de progresso** ("72% configurado") e **nível** com o tema do cubo — **Caixa** (ML e Bling conectados) → **Prateleira** (anúncios vinculados) → **Depósito** (custos e fornecedores) → **Centro de Distribuição** (loja 100% configurada) que sobe a cada etapa; confete sóbrio (`canvas-confetti`, 1 s) ao concluir uma etapa.
- **Tour em slides** na primeira entrada (e pelo menu "Ajuda → Ver tour"): 5–7 slides em tela cheia, com ilustração, título, 2 linhas e "Próximo" — o que o Skubo faz, de onde vêm os números, a jornada, onde ficam as coisas. Depois, **spotlight** guiado na interface real (destaca o elemento, escurece o resto, balão com texto e "Próximo/Pular"), implementado com um componente próprio sobre Radix Popover (sem dependência pesada). Configurável por arquivo (`src/modules/onboarding/tour.ts`: lista de passos com seletor `data-tour="…"`, texto e rota), para editar sem mexer em componente.
- **Cartão "Próximo passo"** fixo no topo da Visão geral enquanto a configuração não passar de 90%, com a próxima etapa e o botão de ação.
- Estado salvo por usuário (`OnboardingProgresso`: etapas puladas, tour visto, nível) — migração aditiva.

### 2.3 Tela de carregamento (primeira importação e "Atualizar catálogo")
Tela/modal com as etapas reais da sincronização (`GET /api/catalogo/sincronizacao` e `/api/financeiro/sincronizacao/status`, a cada 2 s): Bling produtos → Bling estoque → anúncios ML → Full → vendas (por mês) → detalhes de pagamento. Cada etapa com ícone, barra, contador "146 de 230" e **frases do que já foi encontrado** ("Encontramos 59 anúncios, 9 ativos", "Outubro: 198 pedidos, R$ 7.045,62"). Erro de etapa aparece com a mensagem amigável e o botão que resolve (ex.: "Dar permissão de Estoques no Bling"). O usuário pode fechar e continuar usando; um indicador no topo mostra o progresso.

### 2.4 Faturamento "igual ao Mercado Turbo/Bling"
Hoje `ModoFaturamento` tem `PRODUTOS` e `PRODUTOS_E_FRETE_COMPRADOR`. Adicionar `PRODUTOS_E_FRETE_TOTAL` (produtos + frete gerado no envio, vendedor + comprador), que é o total que o Bling registra e o Mercado Turbo mostra. Na etapa 8 e em Ajustes, mostrar **os três valores do mês lado a lado** (ex.: "Igual ao ML R$ 7.045 · Com frete do comprador R$ 7.155 · Igual ao Bling/Mercado Turbo R$ 8.905") e explicar que **a margem é a mesma** nos três — muda só onde o frete aparece.

**Aceite**: conta nova vai de zero a 100% só seguindo a jornada; cada etapa pendente tem botão que leva exatamente ao lugar de resolver; a tela de carregamento mostra o progresso real e erros acionáveis.

---

## FASE 3 — Resultado e DRE didáticos

### 3.1 Visão geral = "Como está minha loja"
Cinco blocos, nesta ordem, nada além:
1. **Resultado do período** (mês atual por padrão): faturamento, margem de contribuição (R$ e %), lucro líquido, pedidos e ticket — com a comparação "vs mesmo trecho do mês passado" e o selo **"Confere com o ML ✓"** (da Conferência) ou "Faltam custos em X vendas — completar".
2. **Hoje**: faturamento, pedidos, margem e o que foi liberado no MP; atualiza sozinho (webhook + revalidação a cada 2 min).
3. **O que fazer agora**: até 5 cartões de ação priorizados (ruptura prevista, anúncio sem vínculo vendendo, custo faltando no mais vendido, vínculo a confirmar, Bling sem permissão).
4. **Estoque**: onde está (local × Full × a caminho) e capital parado.
5. **Evolução**: faturamento e margem por dia, com a meta.

### 3.2 DRE em cascata
- **Gráfico cascata** (waterfall) do faturamento até o lucro: barras de queda por grupo (impostos, tarifas, frete, publicidade, Full, CMV, despesas fixas), com valor e % do faturamento.
- Tabela abaixo com **três níveis expansíveis**: grupo → item → vendas/lançamentos (clique em "Frete" abre as vendas com frete, ordenadas pelo maior).
- **Cada linha tem um "?"** que explica em uma frase o que é e **de onde vem** (ex.: "Tarifas: valor que o ML cobrou em cada venda, lido do pagamento no Mercado Pago").
- Colunas de meses lado a lado (até 12) com variação; destaque de linha que piorou mais de 20%.
- Rodapé "**Qualidade dos dados**": vendas sem custo, sem vínculo, aguardando detalhe — cada uma com botão para resolver; enquanto houver, o lucro aparece com selo "estimado".
- Linhas informativas fora da conta, em bloco separado: desconto de campanha embutido, retenções do ML para pagar a fatura (com destaque no Caixa), diferença para o Mercado Turbo/Bling (frete gerado).
- Lançar despesa **direto da DRE** ("+ despesa" na linha de despesas operacionais) com categorias prontas.
- Exportar PDF com o mesmo visual.

### 3.3 Caixa
"Quanto tenho, quanto vai entrar, quanto vai sair": saldo MP, a liberar por data (calendário), **retido pelo ML para quitar a fatura** em destaque, contas a pagar, saldo projetado em 30 dias.

**Aceite**: as somas fecham em todas as telas (teste unitário que gera DRE, Visão geral e Por logística do mesmo período e compara); cada linha da DRE tem explicação e detalhamento.

---

## FASE 4 — Anúncios e vínculos em escala (era a Fase 2 do Ciclo 12)

1. "Anúncios e vínculos" é a única tela de vínculo, com filtros *Sem vínculo · A confirmar · Kit · SKU divergente*, paginada no servidor, e **ações em lote** (`POST /api/catalogo/vinculos/lote`, até 200 itens, resultado por item).
2. **Sugestão por anúncio** (SKU exato, EAN, título com "kit N", similaridade) com nível de confiança; "Aplicar sugestões selecionadas".
3. Matching automático já grava kit de quantidade como **não confirmado** quando o título indicar kit.
4. **Variações do ML**: vínculo por variação (`mlVariationId`), venda da variação cai no produto certo, envio de estoque na variação certa.
5. Ficha do produto com "Vincular anúncio" no sentido inverso.
6. `/produtos/vincular` e `/produtos/vinculos-pendentes` viram redirecionamento.

**Aceite**: os 4 anúncios do Borrifador vinculados em 3 cliques a partir da jornada; vendas antigas recalculadas.

---

## FASE 5 — Integrações sem babá

1. **Bling**: uma única rotina de importação (a do catálogo). Apagar `POST /api/bling/produtos/importar` (laço em `after()`) e `POST /api/produtos/estoque-bling`; telas usam `SincronizacaoCatalogo`. Teste de escopos na conexão (lista o que falta). Importar variações (formato V) como produtos com o SKU da variação. Documentar parâmetros reais da API v3 em `docs/BLING_API.md` com fixtures.
2. **Webhooks**: tela Integrações mostra último evento por tópico (ML e Bling) e o alerta com as URLs para copiar. Com webhooks ativos, reduzir crons e remover o `auto_smart` de 15 min do navegador (`MercadoLivreAutoSync`).
3. **Integrações**: um cartão por conta com saúde (token, escopos, último evento, última sincronização por etapa, erros com ação). Histórico só com execuções que fizeram algo.

**Aceite**: Bling com estoque sincronizado por depósito; "valor em estoque" deixa de ser R$ 0; nenhum "Em andamento" eterno.

---

## FASE 6 — Velocidade

1. **TanStack Query** (`@tanstack/react-query`) em todo o app: cache entre telas, `staleTime` por tipo de dado (resumo 60 s, catálogo 5 min, configurações 30 min), revalidação em segundo plano, `prefetchQuery` ao passar o mouse nos itens do menu. Remover os `useFetch`/`useEffect` manuais.
2. **Server Components** para o "esqueleto" de cada página (título, filtros, layout) e `loading.tsx` por rota com o skeleton final — navegação instantânea.
3. **Uma chamada por tela**: endpoints agregadores onde hoje há 3–5 chamadas em sequência (Visão geral, ficha do produto, Integrações).
4. **Cache HTTP** (`Cache-Control: private, max-age=30, stale-while-revalidate=300`) nas rotas de leitura; invalidar nas escritas.
5. **Banco**: revisar índices das consultas do motor (`vendas_canal(userId, dataVenda, status)`, `vendas_canal_itens(produtoId)`, `cobrancas_canal(userId, data, coberturaPedido)`); `EXPLAIN` das 10 rotas mais chamadas; região da função na Vercel igual à do Postgres.
6. **Bundle**: `next/dynamic` para gráficos (Recharts), `xlsx` e `jspdf` (só carregam ao exportar); medir com `@next/bundle-analyzer`.
7. Remover pollers duplicados; um único `EventSource`/polling de status quando há sincronização em andamento.

**Aceite (medido em produção, Lighthouse/Web Vitals)**: navegação entre telas já visitadas < 150 ms; primeira carga da Visão geral < 1,5 s (LCP) no notebook e < 2,5 s no 4G; INP < 200 ms.

---

## FASE 7 — Celular de verdade

1. Barra inferior (Fase 1.3), áreas de toque ≥ 44 px, `safe-area-inset` no iPhone.
2. Tabelas viram cartões abaixo de 768 px (DataTable responsivo).
3. Ações principais por tela ao alcance do polegar (botão flutuante "+" em Compras e Produtos).
4. Formulários com teclado certo (`inputMode="decimal"` em valores, `numeric` em quantidades) e scanner de código de barras já existente acessível pelo topo.
5. **Instalação** (manifest já feito): página `/ajuda/celular` com o passo a passo:
   - **iPhone (Safari)**: abrir `estoque-api-4iqj.vercel.app` → botão Compartilhar → "Adicionar à Tela de Início" → Adicionar.
   - **Android (Chrome)**: abrir o endereço → menu ⋮ → "Instalar app" (ou "Adicionar à tela inicial").
   - Abre em tela cheia, com ícone próprio, sem barra do navegador.
   Mostrar um convite discreto ("Instale o Skubo no seu celular") na primeira visita pelo celular.

**Aceite**: todas as telas usáveis em 390×844 sem rolagem lateral; Lighthouse PWA instalável.

---

## FASE 8 — Cortar redundância (era a Fase 4 do Ciclo 12)

- Mercado Livre → Painel vira **Saúde dos anúncios** (pausados, sem estoque, sem vínculo, Full baixo, sem tarifa/frete, preço abaixo do custo); "ML → Vendas" sai do menu (redireciona para Vendas e lucro).
- **Uma tela de Ajustes** com seções (Loja e marca · Impostos e faturamento · Reposição · Mercado Livre · Bling · Financeiro · Usuários · Aparência). `/configuracoes` (3.000 linhas) quebrado em `ajustes/secoes/*.tsx`. Rotas antigas redirecionam.
- Ficha do produto em uma coluna: números → onde é vendido (pronto) → cadastro editável inline → histórico.
- "Lucro por venda" e "Lucro por produto" viram abas de **Vendas**.
- Apagar arquivos sem uso (lista em `PROMPT-CICLO-12-SIMPLIFICAR.md`, Fase 5) e rotas sem chamador (confirmar nos logs).

---

## FASE 9 — Pronto para produção

- `error.tsx` por grupo de rotas com `ErrorState`; `not-found.tsx` amigável.
- Acessibilidade: foco visível, rótulos em ícones, navegação por teclado no menu e diálogos.
- Textos: revisão de todas as mensagens (sem "Erro ao…" genérico: dizer o que houve e o que fazer).
- Segurança: rate limit nas rotas de escrita, revisão de `VER_CUSTO` nas rotas novas.
- `docs/MANUAL-DO-USUARIO.md` curto, linkado no menu Ajuda.
- Atualizar `CLAUDE.md` (fontes da verdade, rotas novas, como rodar e2e).

---

## Lista de aceite final (o Lucas confere em produção)
- [ ] Marca Skubo aplicada: logo, ícone instalado no celular, cores, fontes, nenhum "Leap" em tela.
- [ ] DRE de outubro: margem ≈ R$ 2.050 antes de completar custos; DRE, Visão geral e "Por logística" com o **mesmo** número.
- [ ] Os três modos de faturamento lado a lado; o "igual ao Bling/Mercado Turbo" bate com o Mercado Turbo.
- [ ] Jornada de configuração leva a conta a 100% (Bling com escopos, webhooks chegando, anúncios vinculados, custos preenchidos).
- [ ] Tour em slides + spotlight na primeira entrada; tela de carregamento com progresso real.
- [ ] Nenhum valor sobreposto, nenhum toast transparente, nenhum item escondido na sidebar, busca do topo funcionando.
- [ ] Celular: instalado na tela de início, navegação inferior, tabelas em cartões.
- [ ] Navegação instantânea entre telas já visitadas; nenhuma tela exige "Atualizar".
- [ ] Bling: estoque por depósito sincronizado; produtos sem SKU listados com o nome para corrigir no Bling.

## Passos manuais do Lucas
1. **Bling** (Central de extensões → Área do integrador → app do Leap Stock — dá para renomear para Skubo ali mesmo): Escopos — marcar Estoques, Depósitos, Produtos, Fornecedores de produtos, Contatos (e Contas a pagar/receber se for usar). Salvar. Webhooks — `product`, `stock`, `virtual_stock`, `product_supplier` → `https://estoque-api-4iqj.vercel.app/api/bling/webhook`. Depois, no Skubo: Integrações → **Reconectar Bling**.
2. **Bling**: preencher o código (SKU) dos produtos sem código (a lista aparece em Integrações depois do deploy).
3. **Mercado Livre** (developers.mercadolivre.com.br → seu app → Notificações): URL `https://estoque-api-4iqj.vercel.app/api/mercadolivre/webhook`, tópicos `orders_v2`, `items`, `shipments`, `payments`, `claims`.
4. Vincular os 4 anúncios do Borrifador e informar o custo do `BORRIFADOR1`.
