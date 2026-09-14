repo: lucaserib/estoque-api
branch: master
path: src

## Last sync
date: 2026-09-06T00:00:00Z

### Updated in this project
- Novo layout completo do app (12 telas) em `Leap Store.dc.html`
- Marca Leap Store (verde + grafite) mantida; estrutura Modernist: grid rígido, réguas de 2px, tudo alinhado à esquerda, zero arredondamento
- Temas claro e escuro via tokens equivalentes aos de `styles/global.css`
- Navegação lateral reorganizada em Operação / Canais / Sistema

## Screen map
| Tela no projeto | Arquivos de origem |
| --- | --- |
| Shell (sidebar, topbar) | src/app/components/layout/Sidebar.tsx, src/app/DashboardWrapper.tsx, styles/global.css |
| Visão geral | src/app/(root)/dashboard/page.tsx |
| Produtos | src/app/(root)/produtos/page.tsx, produtos/components/ProdutoTableRow.tsx |
| Detalhe do produto | src/app/(root)/produtos/[id]/page.tsx |
| Reposição | src/app/(root)/reposicao/page.tsx |
| Saídas | src/app/(root)/saidas/page.tsx |
| Pedidos de compra | src/app/(root)/gestao-pedidos/page.tsx |
| Fornecedores | src/app/(root)/fornecedores/page.tsx |
| ML · Vendas | src/app/(root)/mercado-livre/vendas/page.tsx, mercado-livre/page.tsx |
| ML · Anúncios | src/app/(root)/mercado-livre/produtos/page.tsx, produtos/vincular/page.tsx |
| Integrações | src/app/(root)/configuracoes/page.tsx, src/lib/blingApi.ts |
| Configurações | src/app/(root)/configuracoes-gerais/page.tsx |
| Usuários | src/lib/auth.ts |
| Login | src/app/(auth)/ |
