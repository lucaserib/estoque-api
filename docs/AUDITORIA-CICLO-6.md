# Auditoria — Ciclo 6

Documento de referência do ciclo. Atualizado ao final de cada fase.

## Fase 0 — Linha de base

### Checks (03/10/2026)

- `npx tsc --noEmit`: limpo, 0 erros.
- `npx next lint`: limpo, 0 warnings/erros.
- `npm test` (vitest): 2 arquivos, 5 testes, todos passando. Cobertura ainda mínima — só os testes criados no Ciclo 5 para `sales-complete`.

### Restrição do ambiente

Não existe `DATABASE_URL` neste ambiente de execução (sem `.env`/`.env.local`). Não é possível conectar num banco real para rodar o script de contagem nem para validar nada que dependa de dados reais. O script somente-leitura foi escrito em `scripts/auditoria-ciclo-6-contagem.ts` (`npm run auditoria:ciclo-6`) e testado até o ponto de tentar a conexão (erro esperado: `Environment variable not found: DATABASE_URL`). **Falta rodar isso com acesso real ao banco de produção** — fica pendente para quem tiver a `DATABASE_URL`.

Disco local também ficou crítico durante esta sessão (chegou a 0 bytes livres uma vez; limpo com `rm -rf .next` e `npm cache clean --force`). Builds de produção (`next build`) serão evitados quando possível nas fases seguintes, usando `tsc`/`lint`/`test` como critério de validação por fase, com build completo só nos pontos de maior risco.

### Diagnóstico — status confirmado no código atual

#### Bling

| # | Status | Observação |
|---|---|---|
| B1 | **Confirmado** | Nenhum header `enable-jwt` em `exchangeCodeForTokens`, `refreshAccessToken` ou `apiFetch`. |
| B2 | **Confirmado** | `getValidToken`/`refreshAccountTokens` fazem leitura simples seguida de update, sem `pg_advisory_xact_lock` nem `Map` de coalescência em memória (o ML já tem esse segundo mecanismo desde o Ciclo 5; o Bling nunca teve nenhum dos dois). |
| B3 | **Confirmado** | `estoque-bling/route.ts:81` lê `blingProduct.estoque?.saldoFisicoTotal` da listagem `getAllProducts`/`getProducts`, que só devolve `saldoVirtualTotal`. `undefined || 0` grava 0. |
| B4 | **Confirmado** | `BlingStockItem`/`BlingStockDeposit` (linhas 54–70 de `blingService.ts`) não batem com o formato real (`produto.id`, `saldoFisicoTotal`/`saldoVirtualTotal` no topo, `depositos[].saldoFisico`/`saldoVirtual`). Hoje sem uso (nada chama `getProductsStock`), mas quebraria na primeira tentativa. |
| B5 | **Confirmado** | `updateProductStock` chama `POST /produtos/{id}/estoques`; sem uso atual (nada chama este método), mas o endpoint está errado. |
| B6 | **Confirmado** | `state` é só `${userId}_${timestamp}_${random}` em texto puro; o callback extrai o `userId` do texto e só valida formato de UUID — nenhuma verificação de sessão, cookie ou assinatura. |
| B7 | **Confirmado** | `getProducts` fixa `criterio: "1"`; importação nunca chama `getProductById`; não lê `preco`; sempre grava `isKit: false`; `BigInt(ean)` sem passar por `src/utils/ean.ts` (que já existe); todo o catálogo é buscado e processado numa única execução do handler. |
| B8 | **Confirmado — e meu próprio código, do Ciclo 5** | `extractImageUrl` (que eu escrevi no ciclo anterior com base em um SDK de terceiros) lê `midia.imagens.internas[0].link`. O campo real da API do Bling é `linkMiniatura`, e é uma URL temporária. Prioridade também está errada: deveria preferir `externas` (permanente) sobre `internas` (temporária). |
| B9 | **Confirmado** | Importação usa `normalizeSku(skuBruto)`; `estoque-bling` compara `blingDataMap.get(localProduct.sku)` direto contra `blingProduct.codigo` sem normalizar nenhum dos dois lados. `Produto` não tem `blingId`. |
| B10 | **Confirmado** | `estoque-bling/route.ts:143-146` chama `getProductCost` e grava `custoMedio` incondicionalmente a cada sincronização, sem checar se foi definido manualmente. Todos os depósitos vão para um único armazém "Principal" (linhas 86-106). Nenhuma chamada a `prisma.estoqueMovimentacao.create`. |
| B11 | **Confirmado** | `apiFetch` faz backoff exponencial fixo (`1000 * 2**attempt`) só em 429, nunca lê o header `Retry-After`; não há limite de 20 erros consecutivos nem limite global de chamadas a `/oauth/token`. |
| B12 | **Confirmado** | Não existe `src/app/api/bling/webhook` nem qualquer rota de webhook do Bling. |
| B13 | **Confirmado — e vale também para o Mercado Livre** | `integracoes/page.tsx:196-198` e `:272-274` usam `tone={mlAccount ? "success" : "neutral"}` / `tone={blingAccount ? "success" : "neutral"}` — checam só a existência do registro, nunca `.isActive`. O callback do Bling redireciona para `/produtos`, não `/integracoes`. |

Achado extra, fora da tabela original: `BlingAccount.accessToken`/`refreshToken` já são `String` no Prisma **sem** `@db.VarChar(n)`, o que o Postgres mapeia como `text` por padrão — o item 2 da Fase 1 ("confirmar que são `text`, migrar se `VARCHAR(n)`") já está satisfeito, não precisa de migração de coluna.

#### Usuários e permissões

| # | Status | Observação |
|---|---|---|
| U1 | **Confirmado, exatamente como descrito** | `GET /api/usuarios` faz `prisma.user.findMany({})` sem nenhum `where` — devolve todos os usuários do sistema. O mesmo handler faz `prisma.invitation.findMany({ where: { status: "PENDING" } })` sem filtro por quem convidou, **e devolve o campo `token` na resposta**. `PATCH /api/usuarios/[id]` busca o usuário por `id` cru, sem checar se pertence à "conta" de quem está fazendo a chamada (conceito que nem existe ainda). |
| U2 | **Confirmado** | `User` não tem nenhum campo de conta/tenant; `verifyUser` e todas as rotas escopam só por `userId`. |
| U3 | **Confirmado** | Nenhuma outra rota de `/api` além de `usuarios/*` lê `.role`. O papel vai pro JWT só no login (`src/lib/auth.ts`, callback `jwt`, só dentro do `if (user)`), sem revalidação periódica. |
| U4 | **Confirmado** | `verifyUser.ts:2` importa `"../../lib/prisma"` (o `prisma.ts` da raiz, não `src/lib/prisma.ts`); os dois arquivos são idênticos (`diff` sem saída). A função cria usuário automaticamente se o token tiver `email` mas não existir registro. |

#### Mercado Livre

| # | Status | Observação |
|---|---|---|
| M1 | **Confirmado** | `getMarketplaceFees` (linha ~2110 de `mercadoLivreService.ts`) devolve `saleFee: 0.12`, `paymentFee: 0.049` fixos, com comentário "baseadas na documentação oficial" que não corresponde a nenhuma chamada real à API. |
| M2 | **Confirmado** | `sync/auto-stock/route.ts` soma `produtoML.produto.estoques.reduce(...)` (todos os armazéns, sem campo `tipo` pra filtrar — ele nem existe ainda), nunca lê `shipping.logistic_type`, nenhuma referência a `isKit`/`Componente` no arquivo. As regras são literalmente "if (totalLocalStock > currentMLStock && currentMLStock <= 5)" etc. |
| M3 | **Confirmado** | `getValidToken` só renova depois que `expiresAt` já passou (sem janela de antecedência). `performTokenRefresh` desativa a conta em **qualquer** erro do `catch`, não só `invalid_grant`. A trava (`tokenRefreshPromises`) é um `Map` em memória estático da classe — já evita duplicar chamadas dentro da mesma instância (bom, foi o que corrigi no Ciclo 5), mas não vale entre instâncias serverless diferentes, exatamente como descrito. |
| M4 | **Confirmado** | `webhook/route.ts` devolve 404 quando a conta não é encontrada; nenhuma comparação de `application_id` com `ML_CLIENT_ID` em nenhum ponto do arquivo. |
| M5 | **Confirmado** | `replenishment/batch-analysis/route.ts:148` e `produtos/estoque-full/route.ts:48` chamam `MercadoLivreService.getItem` dentro de um loop `for` por produto, sequencial, sem lote nem cache. Nenhum tratamento de "em trânsito"/"indisponível" do Full — só `available_quantity`. |

#### Reposição

| # | Status | Observação |
|---|---|---|
| R1 | **Confirmado** | Nenhuma referência a `pedidoCompra`/`PedidoProduto` em `batch-analysis/route.ts`. |
| R2 | **Confirmado, pior do que descrito** | A query principal (linha 52-68) já filtra `isKit: false` — kits não são analisados **de forma alguma**, não é só "demanda subestimada": produto-kit nunca aparece na reposição, ponto. Nenhuma referência a `Componente` no arquivo. |
| R3 | **Confirmado** | Demanda vem só de `produto.ProdutoMercadoLivre.reduce((sum, pm) => sum + pm.mlSold90Days)`. Nenhuma referência a `saida`/`Saida`/`detalhesSaida` no arquivo. |
| R4 | **Confirmado** | `avgDeliveryDays: config?.avgDeliveryDays || 7` — vem de `StockReplenishmentConfig`, nunca de `ProdutoFornecedor.prazoEntregaDias`/`quantidadeMinima`/`multiplicador`. |
| R5 | **Confirmado** | `config` é buscado com `findFirst` **dentro** do loop `for (const produto of produtos)` (um `SELECT` por produto, não `findMany` + `Map`). `custoTotal = (quantidadeSugerida * (produto.custoMedio || 0)) / 100` — divide por 100 um valor que em todo o resto do sistema é tratado em centavos, ou seja, aqui o resultado final fica em reais. |
| R6 | **Confirmado, parcialmente mitigado** | `produto.custoMedio || 0` em três pontos trata `null` e `0` igual. Existe uma flag `custoIndefinido = !produto.custoMedio` que zera `custoTotalReposicao` quando o custo falta — então o total "sabe" que está incompleto — mas o valor exposto na resposta ainda é `0`, não `null`, e nada no payload sinaliza "faltou custo" de forma que a tela possa mostrar "—". |

#### Dashboard

| # | Status | Observação |
|---|---|---|
| D1 | **Confirmado** | `dashboard/page.tsx` (340 linhas): `HeroMetric` de receita ML, `StatStrip` com 4 números, 2 `SectionCard` (evolução de receita e top reposição). Nada de estoque Full/a caminho, pedidos atrasados, estoque parado, saúde de integrações. |
| D2 | **Confirmado** | `dashboard/valor-estoque/route.ts:23` usa `custoMedio ?? 0`, devolve só `valorTotal`/`quantidadeTotal`, nenhuma contagem de produtos sem custo nem flag de valor parcial. |
| D3 | **Confirmado** | Nenhuma rota de dashboard calcula margem; `getMarketplaceFees` (M1) é o único lugar que tenta algo parecido com tarifa, e é inventado. |
| D4 | **Confirmado** | Mesma observação de D1. |
| D5 | **Confirmado, com um ajuste de atribuição** | As 4 rotas (`fluxo-financeiro`, `top-produtos`, `entradas`, `estoque-seguranca`) de fato não são chamadas por nenhum componente do frontend (`grep` não encontrou nenhum `fetch` para elas fora do próprio diretório da rota). Os bugs específicos: `top-produtos/route.ts:10,28` tem `startDate` padrão `"2000-01-01"` **e** `take: 3` (os dois no mesmo arquivo); `.toFixed(2)` devolvendo string está em **`fluxo-financeiro/route.ts:101-102`** (`custoSaidas`/`variacaoSaidas`), não em `entradas`; o mesmo arquivo tem o cálculo de período anterior errado — `previousEndDate` é criado como `new Date(startDate)` e nunca mais ajustado, então o período anterior sempre termina exatamente no início do período atual (sobreposição de um dia, já que ambos os filtros são inclusivos). `estoque-seguranca/route.ts:12` compara `quantidade: { lte: prisma.estoque.fields.estoqueSeguranca }` — como `estoqueSeguranca` pode ser nulo e SQL nunca considera `NULL` "menor ou igual" a nada, produtos sem o campo preenchido são silenciosamente excluídos da lista de "abaixo do mínimo". |

#### Sinais de código amador (sem numeração própria no documento, verificados mesmo assim)

Todos confirmados por inspeção direta:
- Rotas duplicadas: `analytics/sales-optimized` × `analytics/sales-complete`, `analytics/restock` × `analytics/restock-fixed`, e na família de produtos ML existem **quatro** variantes (`produtos`, `produtos-simple`, `produtos-inteligente`, `produtos-dinamicos`) — mais do que as três citadas no diagnóstico original.
- Componentes duplicados: `src/app/components/ui/{button,input}.tsx` e `src/components/ui/{button,input}.tsx` coexistem.
- Dois `prisma.ts` (`/lib/prisma.ts` e `/src/lib/prisma.ts`), conteúdo idêntico.
- `postcss.config.js` e `postcss.config.mjs` coexistem.
- `package.json` tem `bcrypt` e `bcryptjs` nas dependências; só `bcryptjs` é importado em código (`grep` não achou nenhum `from "bcrypt"` sem o `js`).
- `ngrok` está em `dependencies` (não `devDependencies`).
- `src/lib/estoque.ts` tem exatamente 1 linha (`FULL_ARMAZEM_NOME`).
- `fornecedores/`: três `page.tsx` (`fornecedores/page.tsx`, `fornecedores/exibirFornecedores/page.tsx`, `fornecedores/fornecedores/page.tsx`).
- `middleware.ts` tem 4 chamadas a `console.log`, todas com emoji (🔍/✅/❌).
- `CLAUDE.md`: linha 77 ainda diz "Next.js 13+ app directory structure" (o resto do arquivo já corrigido para 15); zero menções a "Bling" em todo o arquivo apesar da integração já existir há vários ciclos; seção "Testing" diz "No specific test commands configured", mas `npm test` já existe e funciona (2 arquivos, 5 testes).
- Havia **18** arquivos `.md` soltos na raiz no momento desta auditoria (o diagnóstico original contou 12; a diferença inclui os dois documentos de execução do Ciclo 5 e deste Ciclo 6, criados depois daquela contagem).
- Tokens do Bling e do ML: campos `String` simples no schema, sem `@db.Text` explícito (desnecessário, já é `text` por padrão) e sem nenhuma criptografia de aplicação — gravados em texto puro, confirmado.

### Contagem no banco (Fase 0, item 3)

**Não executada nesta sessão** — sem `DATABASE_URL` disponível. Script pronto em `scripts/auditoria-ciclo-6-contagem.ts`, rodar com `npm run auditoria:ciclo-6` apontando para o banco real. Preencher aqui depois:

```
Produtos totais: —
Produtos sem custo (null ou 0): —
Produtos sem fornecedor: —
Produtos sem anúncio ML ativo: —
Contas Bling (ativas / inativas): —
Contas ML (ativas / inativas): —
Armazéns totais: —
Armazéns com "full" no nome: —
```

Se houver armazém com "full" no nome, as Fases 2 e 5 precisam tratá-lo como `FULL_ML` no novo campo `Armazem.tipo` e excluí-lo da soma de estoque local — senão o estoque Full é contado em dobro (uma vez pelo saldo local desse armazém, outra pela chamada direta à API do ML).

## Fase 1 — Bling: JWT e token à prova de corrida

### O que foi feito

1. `BLING_JWT_HEADER = { "enable-jwt": "1" }` aplicado em `exchangeCodeForTokens`, `refreshAccessToken` e em toda chamada autenticada via `apiFetch`/`rawFetch`. Confirmado por busca: o campo `enable-jwt` e seu uso em todas as requisições (não só `/oauth/token`) batem com a documentação oficial do Bling (verificado via busca na web antes de implementar — há integrações de terceiros com informação conflitante dizendo que o header só vale em `/oauth/token`, mas a doc oficial e o PROMPT-CICLO-6.md pedem explicitamente nos três pontos; segui a instrução explícita).
2. Colunas `accessToken`/`refreshToken` de `BlingAccount` já são `String` sem `@db.VarChar`, que o Postgres mapeia como `text` — confirmado na Fase 0, nenhuma migração necessária.
3. Refresh agora passa por `refreshWithLock`: dentro de `prisma.$transaction`, `SELECT pg_advisory_xact_lock(hashtext(accountId))`, relê a conta, só renova se ainda estiver na janela de 10 minutos e se o `refreshToken` não tiver sido trocado por outra instância nesse meio tempo, grava o novo token na mesma transação. Por cima, `coalescedRefresh` mantém o `Map<accountId, Promise>` em memória (mesmo padrão já usado no `MercadoLivreService` desde o Ciclo 5) para não duplicar chamadas dentro da mesma instância.
4. Conta só é desativada (`isActive: false`) quando `refreshAccessToken` detecta `invalid_grant`. Qualquer outro erro (rede, 5xx, 429) vira `BlingTransientError` — novo tipo de erro — e a conta continua ativa.
5. `apiFetch` agora recebe `accountId` em vez de `accessToken`: resolve o token internamente via `getValidToken`, e em 401 força uma renovação (`forceRefreshToken`, que ignora a janela de 10 minutos) e tenta de novo uma vez; se continuar 401, lança `BlingReconnectError`. Isso obrigou a trocar a assinatura de `getProducts`, `getProductById`, `getAllProducts`, `getProductsStock` e `updateProductStock` de `accessToken` para `accountId` — só dois call sites externos (`estoque-bling/route.ts` e `produtos/importar/route.ts`), ambos atualizados.
6. `api/cron/bling-refresh`: antes renovava **todas** as contas ativas a cada execução; agora filtra só as que expiram nas próximas 12 h (`expiresAt <= now + 12h`) e espaça as chamadas a ~6,5 s cada (≤ 10/minuto), usando a mesma função com trava.
7. `GET /api/bling/auth?action=accounts` devolve `tokenFormato: "jwt" | "opaco"` por conta (via `BlingService.detectTokenFormat`, que checa os três segmentos separados por ponto) — o token em si nunca sai do backend.
8. OAuth com `state` assinado: novo módulo `src/lib/blingOAuthState.ts` gera um `state` aleatório (`crypto.randomBytes`), grava num cookie `httpOnly`/`secure`/`sameSite=lax` de 10 minutos junto com o `userId` e uma assinatura HMAC-SHA256 (chave `NEXTAUTH_SECRET`). O callback exige sessão válida (`verifyUser`), confere a assinatura e compara tanto o `state` quanto o `userId` do cookie contra o que veio da sessão/Bling (`crypto.timingSafeEqual` na comparação da assinatura). Callback passou a redirecionar para `/integracoes?bling=conectado` ou `/integracoes?bling_erro=<motivo>` (antes ia para `/produtos` sem nenhum parâmetro lido por ninguém no frontend — confirmado por `grep`, nenhuma tela lia `bling_connected`/`bling_error`, então essa troca não quebra nada hoje; a leitura desses parâmetros na tela de Integrações fica para a Fase 3, que já vai reconstruir o card com status real).
9. Ao conectar, `BlingService.getCompanyId` chama `GET /empresas` e grava `blingCompanyId` na conta. Implementado como best-effort (`try/catch` retorna `null` em qualquer falha) porque não consegui confirmar com 100% de certeza o formato exato da resposta desse endpoint específico sem acesso à conta real — se falhar, a conexão Bling continua funcionando normalmente e `blingCompanyId` fica `null` até a próxima tentativa (a Fase 3, que depende desse campo para os webhooks, vai precisar confirmar isso com uma conta real antes de prosseguir).
   **`@@unique([userId])` em `BlingAccount` NÃO foi adicionado.** O item pede para remover duplicatas antes — não há `DATABASE_URL` neste ambiente para verificar se existem contas duplicadas por usuário. Adicionar essa constraint sem checar primeiro poderia falhar a migração em produção se houver duplicatas reais. Fica pendente: rodar `SELECT "userId", COUNT(*) FROM bling_accounts GROUP BY "userId" HAVING COUNT(*) > 1` contra o banco real, resolver duplicatas se houver, e só então adicionar a constraint numa migração separada.
10. Testes em `src/services/__tests__/blingService.test.ts` (6 testes): header presente nos três pontos (3 testes), duas chamadas concorrentes de `getValidToken` geram uma única chamada a `/oauth/token` (testa a coalescência em memória — a trava `pg_advisory_xact_lock` em si não é testável sem um Postgres real, já que depende de concorrência entre conexões de banco de verdade), `invalid_grant` desativa a conta, erro 503 não desativa.

### Migração

`prisma/migrations/20261003150000_bling_company_id/migration.sql` — aditiva, só adiciona a coluna `blingCompanyId` (nullable) em `bling_accounts`.

### Checks ao final da fase

- `npx tsc --noEmit`: limpo.
- `npx next lint`: limpo.
- `npm test`: 3 arquivos, 11 testes, todos passando (5 anteriores + 6 novos).
- `npm run build`: não executado nesta fase (disco local ficou crítico durante a sessão; build completo fica para os pontos de maior risco ou para quando o ambiente tiver mais espaço livre).

### Pendências desta fase para quem tiver acesso a produção/banco real

- Verificar duplicatas de `BlingAccount` por `userId` e então adicionar `@@unique([userId])`.
- Confirmar o formato real da resposta de `GET /empresas` com uma conta Bling de verdade (hoje é best-effort).
- Reconectar o Bling em produção (novo fluxo de `state` assinado) e confirmar que a tela mostra o fluxo completo funcionando ponta a ponta — não dá para testar OAuth de verdade sem o client secret real e um navegador.
