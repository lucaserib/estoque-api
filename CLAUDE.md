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

### Project Structure

#### Authentication Flow
- Route-based authentication using NextAuth.js
- Middleware protection (`src/middleware.ts`) for all routes except `/login` and `/register`
- Supports both Google OAuth and email/password authentication
- User sessions managed through JWT tokens

#### Database Schema (Key Models)
- **User**: Core user entity with authentication data
- **Produto**: Products with SKU, EAN, and kit support
- **Estoque**: Inventory levels per product per warehouse
- **Armazem**: Warehouses for inventory organization
- **PedidoCompra**: Purchase orders with supplier relationships
- **Fornecedor**: Supplier management
- **Saida**: Inventory exits/outgoing transactions
- **Componente**: Kit-product relationships (many-to-many)

#### API Route Structure
All API routes follow RESTful patterns under `src/app/api/`:
- `/auth/[...nextauth]` - Authentication endpoints
- `/produtos` - Product CRUD operations
- `/estoque` - Inventory management
- `/pedidos-compra` - Purchase order management
- `/fornecedores` - Supplier management
- `/saida` - Inventory exit transactions
- `/dashboard/*` - Analytics and reporting endpoints

#### Frontend Architecture
- **App Router**: Uses Next.js 13+ app directory structure
- **Route Groups**: `(auth)` for login/register, `(root)` for authenticated pages
- **Layout Hierarchy**: Root layout → Dashboard wrapper → Page-specific layouts
- **Component Organization**: 
  - Page-level components in route directories
  - Shared UI components in `src/components/ui/`
  - Business logic components in feature-specific folders

### Key Business Logic

#### Inventory Management
- Multi-warehouse support with per-warehouse stock levels
- Kit products (bundles) with component relationships
- Average cost tracking (`custoMedio`) for products
- Safety stock levels (`estoqueSeguranca`) for reorder points

#### Purchase Order Workflow
- Supplier-based ordering system
- Cost tracking with multipliers for pricing variations
- Status management for order lifecycle
- Integration with inventory receiving

#### User Isolation
All data is user-scoped - each user can only access their own:
- Products, warehouses, suppliers, orders
- Authentication enforced at API level through middleware headers

### Important Development Notes

#### Database Considerations
- All currency values stored as integers (cents) for precision
- UUIDs used for most primary keys, auto-increment for some junction tables
- Prisma schema includes complex relationships between products and kits
- Migration history shows evolution of currency handling and constraint updates

#### Authentication Patterns
- User ID automatically injected into request headers via middleware
- All API routes should validate user ownership of resources
- Session management handled entirely through NextAuth.js

#### Component Patterns
- Heavy use of Radix UI for accessible components
- Form handling with react-hook-form and Zod validation
- Loading states and skeleton components for better UX
- Excel export functionality built into key listing pages

### Environment Requirements
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Secret for JWT signing
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` - For OAuth authentication