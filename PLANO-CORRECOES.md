# Plano de Correções — Vendexy Gestão (estoque-api)

> Documento de handoff para execução das correções. Cada item tem causa raiz confirmada, arquivos exatos e critério de aceite. Executar na ordem. Diagnóstico feito em 04–05/07/2026 testando produção (https://estoque-api-4iqj.vercel.app) e o código local (branch `master`, commit `8b374a7`).

**Contexto da stack:** Next.js 15 App Router + Prisma/PostgreSQL + NextAuth. Deploy no Vercel a partir do GitHub (`lucaserib/estoque-api`, branch master). Integrações OAuth: Mercado Livre e Bling (API v3). `User.id` é UUID. Middleware injeta o userId nos headers; rotas usam `verifyUser(request)`.

---

## FASE 0 — Preparação

- Existe um `.git/index.lock` órfão (0 bytes) na raiz. Remover antes de qualquer operação git: `rm .git/index.lock`.
- Criar branch de trabalho: `git checkout -b fix/integracoes`.

---

## FASE 1 — P0: Rotas ML duplicadas por caixa no git (CRÍTICO — quebra quase todo o módulo ML em produção)

### Causa raiz (confirmada)
O índice do git contém **duas árvores** para as rotas do ML:
- `src/app/api/mercadoLivre/**` (L maiúsculo) — ~36 rotas: produtos, produtos/link, produtos-dinamicos, produtos-simple, dashboard/metrics, dashboard/realtime, auto-sync, quick-sync, precos, precos-batch, orders, alerts, categories, monitoring, webhook, sync/auto-stock, sync/incremental, analytics/sales*, analytics/restock*, analytics/performance, analytics/revenue-complete, test-prices, test-produtos, debug-products
- `src/app/api/mercadolivre/**` (minúsculo) — apenas 3 rotas: `auth`, `analytics`, `sync`

No macOS (filesystem case-insensitive, `core.ignorecase=true`) isso é invisível — no disco existe uma pasta só, `mercadolivre`, e tudo funciona localmente. No Vercel (Linux, case-sensitive) viram dois caminhos distintos. O frontend chama **tudo em minúsculo** → todas as rotas do grupo com L maiúsculo retornam **404** em produção.

**Prova em produção:** `GET /api/mercadoLivre/produtos?accountId=...` → 200; `GET /api/mercadolivre/produtos?accountId=...` → 404.

### Correção
```bash
rm -f .git/index.lock
# Remover do índice a árvore com L maiúsculo (o disco não muda)
git rm -r --cached "src/app/api/mercadoLivre"
# Re-adicionar tudo pela grafia do disco (minúscula)
git add src/app/api/mercadolivre
git status   # conferir: renames mercadoLivre/* -> mercadolivre/*
git commit -m "fix: unificar caixa de api/mercadolivre (case-sensitivity no Vercel)"
```

### Também nesta fase
As pastas `src/app/api/mercadolivre/produtos-inteligente/`, `produtos-realtime/` e `debug-produtos/` estão **vazias** (sem `route.ts`) — deletar as pastas (rotas nunca existiram; o front que as chama será corrigido na Fase 3).

### Critério de aceite
Após deploy: `GET /api/mercadolivre/produtos?accountId=<id>` retorna 200 em produção. Nenhuma rota duplicada: `git ls-tree -r HEAD --name-only | grep -i mercadolivre` mostra apenas grafia minúscula.

---

## FASE 2 — P0: Bling — callback corrompe o userId (vinculação nunca é salva)

### Causa raiz (confirmada)
- `src/app/api/bling/auth/route.ts` gera: `const state = \`${user.id}-${Date.now()}-${Math.random()...}\``
- `src/app/api/bling/auth/callback/route.ts` (linha ~31) recupera: `const userId = state.split("-")[0]`
- `User.id` é **UUID e contém hífens** → o split devolve só o primeiro bloco (ex.: `983b38a1`) → `prisma.blingAccount.create({ userId: "983b38a1" })` viola a FK com `User` → exceção → catch redireciona com `bling_error=connection_failed`. O usuário autoriza no Bling, tokens são obtidos, mas **a conta nunca é salva** (`GET /api/bling/auth?action=accounts` → `[]`).

### Correção
Usar separador que não existe em UUID, nos dois arquivos:
```ts
// src/app/api/bling/auth/route.ts (action === "connect")
const state = `${user.id}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

// src/app/api/bling/auth/callback/route.ts
const userId = state.split("_")[0];
```
Adicionalmente no callback: validar `userId` com regex de UUID antes do upsert e logar erro claro se inválido.

### Correção associada (token expirado sem tratamento)
Confirmado em produção com a conta leapstore: existe `blingAccount` no banco com refresh token **inválido** (`invalid_grant` — "Invalid refresh token"). Hoje qualquer ação Bling estoura toast com JSON cru ("Erro ao renovar token do Bling: {...}").
Em `src/services/blingService.ts` (método de refresh / `getValidToken`): ao receber `invalid_grant`, marcar `blingAccount.isActive = false` e retornar erro tipado (ex.: `BLING_RECONNECT_REQUIRED`). No front (`src/app/(root)/produtos/importar/page.tsx` e botão "Atualizar Estoque Bling" em `src/app/(root)/produtos/page.tsx`): tratar esse erro mostrando "Sua conexão com o Bling expirou — reconecte" + botão que dispara o fluxo de conexão.

### Critério de aceite
Fluxo completo em produção: Conectar Bling → autorizar → volta com `bling_connected=true` → `action=accounts` retorna a conta → "Atualizar Estoque Bling" funciona. Token inválido exibe CTA de reconexão (não JSON).

---

## FASE 3 — P0: Frontend chamando rotas inexistentes/método errado

1. **`src/app/(root)/configuracoes/page.tsx`**
   - Linha ~604 (`loadProducts`): faz `GET /api/mercadolivre/sync?accountId=...` → rota só exporta POST → **405** com corpo vazio → é a origem do toast "Erro ao carregar produtos" e do `Unexpected end of JSON input`. **Trocar para** `GET /api/mercadolivre/produtos?accountId=...` (rota existente com GET; ajustar o parse: a resposta tem shape `{ products, total, summary }`).
   - Linha ~622 (`loadSyncHistory`): `GET /api/mercadolivre/sync?...&action=history` → 405. **Adicionar handler GET** em `src/app/api/mercadolivre/sync/route.ts` que retorna o histórico de `mercadoLivreSyncHistory` do usuário (ou trocar a chamada para uma rota existente de histórico, se houver).
2. **`src/app/components/MercadoLivreSmartSync.tsx`** (linhas ~113, 134, 163): chama `/api/mercadolivre/produtos-inteligente` (GET e POST) — rota **não existe em lugar nenhum**. Trocar: GET → `/api/mercadolivre/produtos` (suporta `mode`/ordenação smart); POST de sincronização → `/api/mercadolivre/sync` (POST, body `{ accountId, syncType }`) ou `/api/mercadolivre/quick-sync`.
3. **`src/components/EstoqueSegurancaCalculator.tsx`**: chama `POST /api/estoque/calcular-media-saidas` — rota não existe. Criar a rota (média de saídas por produto/período usando a tabela `Saida`) ou calcular no cliente a partir de `/api/saida`.
4. **`src/app/(root)/saidas/components/BarcodeScannerSelecaoProdutos.tsx`**: chama `/api/produtos/buscar-por-ean` — rota não existe. Criar rota GET simples (`?ean=` → produto do usuário) ou reutilizar `/api/produtos?ean=`.
5. Na tela **Configurações ML**, aba "Gerenciamento" mostra "Produtos (0)" mesmo com 9 produtos ativos — deve ser consequência do item 1; validar após o fix.

### Critério de aceite
/configuracoes carrega sem nenhum toast de erro; console sem 404/405; SmartSync lista e sincroniza; "Produtos (N)" consistente com a página Produtos ML.

---

## FASE 4 — P1: Bugs funcionais visíveis

1. **Pedidos concluídos zerados** — `src/app/(root)/gestao-pedidos/`: a lista de concluídos mostra "0 produtos / R$ 0,00" em todos (testado com 7 pedidos reais). Investigar a rota `/api/pedidos-compra` (include dos produtos/valores no Prisma provavelmente ausente na listagem) e o mapeamento na tabela (`PedidosTable.tsx` / `PedidoRow.tsx`).
2. **Toast "Atualizando dados do dashboard…" nunca some** — fica preso e persiste entre páginas. Localizar o `toast.info`/`toast.loading` do dashboard e garantir `toast.dismiss(id)`/`duration` no fim do fetch (inclusive em erro).
3. **N+1 na página /produtos** — cada linha dispara `GET /api/estoque/produto/<id>` (com 35 produtos já são 35 requests; a página nunca atinge idle). Criar endpoint batch (ex.: `GET /api/estoque/produtos?ids=...` ou incluir estoque no payload de `/api/produtos`) e remover os fetches por linha.
4. **Formatação de moeda em centavos** — tela ML mostra "Ticket médio: 2850" (deveria ser R$ 28,50). Valores são armazenados em **centavos** (int). Auditar os pontos de exibição (`/mercado-livre/page.tsx` e cards de métricas) e centralizar um `formatCurrency(cents)` em `lib/`.
5. **"Taxa de Conversão 124.6%"** em Análise de Vendas — fórmula errada (>100% é impossível). Revisar o cálculo em `/api/mercadolivre/analytics` (provável itens/pedidos invertidos ou base errada); se não houver dado real de visitas, remover o card.
6. **Rótulo "Vendas (Set/2025)"** na lista Produtos ML — período fixo/desatualizado; usar o período real dos dados.
7. **`/estoque` → 404 preto** — criar `src/app/(root)/estoque/page.tsx` com redirect para `/estoque/armazens`.
8. **Dashboard geral zerado para seller ML** — os KPIs consideram só estoque/saídas locais. Incluir (ou destacar) vendas ML e estoque Full, senão o primeiro contato com o produto é um dashboard vazio.
9. **PKCE do ML em memória** — `src/services/mercadoLivreService.ts:33` (`codeVerifierCache = new Map(...)`). No Vercel serverless, connect e callback podem cair em instâncias diferentes → falha intermitente "code verifier não encontrado". Persistir o verifier no banco (tabela pequena `oauth_state` com TTL) em vez de Map.

---

## FASE 5 — P2: Polimento (fazer antes do lançamento, depois dos P0/P1)

1. Placeholder da busca global em inglês ("Start type to search group…") → traduzir.
2. Rodapé "© 2024 PStock" → marca correta (Vendexy) + ano dinâmico.
3. Remover rotas de debug/teste de produção: `api/mercadolivre/test-prices`, `test-produtos`, `debug-products`, `debug-ml-products.js` (raiz) — ou proteger atrás de env de dev.
4. `env.example`: faltam `BLING_CLIENT_ID`, `BLING_CLIENT_SECRET`, `BLING_REDIRECT_URI`.
5. **Dark mode quebrado** (metade da tela escurece): a causa é o hack de inversão do `tw-colors` no `tailwind.config.ts` + cores hardcoded (`bg-white`, `bg-gray-*`) espalhadas pelas páginas. Correção estrutural: migrar para CSS variables (padrão shadcn) com `darkMode: "class"` e tokens semânticos (`bg-background`, `bg-card`, `text-muted-foreground`), removendo o `createThemes`/inversão. É trabalho de tema, não de bug pontual — tratar junto do redesign.
6. **Duas árvores de componentes UI duplicadas** (`src/app/components/ui` e `src/components/ui`) — unificar em `src/components/ui` e apontar imports.
7. Substituir emojis em mensagens de sistema (🎉🔄✅) por ícones/texto e padronizar toasts (mensagens humanas, sem JSON cru).

---

## FASE 6 — Rebrand e nova identidade visual

> Novo nome do produto: **Estoca** (decidido pelo dono em 05/07/2026). Tagline: "Estoque e reposição para quem vende no Mercado Livre". Estilo: profissional moderno, verde-esmeralda + neutros slate. Guia completo em `Projeto de estoque/marca-e-identidade-visual.md`. Antes do lançamento: conferir domínio (`estoca.com.br`/`estoca.app`) no registro.br e marca no INPI.

### 6.1 Design tokens (fundação — fazer primeiro)

Substituir o sistema de tema atual. **Remover completamente o `tw-colors`/`createThemes` do `tailwind.config.ts`** (o hack de inversão de shades é a causa do dark mode quebrado) e migrar para CSS variables padrão shadcn com `darkMode: "class"`.

`src/app/globals.css` (ou styles/globals.css):
```css
:root {
  --background: 210 40% 98%;        /* #F8FAFC */
  --foreground: 222 47% 11%;        /* #0F172A */
  --card: 0 0% 100%;                /* #FFFFFF */
  --card-foreground: 222 47% 11%;
  --border: 214 32% 91%;            /* #E2E8F0 */
  --input: 214 32% 91%;
  --primary: 161 94% 30%;           /* #059669 esmeralda */
  --primary-foreground: 0 0% 100%;
  --muted: 210 40% 96%;
  --muted-foreground: 215 16% 47%;  /* #64748B */
  --success: 161 94% 30%;           /* #059669 */
  --warning: 32 95% 44%;            /* #D97706 */
  --destructive: 0 72% 51%;         /* #DC2626 */
  --info: 221 83% 53%;              /* #2563EB */
  --ring: 161 94% 30%;
  --radius: 0.5rem;
}
.dark {
  --background: 218 47% 8%;         /* #0B1220 */
  --foreground: 214 32% 91%;
  --card: 220 41% 11%;              /* #101826 */
  --card-foreground: 214 32% 91%;
  --border: 217 33% 17%;            /* #1E293B */
  --input: 217 33% 17%;
  --primary: 158 64% 52%;           /* #34D399 */
  --primary-foreground: 165 80% 10%;
  --muted: 217 33% 14%;
  --muted-foreground: 215 20% 65%;  /* #94A3B8 */
  --success: 158 64% 52%;
  --warning: 43 96% 56%;            /* #FBBF24 */
  --destructive: 0 91% 71%;         /* #F87171 */
  --info: 213 94% 68%;              /* #60A5FA */
  --ring: 158 64% 52%;
}
```

`tailwind.config.ts`: mapear os tokens (`background: "hsl(var(--background))"` etc., padrão shadcn), manter `darkMode: "class"`, remover import e plugin do tw-colors. Cores de gráficos (Recharts) centralizadas em `src/lib/chart-colors.ts`: `["#059669", "#2563EB", "#F59E0B", "#8B5CF6", "#EC4899"]`.

Tipografia: Inter via `next/font/google` no root layout (pesos 400/500/600); adicionar utilitária `.tabular-nums` e aplicar em todos os valores numéricos de tabelas e KPIs.

### 6.2 Varredura de cores hardcoded

Substituir em TODO o código (são a segunda causa do dark mode quebrado):
- `bg-white` → `bg-card` · `bg-gray-50/100` → `bg-background` ou `bg-muted` · `text-gray-900/800` → `text-foreground` · `text-gray-500/600` → `text-muted-foreground` · `border-gray-200/300` → `border-border` · `bg-blue-*`/`text-blue-*` de ações → `primary` · verdes/vermelhos de status → `success`/`destructive`/`warning`.
- Buscar com: `grep -rn "bg-white\|bg-gray-\|text-gray-\|border-gray-\|bg-blue-\|bg-indigo-" src --include=*.tsx`
- Critério de aceite: alternar dark mode em TODAS as telas sem nenhuma área clara órfã; nenhum texto ilegível.

### 6.3 Unificação de componentes

- Unificar as duas árvores duplicadas (`src/app/components/ui` e `src/components/ui`) em **`src/components/ui`** (shadcn); atualizar imports; deletar a duplicada.
- Toasts: padronizar em uma única lib (sonner), mensagens humanas em PT-BR, **nunca** exibir JSON de erro cru; remover emojis (🎉🔄✅📦) de todos os toasts/textos de sistema — usar ícones Lucide.
- Componentes padrão a criar/normalizar: `PageHeader` (título + descrição à esquerda, ações à direita — usar em todas as páginas), `KpiCard` (label muted 14px, valor 28–32px tabular-nums, delta ▲/▼ colorido), `EmptyState` (ícone + texto + CTA primário).

### 6.4 Rebrand (nome/textos/marca)

1. Find-replace de marca: "Vendexy Gestão"/"Vendexy" → "Estoca"; **remover todas as ocorrências de "PStock"** (rodapé!). Ano do rodapé dinâmico (`new Date().getFullYear()`).
2. `layout.tsx`: metadata (title "Estoca — Estoque e reposição para sellers", description, openGraph), favicon novo.
3. Logo: criar `src/components/brand/Logo.tsx` (wordmark "estoca" em fonte Sora 700 minúscula + símbolo — enquanto não houver SVG final, wordmark tipográfico com um cubo Lucide `Package` em `text-primary` serve de placeholder). Usar no sidebar, login e registro.
4. Traduzir placeholder da busca global ("Start type to search group…" → "Buscar produtos, pedidos…").
5. Telas de login/registro: aplicar nova identidade (fundo `background`, card centralizado, logo, primary nos botões).
6. Empty states: dashboard/telas vazias de conta nova devem mostrar CTA "Conectar Mercado Livre" em vez de gráficos zerados.

### 6.5 Sidebar e chassi

- Sidebar: fundo `bg-card` com `border-r`, item ativo com fundo `bg-primary/10` + texto `text-primary` + barra lateral de 3px `bg-primary`; agrupar seção "Canais" (Mercado Livre) preparada para futuros canais.
- Header: altura 56px, busca (placeholder PT), toggle de tema, notificações, menu do usuário — tudo com tokens.
- Redesenhar com os novos padrões as 3 telas vitrine: **Dashboard** (KPIs unificados com dados ML), **Reposição** e **Análise de Vendas ML** — são as telas de screenshot da landing.

### Critério de aceite da Fase 6
Zero ocorrências de "Vendexy"/"PStock"/"Reponha" no código (marca é "Estoca"); zero emojis em strings de UI; `grep bg-white src --include=*.tsx` retorna vazio; dark mode íntegro em todas as telas; lighthouse sem regressão; visual consistente entre todas as páginas.

---

## Variáveis de ambiente (produção — já configuradas, conferir após mudanças)
`DATABASE_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `ML_CLIENT_ID`, `ML_CLIENT_SECRET`, `ML_REDIRECT_URI` (= `https://<dominio>/configuracoes`), `BLING_CLIENT_ID`, `BLING_CLIENT_SECRET`, `BLING_REDIRECT_URI` (= `https://<dominio>/api/bling/auth/callback`). Redirect URIs devem bater exatamente com o cadastrado nos apps do ML e do Bling. Vercel só aplica env novas em novo deploy.

## Verificação final (rodar após cada fase em produção)
1. `/configuracoes`: sem toasts de erro; contas ML listadas; sincronizar funciona; histórico carrega.
2. Fluxo Bling completo: conectar → importar produtos → "Atualizar Estoque Bling" sem erro.
3. `/produtos`: carrega sem loading infinito; "Atualizar Dados ML" mostra toast de sucesso.
4. `/mercado-livre`, `/mercado-livre/produtos`, `/mercado-livre/vendas`: valores monetários formatados, sem métricas impossíveis.
5. `/gestao-pedidos`: pedidos concluídos com produtos e valores reais.
6. Console do navegador: zero 404/405 nas rotas `/api/*` navegando por todas as telas.
