# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development
- `npm run dev` - Start development server on http://localhost:3000
- `npm run build` - Run `prisma migrate deploy` then build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint for code quality checks

### Database
- `npm run seed` - Seed the database with initial data
- `npx prisma migrate dev` - Run database migrations in development
- `npx prisma studio` - Open Prisma Studio to view/edit database
- `npx prisma generate` - Generate Prisma client (runs automatically on install)

### Testing
- `npm test` - Run the Vitest suite (`vitest run`)
- Tests live beside the code they cover, in `__tests__/` folders (services, lib, and API routes all have coverage)

### Mercado Livre Integration
- `npm run test:ml` - Test ML configuration
- `npm run setup:https` - Setup HTTPS certificates
- `npm run sync:ngrok` - Sync ngrok configuration
- `npm run test:auth` - Test authentication domain

## Architecture Overview

This is a **Next.js 15** inventory management system (estoque-api / Leap Stock) with Bling and Mercado Livre integrations.

### Tech Stack
- **Frontend**: Next.js 15 App Router, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with Google OAuth and credentials
- **Testing**: Vitest
- **UI Components**: Radix UI primitives with custom styling
- **Charts**: Recharts for dashboard visualizations
- **File Processing**: Excel export/import (xlsx), PDF generation (jspdf)
- **External Integrations**: Bling (ERP) and Mercado Livre (marketplace)

### Project Structure

#### Authentication Flow
- Route-based authentication using NextAuth.js
- Middleware protection (`src/middleware.ts`) for all routes except `/login`, `/register`, and everything under `/api/*` (API routes authenticate themselves via `verifyUser`, not the middleware)
- Supports both Google OAuth and email/password authentication
- User sessions managed through JWT tokens; the `jwt` callback in `src/lib/auth.ts` re-reads `role`/`contaId` from the database every 5 minutes so a role change or account-sharing change takes effect without forcing logout
- Special handling for Mercado Livre OAuth callbacks via ngrok URLs

#### Contas e papéis (multi-usuário)
- `User.contaId` points at the account owner (`null` for the owner itself). Every business table's `userId` column is populated with the **owner's** id (`contaId`), not the id of whoever performed the action — see `src/helpers/verifyUser.ts`, which returns `{ ...user, contaId: user.contaId ?? user.id }`.
- Always scope business-data queries by `user.contaId`, never by `user.id`. The one exception is audit/attribution fields (`EstoqueMovimentacao.userId`, `Notification` recipient) and rate-limit keys, which intentionally use `user.id` (who did it / who should see it), not the account.
- `src/lib/permissoes.ts` holds the role matrix (`ADMIN`, `COMPRAS`, `ESTOQUE`, `VENDAS`, `LEITURA`) and the `exigirPermissao`/`exigirVisualizacao`/`podeVer` helpers. `VER_CUSTO` is the permission that gates cost, margin, and purchase-value fields across the app (dashboard, reposição, etc.) — not every route enforces it server-side yet, so don't assume a field is hidden just because the UI hides it.

#### Database Schema (Key Models)
- **User**: Core user entity; `role` + `contaId` drive permissions and data isolation
- **ConfiguracaoGeral**: Per-account settings (tax rate for margin calc, replenishment lead-time fallback, last critical-pendency count for notifications)
- **Produto**: Products with SKU, EAN, kit support (`isKit` + `Componente`), and `custoOrigem`/`precoOrigem` tracking where each value came from
- **Estoque**: Inventory levels per product per warehouse; `Armazem.tipo` distinguishes `LOCAL` from `FULL_ML` so Full stock is never double-counted with local stock
- **PedidoCompra** / **PedidoProduto**: Purchase orders; `PedidoProduto.quantidade` is boxes/packs, `multiplicador` is units per box — total units received is always `quantidade * multiplicador`
- **Fornecedor** / **ProdutoFornecedor**: Supplier management; `principal: true` marks the preferred supplier used by replenishment and margin calculations
- **BlingAccount** / **MercadoLivreAccount**: OAuth accounts; both use a distributed refresh lock (`pg_advisory_xact_lock`) so concurrent serverless instances don't race on token refresh — see `BlingService.refreshWithLock` / `MercadoLivreService.refreshWithLock`
- **ProdutoMercadoLivre**: One row per ML listing, including margin inputs (`mlTarifaVenda`, `mlCustoFrete`) and the Full stock snapshot (`mlFullDisponivel`, `mlFullEmTransito`, `mlFullIndisponivel`) written during sync — screens read this snapshot, they never call the ML API per product
- **BlingWebhookEvent** / **MercadoLivreWebhook**: Webhook delivery logs, deduplicated by the provider's event id

#### API Route Structure
API routes live under `src/app/api/`. A few route families exist in more than one variant from earlier iterations (e.g. `mercadolivre/analytics/sales-complete` vs `sales-optimized`, `produtos` vs `produtos-simple`/`produtos-inteligente`/`produtos-dinamicos`) — **`grep` for real callers before touching or deleting any of them**, don't assume the newest-looking one is the active one.

#### Frontend Architecture
- **App Router**: Next.js 15 app directory structure
- **Route Groups**: `(auth)` for login/register, `(root)` for authenticated pages
- **Component Organization**: page-level components in route directories, shared UI in `src/components/ui/`, feature-specific components in their own folders
- **Dark Mode Support**: theme system with `tw-colors`

### Fonte da verdade de cada dado

Quando um número parecer errado, confira primeiro **de onde ele vem** antes de tentar corrigi-lo no lugar errado:

- **Preço, estoque, status do anúncio ML**: sincronizados para `ProdutoMercadoLivre` por `sync/route.ts` e pelo processamento de webhook (`MercadoLivreService.processItemWebhook`) — nunca busque isso na tela, leia a coluna já sincronizada.
- **Tarifa de venda e custo de frete do ML**: `ProdutoMercadoLivre.mlTarifaVenda`/`mlCustoFrete`, obtidos de `listing_prices` e `shipping_options/free` durante a mesma sincronização. `null` significa "ainda não sincronizado", nunca é estimado.
- **Estoque Full (disponível/em trânsito)**: `ProdutoMercadoLivre.mlFull*`, vindo de `GET /inventories/{id}/stock/fulfillment`. As telas de reposição e o dashboard leem esse snapshot, não chamam a API do ML por produto.
- **Custo médio do produto**: `Produto.custoMedio`, calculado em `src/lib/custo.ts` com prioridade: custo manual/planilha preservado → média ponderada de compras confirmadas → preço do fornecedor no Bling → preço do produto no Bling → `null`. Produto-kit usa a soma do custo dos componentes; se faltar algum, o custo do kit fica `null` (nunca parcial).
- **Margem**: calculada sob demanda por `calcularMargemUnitaria` (`src/lib/margem.ts`), nunca persistida — sempre recalculada a partir de preço/tarifa/frete/custo/alíquota do momento.
- **Pendências de cadastro** (sem custo, sem fornecedor, margem negativa etc.): `calcularPendencias` (`src/lib/pendencias.ts`), orquestrado por `src/services/pendenciasService.ts`, cacheado por 60s por conta.
- **Sugestão de reposição**: `src/services/reposicaoService.ts` — demanda vem de pedidos pagos do ML (uma chamada por conta, nunca por produto) mais saídas manuais, explodida por kit; estoque disponível soma local + Full (do snapshot) + pedidos de compra em aberto.
- **Saldo de estoque do Bling**: gravado em `Estoque.quantidade` pela sincronização (`blingProductSync.ts`); `EstoqueMovimentacao.origem` registra se a última mudança veio do Bling ou de outra fonte (usado para detectar divergência).

### Key Business Logic

#### Inventory Management
- Multi-warehouse support with per-warehouse stock levels (`Armazem.tipo`: `LOCAL`, `FULL_ML`, `OUTRO`)
- Kit products (bundles) with component relationships; kit sales explode into component demand for replenishment
- Average cost tracking (`custoMedio`) for products — see "fonte da verdade" above
- Safety stock levels (`estoqueSeguranca` / `StockReplenishmentConfig.safetyStock`) for reorder points

#### Purchase Order Workflow
- Supplier-based ordering system; `status: "pendente"` = open/not yet received, `"confirmado"` = received (sets `dataConclusao`)
- Cost tracking with `multiplicador` (units per box) for pricing variations
- `POST /api/replenishment/gerar-pedidos` drafts purchase orders automatically from replenishment suggestions, grouped by preferred supplier

#### Bling Integration
- OAuth 2.0 with JWT tokens (`enable-jwt: "1"` header required on every authenticated call — Bling silently returns opaque tokens without it)
- Distributed refresh lock shared with the ML integration's pattern (`BlingService.refreshWithLock`)
- Webhooks at `/api/bling/webhook`, HMAC-signed, deduplicated by `eventId`
- Rate-limited client (`src/lib/blingRateLimiter.ts`, 3 req/s per account)

#### Mercado Livre Integration
- OAuth 2.0 (PKCE) flow with automatic ngrok detection for local development
- Product synchronization with ML listings, including margin inputs and Full stock snapshot (see "fonte da verdade")
- Webhook handling validates `application_id`, always responds 200, deduplicates by notification `_id`
- SKU-based product matching
- Support for multiple ML accounts per user

#### User Isolation
All business data is scoped by **account** (`User.contaId`), not by individual user — see "Contas e papéis" above. Products, warehouses, suppliers, orders, ML/Bling accounts and synchronized products are all shared across every user in the same account; only the acting user's identity (`user.id`) is used for audit trails and notifications.

### Important Development Notes

#### Database Considerations
- All currency values stored as integers (cents) for precision — this applies throughout the codebase including `src/services/reposicaoService.ts` and `src/lib/margem.ts`; only convert to reais at the API response boundary for legacy UI contracts that still expect reais (documented inline where this happens)
- UUIDs used for most primary keys, auto-increment for junction tables (`Componente`, `PedidoProduto`, `ProdutoFornecedor`)

#### Authentication Patterns
- User ID automatically injected into request headers via middleware for page routes; API routes validate via `verifyUser(request)`, which also resolves `contaId`
- All API routes should scope business-data queries by `user.contaId`
- Session management handled entirely through NextAuth.js

#### Component Patterns
- Heavy use of Radix UI for accessible components
- Form handling with react-hook-form and Zod validation
- Loading states and skeleton components for better UX
- Dark mode toggle with system preference detection

#### Mercado Livre Development
- Local development requires ngrok for HTTPS callbacks
- ML OAuth flow handles automatic redirection between ngrok and localhost
- Environment variables required: `ML_CLIENT_ID`, `ML_CLIENT_SECRET`, `ML_REDIRECT_URI`

### Environment Requirements
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Secret for JWT signing
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` - For OAuth authentication
- `ML_CLIENT_ID` & `ML_CLIENT_SECRET` & `ML_REDIRECT_URI` - For Mercado Livre integration (HTTPS callback, use ngrok locally)
- `BLING_CLIENT_ID` & `BLING_CLIENT_SECRET` - For Bling integration
- `CRON_SECRET` - Bearer token required by every `/api/cron/*` route
- `TOKEN_ENCRYPTION_KEY` - 32-byte base64 key used to encrypt Bling/ML tokens at rest (see `src/lib/tokenCrypto.ts`)

### Important File Locations
- Main layout: `src/app/layout.tsx`
- Authentication config: `src/lib/auth.ts`
- Middleware: `src/middleware.ts`
- Database schema: `prisma/schema.prisma`
- Permission matrix: `src/lib/permissoes.ts`
- Margin / pendency / replenishment logic: `src/lib/margem.ts`, `src/lib/pendencias.ts`, `src/services/reposicaoService.ts`
- Tailwind config: `tailwind.config.ts`
- Next.js config: `next.config.mjs` (includes ML image domains)

### Ciclo atual
O histórico de auditorias e planos de execução por ciclo vive em `docs/` (`docs/AUDITORIA-CICLO-6.md` é o registro vivo do ciclo em andamento) e `docs/historico/` (ciclos e documentos anteriores já concluídos).
