# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development
- `npm run dev` - Start development server on http://localhost:3000
- `npm run build` - Build the application for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint for code quality checks

### Database
- `npm run seed` - Seed the database with initial data
- `npx prisma migrate dev` - Run database migrations in development
- `npx prisma studio` - Open Prisma Studio to view/edit database
- `npx prisma generate` - Generate Prisma client (runs automatically on install)

### Testing
- No specific test commands configured - check with user before running tests

### Mercado Livre Integration
- `npm run test:ml` - Test ML configuration
- `npm run setup:https` - Setup HTTPS certificates
- `npm run sync:ngrok` - Sync ngrok configuration
- `npm run test:auth` - Test authentication domain

## Architecture Overview

This is a **Next.js 15** inventory management system (estoque-api) with the following key architectural patterns:

### Tech Stack
- **Frontend**: Next.js 15 App Router, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with Google OAuth and credentials
- **UI Components**: Radix UI primitives with custom styling
- **Charts**: Recharts for dashboard visualizations
- **File Processing**: Excel export/import (xlsx), PDF generation (jspdf)
- **External Integrations**: Mercado Livre API for marketplace synchronization

### Project Structure

#### Authentication Flow
- Route-based authentication using NextAuth.js
- Middleware protection (`src/middleware.ts`) for all routes except `/login` and `/register`
- Supports both Google OAuth and email/password authentication
- User sessions managed through JWT tokens
- Special handling for Mercado Livre OAuth callbacks via ngrok URLs

#### Database Schema (Key Models)
- **User**: Core user entity with authentication data
- **Produto**: Products with SKU, EAN, and kit support
- **Estoque**: Inventory levels per product per warehouse
- **Armazem**: Warehouses for inventory organization
- **PedidoCompra**: Purchase orders with supplier relationships
- **Fornecedor**: Supplier management
- **Saida**: Inventory exits/outgoing transactions
- **Componente**: Kit-product relationships (many-to-many)
- **MercadoLivreAccount**: OAuth accounts for ML integration
- **ProdutoMercadoLivre**: Product synchronization with ML listings
- **MercadoLivreSyncHistory**: Sync operation tracking
- **MercadoLivreWebhook**: Webhook notifications from ML

#### API Route Structure
All API routes follow RESTful patterns under `src/app/api/`:
- `/auth/[...nextauth]` - Authentication endpoints
- `/produtos` - Product CRUD operations
- `/estoque` - Inventory management
- `/pedidos-compra` - Purchase order management
- `/fornecedores` - Supplier management
- `/saida` - Inventory exit transactions
- `/dashboard/*` - Analytics and reporting endpoints
- `/mercadoLivre/*` - ML integration endpoints (sync, webhooks)

#### Frontend Architecture
- **App Router**: Uses Next.js 13+ app directory structure
- **Route Groups**: `(auth)` for login/register, `(root)` for authenticated pages
- **Layout Hierarchy**: Root layout → Dashboard wrapper → Page-specific layouts
- **Component Organization**:
  - Page-level components in route directories
  - Shared UI components in `src/components/ui/`
  - Business logic components in feature-specific folders
- **Dark Mode Support**: Complete theme system with tw-colors package

### Key Business Logic

#### Inventory Management
- Multi-warehouse support with per-warehouse stock levels
- Kit products (bundles) with component relationships
- Average cost tracking (`custoMedio`) for products
- Safety stock levels (`estoqueSeguranca`) for reorder points
- Barcode scanning integration for warehouse operations

#### Purchase Order Workflow
- Supplier-based ordering system
- Cost tracking with multipliers for pricing variations
- Status management for order lifecycle
- Integration with inventory receiving

#### Mercado Livre Integration
- OAuth 2.0 flow with automatic ngrok detection for local development
- Product synchronization with ML listings
- Webhook handling for real-time updates
- SKU-based product matching
- Sync history and error tracking
- Support for multiple ML accounts per user

#### User Isolation
All data is user-scoped - each user can only access their own:
- Products, warehouses, suppliers, orders
- ML accounts and synchronized products
- Authentication enforced at API level through middleware headers

### Important Development Notes

#### Database Considerations
- All currency values stored as integers (cents) for precision
- UUIDs used for most primary keys, auto-increment for some junction tables
- Prisma schema includes complex relationships between products and kits
- Migration history shows evolution of currency handling and ML integration

#### Authentication Patterns
- User ID automatically injected into request headers via middleware
- All API routes should validate user ownership of resources
- Session management handled entirely through NextAuth.js
- Special middleware handling for ML OAuth callbacks from ngrok

#### Component Patterns
- Heavy use of Radix UI for accessible components
- Form handling with react-hook-form and Zod validation
- Loading states and skeleton components for better UX
- Excel export functionality built into key listing pages
- Dark mode toggle with system preference detection

#### Mercado Livre Development
- Local development requires ngrok for HTTPS callbacks
- ML OAuth flow handles automatic redirection between ngrok and localhost
- Comprehensive debug panel for troubleshooting ML integration
- Environment variables required: `ML_CLIENT_ID`, `ML_CLIENT_SECRET`, `ML_REDIRECT_URI`

### Environment Requirements
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Secret for JWT signing
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` - For OAuth authentication
- `ML_CLIENT_ID` & `ML_CLIENT_SECRET` - For Mercado Livre integration
- `ML_REDIRECT_URI` - HTTPS callback URL (use ngrok for local development)

### Important File Locations
- Main layout: `src/app/layout.tsx`
- Authentication config: `src/lib/auth.ts`
- Middleware: `src/middleware.ts`
- Database schema: `prisma/schema.prisma`
- Tailwind config: `tailwind.config.ts`
- Next.js config: `next.config.mjs` (includes ML image domains)