# Diagnóstico ML + Bling — pós-vinculação (04/07/2026)

**App:** https://estoque-api-4iqj.vercel.app (testado logado) + código local `~/Projects/estoque-api` (branch master, commit `8b374a7`).

As credenciais OAuth foram configuradas corretamente (problema do relatório anterior resolvido). Os problemas atuais são **bugs de código**, confirmados no site e no repositório. São 3 causas raiz.

---

## Causa 1 — Mercado Livre: pasta duplicada `mercadoLivre` vs `mercadolivre` no git (o maior problema)

**Sintoma no site:** toast vermelho "Erro ao carregar produtos", produtos (0), telas do ML vazias.

**Evidência (testado em produção):**

| Chamada | Status |
|---|---|
| `GET /api/mercadoLivre/produtos?accountId=...` (L maiúsculo) | **200 OK** |
| `GET /api/mercadolivre/produtos?accountId=...` (minúsculo — como o front chama) | **404** |

**Explicação:** no seu Mac o sistema de arquivos não diferencia maiúsculas, então tudo parece uma pasta só (`mercadolivre`) e **funciona localmente**. Mas o git (por causa do histórico + `core.ignorecase=true`) guarda **duas pastas**:

- `src/app/api/mercadoLivre/**` — 36 rotas (produtos, produtos/link, dashboard/metrics, auto-sync, precos-batch, sync/auto-stock, analytics/sales*, analytics/restock, orders, alerts…)
- `src/app/api/mercadolivre/**` — só 3 rotas (auth, analytics, sync)

No Vercel (Linux, case-sensitive) isso vira dois caminhos diferentes. O frontend chama **tudo em minúsculo** → só auth/analytics/sync respondem; todo o resto retorna 404. Por isso a vinculação funcionou (auth é minúsculo) mas nada depois dela funciona.

**Correção (no seu Mac, na raiz do projeto):**

```bash
# unificar a caixa no índice do git (o disco não muda, só o git)
git rm -r --cached "src/app/api/mercadoLivre"
git add src/app/api/mercadolivre
git status   # deve mostrar renames mercadoLivre/* -> mercadolivre/*
git commit -m "fix: unificar caixa da pasta api/mercadolivre (case-sensitive no Vercel)"
git push
```

> Obs.: há um `.git/index.lock` órfão no repositório — apague-o antes (`rm .git/index.lock`) se o git reclamar.

---

## Causa 2 — Mercado Livre: front chama rotas que não existem em lugar nenhum

Mesmo após corrigir a Causa 1, restam dois desencontros front ↔ back (falham **também localmente**):

1. **`/api/mercadolivre/produtos-inteligente`** — chamada em `src/app/components/MercadoLivreSmartSync.tsx` (linhas 113, 134, 163). A pasta da rota existe mas está **vazia** (sem `route.ts`), e nunca foi commitada. As pastas `produtos-realtime/` e `debug-produtos/` também estão vazias.
   - **Fix sugerido:** apontar o componente para rotas existentes — `GET /api/mercadolivre/produtos` (já suporta modo "smart") e `POST /api/mercadolivre/quick-sync` ou `/api/mercadolivre/sync` — ou criar a rota.

2. **`GET /api/mercadolivre/sync`** — `configuracoes/page.tsx` faz GET nas linhas 604 (`loadProducts`) e 622 (`loadSyncHistory`), mas `sync/route.ts` só exporta **POST** → **405** com corpo vazio (é isso que gera o `Unexpected end of JSON input` no console).
   - **Fix sugerido:** `loadProducts` → `GET /api/mercadolivre/produtos?accountId=...`; histórico → criar handler GET no `sync/route.ts` (action=history) ou usar `analytics?type=sync`.

**Nota funcional:** o POST de sincronização **funciona** (testei: `{"success":true,"totalItems":0}`), token ML válido — porém a conta ML vinculada (`lucasemanuelribeiro@hotmail.com`, tipo "normal") tem **0 anúncios**. Se os anúncios da loja estão na conta ML da Leap Store, desconecte e vincule a conta certa.

---

## Causa 3 — Bling: o callback corrompe o userId (por isso "vinculei" mas não salva)

**Sintoma:** você autoriza no Bling, volta pro app, mas a tela continua "Conectar Bling". Confirmado: `GET /api/bling/auth?action=accounts` retorna `[]` — **nenhuma conta Bling salva no banco**.

**Causa (bug):**

- `api/bling/auth/route.ts` gera: `state = "${user.id}-${Date.now()}-${random}"`
- `api/bling/auth/callback/route.ts` (linha ~31) recupera: `const userId = state.split("-")[0]`
- Só que `user.id` é **UUID e contém hífens** (`983b38a1-6fe7-481c-...`). O split devolve só o primeiro pedaço (`983b38a1`) → o `blingAccount.create` viola a foreign key com `User` → exceção → redirect com `bling_error=connection_failed` → conta nunca é salva.

**Correção (2 linhas):**

```ts
// api/bling/auth/route.ts — usar separador que não existe em UUID
const state = `${user.id}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

// api/bling/auth/callback/route.ts
const userId = state.split("_")[0];
```

O restante do fluxo Bling (Basic Auth, troca de código por token, refresh) está correto — depois desse fix a vinculação deve concluir.

---

## Bugs secundários (mesma classe de problema)

1. `POST /api/estoque/calcular-media-saidas` — chamado por `EstoqueSegurancaCalculator.tsx`, rota **não existe**.
2. `/api/produtos/buscar-por-ean` — chamado por `BarcodeScannerSelecaoProdutos.tsx`, rota **não existe**.
3. **PKCE do ML em memória** (`codeVerifierCache`, Map em `mercadoLivreService.ts:33`): no Vercel, connect e callback podem cair em instâncias diferentes → falha intermitente "code verifier não encontrado" ao vincular. Persistir no banco.
4. `env.example` continua sem as 3 variáveis `BLING_*`.

---

## Ordem recomendada

1. Fix do Bling (Causa 3) — 2 linhas, destrava a vinculação.
2. Fix de caixa do git (Causa 1) — commit + push + deploy, destrava quase todo o módulo ML em produção.
3. Ajustar chamadas do front (Causa 2) — destrava listagem/histórico na tela de configurações e o SmartSync.
4. Vincular a conta ML correta da loja (a atual tem 0 anúncios).
5. Secundários quando der.
