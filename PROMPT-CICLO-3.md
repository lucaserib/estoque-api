# Estoca — Ciclo 3: Central de Produtos e Fechamento para Produção

Documento autocontido de execução. Diagnóstico verificado em produção em 23/08/2026 com a conta real **Leap Store** (leapstoreoficial@gmail.com, 35 produtos, 55 anúncios ML). Execute as fases na ordem. Ao final de cada fase: `npx tsc --noEmit` e `npx next lint` sem erros, e um commit descritivo em português.

## Diretrizes de código (valem para todas as fases)
1. Sem comentários em código. Nomes de funções, variáveis e tipos devem explicar a intenção. Remova comentários existentes dos arquivos que editar.
2. TypeScript estrito: sem `any` novos, retornos explícitos em serviços e rotas, interfaces para payloads.
3. Toda rota de API: `verifyUser(request)`, validação de entrada com Zod, verificação de posse pelo `userId`, erros tipados `{ error, code? }`, sem vazar stack trace.
4. Prisma sempre via singleton `@/lib/prisma`. Nunca `new PrismaClient()` em rota.
5. UI só com tokens (`bg-card`, `text-muted-foreground`, `--primary`). Proibido `bg-white`, `bg-gray-*`, hex hardcoded e emoji em texto de interface.
6. Skeleton em carregamento, empty state com CTA, erro com mensagem humana e ação de recuperação.
7. Valores monetários locais em centavos (Int no banco, `formatBRL`); valores vindos da API do ML em reais (`formatBRLReais`). Nunca misturar.

---

## Já corrigido neste ciclo (não refazer)
- IDOR em `/api/estoque/[armazemId]`, `/api/estoque/produto/[produtoId]` e `/api/mercadolivre/analytics`: agora exigem `verifyUser` e validam posse do recurso.
- 12 rotas migradas de `new PrismaClient()` para o singleton (evita esgotar o pool do Postgres em serverless).
- `src/lib/mlOrders.ts`: coleta paginada de pedidos do ML com retry e backoff exponencial, detecção de dados parciais e limite de 2000 pedidos.
- `sales-complete` passa a lançar `PartialOrdersError` (HTTP 503) em vez de devolver receita parcial como se fosse total.
- TTL de cache de vendas/analytics reduzido de 15–20 min para 3 min.

---

## FASE A — Confiabilidade dos números (concluir o que foi iniciado)

### Diagnóstico
Com a Leap Store, a mesma rota `/api/mercadolivre/analytics/sales-complete?period=30` devolveu **R$ 6.086,71 / 182 pedidos** e minutos depois **R$ 2.197,16 / 49 pedidos**. O Dashboard exibia R$ 6.086,71 (+62,2%) enquanto a Análise de Vendas exibia R$ 2.197,16 (−41,5%) no mesmo período. Causas: paginação que interrompia silenciosamente em erro (`hasMore = false` no catch), teto fixo de 500/300 pedidos e cache em memória por instância serverless.

### O que falta
1. Aplicar `fetchAllOrders` de `@/lib/mlOrders` em **todas** as rotas que ainda paginam pedidos manualmente: `analytics/sales`, `analytics/sales-detailed`, `analytics/sales-optimized`, `analytics/revenue-complete`, `analytics/performance`, `orders`, `saida/vendas-ml`. Buscar por `while (hasMore` e `offset <` e substituir; nenhuma delas pode engolir erro.
2. Consolidar as rotas duplicadas de analytics: manter `sales-complete` como fonte única de verdade de vendas e remover/redirecionar `sales`, `sales-detailed`, `sales-optimized`, `revenue-complete`. Telas diferentes lendo rotas diferentes é o que produz números divergentes.
3. Cache compartilhado: o cache em `Map` não é compartilhado entre instâncias serverless. Migrar `src/lib/cache.ts` para Upstash Redis (`@upstash/redis`, plano gratuito) mantendo a mesma interface `withCache`. Enquanto não migrar, manter TTL de 3 min.
4. No frontend, tratar HTTP 503 com `code: "ML_DADOS_PARCIAIS"` exibindo aviso "Não foi possível carregar todos os pedidos — tente novamente" com botão de recarregar, em vez de mostrar número incompleto.
5. Teste de regressão: chamar `sales-complete` 5 vezes seguidas e afirmar que `summary.totalRevenue` é idêntico nas 5.

### Aceite
Dashboard e Análise de Vendas exibem exatamente o mesmo valor para o mesmo período; cinco chamadas seguidas retornam o mesmo total; nenhuma rota de pedidos interrompe paginação em silêncio.

---

## FASE B — Central de Produtos (SKU como chave única)

### Diagnóstico
`/produtos` hoje é uma lista sem imagem, sem fornecedor, sem prazo de entrega, com "Custo Médio: Não Definido" na maioria dos itens, "Estoque Local 0" em todos e coluna "Ações" vazia. Como o estoque local está zerado, a Reposição calcula sobre base vazia e o "Valor do Estoque Local" no Home aparece R$ 0,00.

### Modelo de dados
Ampliar `Produto` no Prisma:
- `imagemUrl String?`, `imagemThumbUrl String?`
- `descricao String?`, `marca String?`, `categoria String?`
- `pesoGramas Int?`, `alturaCm Int?`, `larguraCm Int?`, `comprimentoCm Int?`
- `ativo Boolean @default(true)`
- Garantir unicidade real do SKU por usuário: `@@unique([userId, sku])`.

Ampliar `ProdutoFornecedor` (relação produto–fornecedor):
- `prazoEntregaDias Int?`
- `precoUnitario Int?` (centavos)
- `quantidadeMinima Int?`
- `principal Boolean @default(false)`
- `codigoNoFornecedor String?`
- `@@unique([produtoId, fornecedorId])`

Regra de negócio: **o SKU é a chave de integração**. Toda importação (Bling, ML) e todo vínculo devem casar por `userId + sku` normalizado (trim + uppercase). Criar `src/lib/sku.ts` com `normalizeSku(value: string): string` e usar em todos os pontos de matching.

### Backend
1. `GET /api/produtos`: retornar imagem, fornecedor principal (nome + prazo + preço), custo médio, estoque local agregado e vínculo ML, em **uma única query** com `include` — sem N+1 e sem chamada por linha.
2. `GET /api/produtos/[id]`: ficha completa (dados, imagem, fornecedores com prazos, estoque por armazém, anúncios ML vinculados, histórico de compras).
3. `POST/PUT/DELETE /api/produtos/[id]/fornecedores`: gerenciar vínculos com prazo, preço, quantidade mínima e fornecedor principal; validar posse de produto e fornecedor pelo `userId`.
4. Imagens: ao importar do ML, gravar `thumbnail`/`pictures[0].secure_url` em `imagemUrl`; ao importar do Bling, usar a imagem do produto. Registrar os domínios em `next.config.mjs` (`http2.mlstatic.com`, `mlb-s1-p.mlstatic.com`, `bling.com.br`) para o `next/image`.
5. Upload manual de imagem quando não houver origem: aceitar URL ou arquivo (Vercel Blob), limite de 2 MB, apenas jpg/png/webp.

### Frontend `/produtos`
1. Tabela com miniatura (40×40, fallback com ícone quando sem imagem), nome, SKU, fornecedor principal + prazo ("Fujioka · 15 dias"), estoque local, Full, vendas ML, custo médio e coluna **Ações funcional** (Ver ficha, Editar, Vincular ML, Excluir).
2. Filtros: busca por nome/SKU/EAN, fornecedor, com/sem estoque, vinculado/não vinculado ao ML, sem custo definido.
3. Ações em lote: definir fornecedor, definir custo médio, ajustar estoque.
4. Ficha do produto (`/produtos/[id]`) em abas: **Dados** (imagem, nome, SKU, EAN, dimensões) · **Fornecedores** (lista com prazo, preço, mínimo, marcar principal) · **Estoque** (por armazém, com ajuste) · **Mercado Livre** (anúncios vinculados, preço, estoque Full) · **Histórico** (compras e saídas).
5. Alerta no topo da lista quando houver produtos sem custo médio ou sem fornecedor, com atalho para completar — é o que hoje trava a Reposição.

### Aceite
Lista mostra imagem, fornecedor e prazo; ficha do produto abre e permite adicionar fornecedor com prazo; SKU duplicado é bloqueado com mensagem clara; importação ML/Bling casa por SKU normalizado; nenhuma requisição por linha da tabela.

---

## FASE C — Bling: reconexão e conclusão do fluxo

### Diagnóstico
A conta Bling da Leap Store está no banco com `isActive: false` e `expiresAt: 2025-10-12` (refresh token expirado por inatividade). `GET /api/bling/auth?action=accounts` já devolve `isActive`, mas a tela `/produtos/importar` continua tratando a existência do registro como "conectado".

### O que falta
1. `/produtos/importar` e o botão "Atualizar Estoque Bling": considerar conectado apenas `isActive === true`; havendo conta inativa, exibir card âmbar "Conexão com o Bling expirou" com botão **Reconectar** apontando para `action=connect`.
2. Confirmar que o cron `/api/cron/bling-refresh` está registrado em `vercel.json` e protegido por `CRON_SECRET`; sem ele o refresh token volta a expirar por inatividade.
3. Após o deploy, o dono precisa clicar **Reconectar** uma vez e autorizar no Bling — nenhum código resolve isso, o token atual está morto.
4. Validar a importação ponta a ponta: paginação completa, backoff em HTTP 429, upsert idempotente por SKU normalizado e resumo `{ criados, atualizados, ignorados, erros[] }` exibido na tela.

### Aceite
Conta expirada mostra CTA de reconexão; após reconectar, importação traz os produtos com imagem e resumo numérico; "Atualizar Estoque Bling" conclui sem erro.

---

## FASE D — Estoque local utilizável

### Diagnóstico
Todos os 35 produtos estão com estoque local 0 e o Home mostra "Valor do Estoque Local R$ 0,00". Sem estoque local e sem custo médio, Reposição e valor de estoque não têm base de cálculo — o app perde metade da proposta de valor.

### O que falta
1. Importação inicial de estoque: tela para subir planilha (CSV/XLSX) com `sku, quantidade, custoMedio, armazem`, com pré-visualização, validação por SKU normalizado e relatório de linhas aceitas/rejeitadas.
2. Ajuste rápido de estoque na própria lista de produtos (input inline com confirmação), gerando registro de movimentação.
3. Puxar estoque Full do ML para um armazém "Full" automaticamente na sincronização, mantendo-o somente-leitura.
4. Reposição: quando não houver custo médio, exibir "custo não definido" com link para preencher, em vez de calcular R$ 0,00 silenciosamente — hoje a tela mostra "Custo Total R$ 2.638,14" no topo e "R$ 0,00" nas linhas, o que é contraditório.

### Aceite
Planilha de estoque importa e reflete no Home e na Reposição; linhas sem custo aparecem sinalizadas, nunca como R$ 0,00; Reposição bate com a soma das linhas.

---

## FASE E — Fechamento para produção

1. **Sentry** (`@sentry/nextjs`) em client e server, com `tracesSampleRate` baixo. Sem monitoramento, falhas de sincronização dos clientes passam despercebidas.
2. **Limpeza de logs**: remover `console.log` de rotas e serviços em produção (há dezenas com IDs e dados de conta); manter apenas `console.error` de exceção.
3. **Rate limiting** nas rotas de sincronização e importação (por usuário) para não estourar cota do ML/Bling.
4. **Domínio próprio** + atualização de `ML_REDIRECT_URI` e `BLING_REDIRECT_URI` nos apps do ML e do Bling.
5. **Termos de uso e política de privacidade (LGPD)** — o sistema guarda tokens OAuth e dados de vendas de terceiros.
6. **Backup automático** do Postgres e verificação de restauração.
7. **Onboarding**: wizard de 3 passos (conectar ML → importar produtos/estoque → ver reposição) para conta nova não cair em dashboard vazio.
8. **Pagamento (Asaas)**: tabela `Subscription`, criação de customer/assinatura, webhook `/api/asaas/webhook` tratando `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE` e `SUBSCRIPTION_DELETED`, middleware de paywall e trial de 14 dias sem cartão.

---

## Verificação final (produção)
1. Dashboard e Análise de Vendas com o mesmo número para o mesmo período, estável em 5 recargas.
2. `/produtos` com imagem, fornecedor, prazo e ações funcionando; ficha do produto completa.
3. Bling reconectado, importação com resumo, estoque atualizando.
4. Reposição coerente com estoque e custos reais.
5. Console do navegador sem erros e sem requisições 404/405 em todas as telas.
6. Nenhuma rota de API responde sem autenticação (testar com sessão deslogada).
