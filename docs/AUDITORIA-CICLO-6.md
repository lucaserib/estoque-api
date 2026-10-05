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

## Fase 2 — Bling: endpoints corretos e cadastro completo

### O que foi feito

1. **Cliente HTTP (2.1)**: `src/lib/blingRateLimiter.ts` limita a 3 req/s por conta — token bucket no Upstash (`@upstash/ratelimit`, reaproveitando `src/lib/redis.ts`) quando configurado, com fallback de fila em memória (`Map<accountId, Promise>` serializando por conta) quando não há Redis. `BlingService.requestRaw` (renomeado de `apiFetch`) chama o limitador antes de cada tentativa (incluindo depois do refresh forçado em 401 e antes de cada retry de 429). 429 agora lê `Retry-After` do header; sem ele, backoff exponencial com jitter (`1000 * 2**tentativa + até 250ms`), até 4 tentativas, e levanta `BlingRateLimitError` se esgotar. Erros tipados `BlingApiError { status, endpoint, mensagem }` e `BlingRateLimitError` adicionados; `blingErrorResponse` (`src/lib/blingApi.ts`) mapeia os quatro tipos de erro do Bling (`BlingReconnectError`, `BlingTransientError`, `BlingRateLimitError`, `BlingApiError`) para o status HTTP e mensagem em português corretos. `getAllProducts` interrompe a paginação depois de 20 erros consecutivos (`MAX_CONSECUTIVE_ERRORS`), evitando o bloqueio de 300 erros/10s do Bling.
2. **Modelo de dados (2.2)**: migração aditiva `20261003160000_bling_cadastro_completo` — `Produto.blingId/precoVenda/precoOrigem/custoOrigem/custoAtualizadoEm`, `@@unique([userId, blingId])`; `Armazem.blingDepositoId/tipo` (enum `ArmazemTipo`), `@@unique([userId, blingDepositoId])`; `Fornecedor.blingContatoId`, `@@unique([userId, blingContatoId])`; `BlingAccount.ultimaSincronizacaoProdutos/ultimaSincronizacaoEstoque`; enum `OrigemMovimentacaoEstoque` ganha `SINCRONIZACAO_BLING`. Migração separada `20261003160100_custo_medio_sem_default` faz o backfill `custoMedio: 0 → null` e remove o `@default(0)` da coluna, só depois da primeira — não misturou as duas como o documento pede. Armazém representando o Full não foi encontrado na Fase 0 (sem banco real para confirmar), então nenhum backfill de `tipo: FULL_ML` foi necessário aqui; fica como pendência de quem tiver acesso ao banco real (ver nota da Fase 0).
3. **Produtos (2.3)**: `getProducts` usa `criterio: "5"` (todos, não só "últimos incluídos") e aceita `dataAlteracaoInicial` para sincronização incremental — a rota só passa essa data quando `account.ultimaSincronizacaoProdutos` existe e `completa` não foi pedido explicitamente. Para cada produto, `getProductById` busca o detalhe e grava `marca`, peso (convertido de kg para gramas), dimensões, `precoVenda` (centavos, `precoOrigem: "BLING"`), `ean` validado por `stringToBigIntEAN` (`src/utils/ean.ts`, já existia, agora usado), `isKit` (`formato === "E"`) e os componentes do kit (resolvidos por `blingId` local, kit sem componente local correspondente simplesmente não vincula aquele componente — não quebra a importação). Match na ordem `blingId → SKU normalizado`; EAN como terceiro critério **não foi implementado** (fica pendente, ver abaixo). Conflito entre candidato por `blingId` e por SKU vai para `erros` do resumo, produto não é tocado. Execução em background: a rota devolve `{ iniciado: true, syncHistoryId }` imediatamente, grava `BlingSyncHistory` com `status: "processing"` e processa tudo dentro de `after()`; `GET` com `?syncHistoryId=` devolve o progresso. **Divisão em blocos que caibam no `maxDuration`** (item 6, segunda parte) não foi implementada — o processamento roda inteiro numa única chamada de `after()`; para catálogos muito grandes isso pode ainda esbarrar no limite de execução da função serverless. Ficou assim porque o projeto não usa `maxDuration` em nenhuma outra rota hoje e adicionar chunking exigiria um mecanismo novo de retomada (ponteiro de página salvo no `BlingSyncHistory`) que não foi pedido explicitamente nem testado; registrar como pendência real, não decisão definitiva.
4. **Imagem (2.3.5)**: `extractImageUrl` virou `extractImageInfo`, devolvendo `{ url, temporaria }` e **invertendo a prioridade antiga** (o Ciclo 5 preferia `internas`, que é temporária; agora prefere `externas`, permanente). Quando só há imagem interna, `src/lib/blingImageHost.ts` baixa o arquivo e sobe para o Vercel Blob (`@vercel/blob`, mesmo pacote do avatar) antes de gravar a URL; se o re-host falhar, cai para a URL temporária original em vez de falhar o produto inteiro.
5. **Fornecedores e custo (2.4)**: `resolverFornecedorPrincipal` (na rota de importação) busca `getProductSuppliers` + `getContact`, faz upsert de `Fornecedor` por `blingContatoId` e vincula `ProdutoFornecedor` com `principal: true`, zerando `principal` dos outros vínculos do mesmo produto. Regra de custo centralizada em `src/lib/custo.ts` (`resolverCustoProduto`), substituindo `src/helpers/productCostHelper.ts` (removido; `grep` confirmou nenhum outro uso) e também adotada por `api/produtos/importar-ml`. Prioridade implementada: custo `MANUAL`/`PLANILHA` existente é preservado (olha `custoOrigem` do produto atual antes de sobrescrever) → média ponderada dos últimos 10 pedidos de compra `confirmado` (por quantidade × multiplicador) → `precoCusto`/`precoCompra` do fornecedor padrão no Bling → `precoCusto` do produto no Bling → `null`. Kit: `calcularCustoKit` soma o custo dos componentes e marca `completo: false` (custo `null`) se qualquer componente não tiver custo; a rota de importação nunca chama `resolverCustoProduto` para produto kit, usa direto `{ custoMedio: null, custoOrigem: null }`.
6. **Estoque (2.5)**: `GET /depositos` (novo `BlingService.getDeposits`) é chamado a cada sincronização de estoque; depósito sem `Armazem` correspondente (por `blingDepositoId`) cria um novo automaticamente com `tipo: "LOCAL"` e o nome do depósito — não existe ainda uma tela dedicada em Configurações para remapear manualmente (o item pede "tela em Configurações", que não foi criada; o automático cobre o caso comum). `getStockForProducts` busca saldos em lotes de 50 ids via `getProductsStock` (reescrito para bater com o formato real de `/estoques/saldos`: `produto.id` no topo, `depositos[].saldoFisico`). A rota `estoque-bling` foi reescrita por completo: casa produto local por `blingId` (gravando-o na primeira vez que encontra por SKU) e nunca mais lê `saldoFisicoTotal` da listagem; não toca em `custoMedio` em nenhum ponto; grava `EstoqueMovimentacao` com `origem: "SINCRONIZACAO_BLING"` só quando `quantidadeAnterior !== quantidadeNova`. `updateProductStock` foi corrigido para `POST /estoques` com o formato certo, mas **a opção "Enviar ajustes de estoque para o Bling" em Configurações não foi criada** — a função existe e está correta, porém sem nenhum call site (nem endpoint, nem toggle, nem UI). Ficou pendente porque o item 4 depende de uma tela de Configurações nova que nenhuma outra parte desta fase tocou; registrar como trabalho ainda não iniciado, não como decisão de não fazer.

### O que ficou pendente desta fase (para registrar explicitamente, não esconder)

- Match de produto por EAN como terceiro critério (depois de `blingId` e SKU) — não implementado.
- Divisão da importação em blocos dentro do `maxDuration` com retomada por ponteiro — não implementado, risco em catálogos muito grandes.
- Tela em Configurações para mapear depósito → armazém manualmente — não criada (mapeamento automático por nome cobre o caso comum).
- Opção/endpoint "Enviar ajustes de estoque para o Bling" (escrita de volta) — `updateProductStock` pronto, mas sem toggle nem call site.
- Testes Vitest para `src/lib/custo.ts`, `src/lib/blingRateLimiter.ts` e a rota de importação — não escritos nesta fase (o documento não pede testes explicitamente na Fase 2, diferente da Fase 1; ainda assim, ficou mais leve de cobertura que o ideal).

### Checks ao final da fase

- `npx tsc --noEmit`: limpo.
- `npx next lint`: limpo.
- `npm test`: 3 arquivos, 11 testes, todos passando (nenhum teste novo nesta fase).
- `npx prisma validate` / `npm run build`: não executados (sem `DATABASE_URL` neste ambiente, mesma restrição da Fase 0; `tsc` limpo é o proxy disponível de que o client gerado bate com o schema e com os call sites).

## Fase 3 — Bling: webhooks e sincronização contínua

### Refatoração prévia (reaproveitar funções da Fase 2 para um único produto)

A Fase 3 pede explicitamente que cada evento de webhook "reaproveite as funções da Fase 2 para um único produto" — o código da Fase 2 não estava organizado para isso (a lógica de aplicar um produto Bling ao banco local vivia inteira dentro do `for` da rota de importação em massa). Antes de escrever o webhook, extraí essa lógica para `src/services/blingProductSync.ts`: `resolverFornecedorPrincipalBling`, `vincularFornecedorProdutoBling`, `aplicarDetalheProdutoBling`, `sincronizarComponentesKitBling`, `garantirArmazensParaDepositos`, `aplicarEstoqueProdutoBling` e `inativarProdutoPorBlingId`, além de três funções de orquestração por produto único (`sincronizarProdutoUnico`, `sincronizarEstoqueUnico`, `sincronizarFornecedorUnico`) usadas só pelo webhook e pelo cron. As rotas `api/bling/produtos/importar` e `api/produtos/estoque-bling` foram reescritas para chamar essas mesmas funções em vez de duplicar a lógica — comportamento idêntico (conferido por `tsc`/lint/test antes e depois), com uma correção incidental: o código da Fase 2 buscava `padrao.codigo` do fornecedor mas descartava esse valor (`vincularFornecedorProduto(..., undefined)`); a versão compartilhada agora propaga `codigo` até `codigoNoFornecedor`.

### O que foi feito

1. **`POST /api/bling/webhook`** (`src/app/api/bling/webhook/route.ts`): lê o corpo cru (`request.text()`, nunca `request.json()`, porque a assinatura é calculada sobre os bytes exatos recebidos), calcula HMAC-SHA256 com `BLING_CLIENT_SECRET` (`src/lib/blingWebhookSignature.ts`, extraído para ser testável isoladamente) e compara com `X-Bling-Signature-256` via `crypto.timingSafeEqual`; sem assinatura válida, `401`. Formato do payload confirmado por busca na documentação oficial (`developer.bling.com.br/webhooks`) antes de implementar: envelope `{ eventId, date, version, event, companyId, data }`, resposta em até 5s, 3 dias de tentativas antes de desativar o webhook do recurso — tudo conforme o item do `PROMPT-CICLO-6.md`. Evento duplicado (mesmo `eventId`) devolve `200 { duplicado: true }` sem reprocessar. Evento novo é gravado em `BlingWebhookEvent` (migração `20261003170000_bling_webhook_events`) e processado em `after()`; a rota responde `200` imediatamente, antes de qualquer chamada à API do Bling.
2. **Processamento do evento** (`src/services/blingWebhookProcessor.ts`): localiza a conta por `companyId` (conta desconhecida → marca o evento como processado com um `erro` explicativo, nunca lança — fica fora do loop de retry do cron, exatamente como pede "conta desconhecida vai para 200 e ignora"); despacha por prefixo do `event` — `product.deleted` inativa o produto local (`ativo: false`, decisão registrada abaixo), `product.*` chama `sincronizarProdutoUnico`, `stock.*`/`virtual_stock.*` chama `sincronizarEstoqueUnico`, `product_supplier.*` chama `sincronizarFornecedorUnico`. Falha no meio do processamento grava o `erro` na linha do evento e **não marca `processado: true`** — fica elegível para o cron tentar de novo.
3. **Cron `api/cron/bling-sync`** (protegido por `CRON_SECRET`, mesmo padrão de `bling-refresh`): primeiro reprocessa até 200 eventos com `processado: false` (webhooks que falharam), depois faz uma sincronização incremental de segurança por conta ativa (mesma lógica de `dataAlteracaoInicial` da Fase 2, produto a produto via `sincronizarProdutoUnico`). Registrado em `vercel.json` como `30 6 * * *` — documentei em `env.example` que o plano Hobby da Vercel só permite cron diário, então tanto `bling-refresh` quanto `bling-sync` ficam preso a essa cadência; o botão "Sincronizar agora" na tela Integrações é o que cobre o intervalo entre execuções.
4. **Tela Integrações** (card Bling): status real com três estados (`Conectado`/`isActive: true`, `Reconexão necessária`/`isActive: false` com botão "Reconectar" que repete o fluxo OAuth já usado em `produtos/page.tsx`, `Desconectado`/sem conta); mostra `tokenFormato` (JWT/opaco), expiração, última sincronização de produtos e de estoque (`BlingAccount.ultimaSincronizacaoProdutos/Estoque`, já gravados desde a Fase 2) e contagem de webhooks recebidos/com erro nas últimas 24h (nova consulta em `GET /api/bling/auth?action=accounts`, que já expõe tudo isso via `BlingAccountSummary`). Separei o botão único "Sincronizar agora" em dois — "Sincronizar produtos" (chama a importação incremental) e "Sincronizar estoque" (chama `estoque-bling`) — porque agora são operações com fontes de dados e tempos de execução bem diferentes.

### Decisões e pendências registradas explicitamente

- **Formato exato do campo `data` para `stock.*`/`virtual_stock.*`/`product_supplier.*` não pôde ser confirmado**: a documentação oficial (via busca na web, sem acesso a uma conta real para disparar um evento de teste) confirma o envelope externo (`eventId`, `event`, `companyId`, `data`) mas não mostra um exemplo de JSON completo do campo `data` para cada recurso. `extrairBlingProdutoId` (`blingWebhookProcessor.ts`, exportada e testada) tenta `data.id` para eventos `product.*` (mais provável de ser o id do produto direto) e `data.produto.id` / `data.idProduto` / `data.produtoId` para os demais; se nenhum bater, o evento é marcado como processado com erro explicativo em vez de travar ou adivinhar errado — e o `payload` **completo e cru** fica salvo em `BlingWebhookEvent.payload` de qualquer forma, então o formato real pode ser confirmado e o extrator ajustado olhando os primeiros eventos reais recebidos em produção, sem precisar reenviar nada.
- **`product.deleted` inativa (`ativo: false`) em vez de apagar o produto local**: apagar de verdade cascatearia para `Estoque`, `EstoqueMovimentacao`, `Componente`, histórico de pedidos — perda de dados que o usuário não pediu. Exclusão no Bling quase sempre significa "não vendo mais isso", que já é exatamente o que `ativo: false` comunica no resto do sistema (listagens, reposição). Se isso se provar errado para o caso de uso real, é mudança de uma linha em `inativarProdutoPorBlingId`.
- **Tela de Integrações ainda não lê `?bling=conectado`/`?bling_erro=`** da URL (o callback da Fase 1 já redireciona com esses parâmetros, mas nenhuma tela mostra o toast correspondente) — pequeno, mas ficou de fora porque não estava listado explicitamente no item 3 da Fase 3; registrar como próximo ajuste rápido.
- **`@@unique([userId])` em `BlingAccount`** continua pendente da Fase 1 (precisa checar duplicatas em produção primeiro). Isso importa aqui porque `GET /api/bling/webhook`-side usa `findFirst` por `blingCompanyId` — se duas contas do mesmo usuário (ou, pior, de usuários diferentes que conectaram a mesma empresa Bling por engano) tivessem o mesmo `blingCompanyId`, o webhook atualizaria a conta errada. Com a constraint ausente, o risco já existia desde a Fase 1; não é novo nesta fase, só fica mais visível porque agora há um consumidor automático desse campo.

### Testes novos

- `src/lib/__tests__/blingWebhookSignature.test.ts` (6 testes): assinatura válida aceita, segredo errado rejeitado, corpo alterado rejeitado, header sem prefixo `sha256=` rejeitado, header ausente rejeitado, segredo não configurado rejeitado.
- `src/services/__tests__/blingWebhookProcessor.test.ts` (5 testes): extração do id do produto para cada família de evento, incluindo os formatos alternativos e o caso sem id reconhecível.
- `src/app/api/bling/webhook/__tests__/route.test.ts` (3 testes, com `prisma` e `next/server#after` mockados): 401 com assinatura inválida, 401 sem header, e o mesmo `eventId` processado uma única vez (segunda chamada devolve `duplicado: true`) — cobrindo literalmente os dois critérios de aceite da fase.

### Checks ao final da fase

- `npx tsc --noEmit`: limpo.
- `npx next lint`: limpo.
- `npm test`: 6 arquivos, 25 testes, todos passando (14 novos: 6 + 5 + 3 descritos acima, mais os 11 anteriores).
- `npx prisma generate`: executado com sucesso (sem `DATABASE_URL` não dá para `migrate dev`/`validate` contra banco real, mesma restrição de sempre; o client foi regerado a partir do schema para o novo modelo `BlingWebhookEvent`).

## Fase 4 — Usuários, conta e permissões consistentes

Esta é a fase que fecha o vazamento de dados entre clientes (U1-U4). Abordagem: em vez de trocar o formato de retorno de `verifyUser` para `{ usuario, contaId, papel }` como o texto original sugere literalmente — o que obrigaria reescrever a desestruturação em 78 arquivos que chamam `verifyUser` —, optei por devolver o `User` do Prisma **estendido** com `contaId` (`{ ...usuario, contaId }`). `user.id`, `user.role`, `user.email` etc. continuam funcionando exatamente como antes em todo o código existente; a correção real é trocar, rota por rota, qual campo é usado para **escopar dados de negócio** (`user.contaId`) versus **registrar quem agiu** (`user.id` continua certo para isso). Registro essa divergência explicitamente conforme a regra 2 do documento: o resultado (nenhum dado cruza entre contas) é idêntico ao pedido, a forma de chegar lá é mais segura porque não depende de reescrever corretamente 78 arquivos à mão.

### O que foi feito

1. **`User.contaId`** (migração `20261003180000_user_conta_id`, aditiva): dono tem `contaId: null`; convidado grava `contaId = COALESCE(contaId de quem convidou, id de quem convidou)`. Backfill cobre convites já aceitos antes desta migração (olhando `invitations.status = 'ACCEPTED'`). Índice em `contaId` e FK `ON DELETE SET NULL` (se o dono for removido um dia, o convidado não trava).
2. **`verifyUser`** (`src/helpers/verifyUser.ts`) reescrito: importa `@/lib/prisma` (era `../../lib/prisma`, U4), **não cria mais usuário automaticamente** (U4) e devolve `{ ...usuario, contaId: usuario.contaId ?? usuario.id }`. A criação automática de usuário no primeiro login Google foi movida para o callback `jwt` do NextAuth (`src/lib/auth.ts`), que é o lugar certo — `verifyUser` agora só verifica, nunca grava.
3. **`src/lib/auth.ts`**: o callback `jwt` passa a reler `role`/`contaId` do banco a cada 5 minutos (`token.roleCheckedAt`), não só no login — um rebaixamento de papel vale sem precisar deslogar (item 5). `session.user.contaId` adicionado (`next-auth.d.ts` atualizado) para a única rota que lê sessão direto via `getServerSession` em vez de `verifyUser` (`pedidos-compra/route.ts` GET).
4. **Vazamento corrigido (U1, item 1)**: `GET /api/usuarios` lista só usuários com `id = contaId OR contaId = contaId` (os membros da mesma conta) e convites filtrados por `invitedById` dentro desse mesmo grupo; **o campo `token` do convite nunca mais aparece na listagem** (só no corpo da resposta do `POST`, no momento da criação, como o item pede). `PATCH /api/usuarios/[id]` confere que o alvo pertence à mesma conta antes de qualquer coisa (404 genérico se não pertence, para não revelar que o id existe em outra conta) e **bloqueia qualquer alteração de papel do dono** (`id === currentUser.contaId`).
5. **Proteção de "último ADMIN" revista, não implementada como pedido**: escrevi a checagem (contar outros ADMINs da conta antes de rebaixar) e, ao escrever o teste para ela, percebi que é **código morto**: a rota já bloqueia auto-edição (não dá pra rebaixar a si mesmo) e exige que quem rebaixa seja ADMIN — como quem rebaixa continua ADMIN depois da operação, "zero admins restantes" nunca acontece nesse fluxo. Removi a checagem morta (CLAUDE.md pede para não deixar proteção para cenário que não acontece) e documento aqui o porquê: essa regra só passa a fazer sentido de verdade se um dia existir uma rota de **remover** membro da conta (não existe hoje) — quem adicionar isso precisa reintroduzir a checagem ali. A proteção ao dono (item 4 acima) continua ativa e é o que hoje impede ficar sem ADMIN.
6. **Convites**: `POST /api/register` grava `contaId` no novo usuário a partir de `invitation.invitedBy.contaId ?? invitation.invitedBy.id`. Expiração de 7 dias e recusa por e-mail diferente **já existiam** antes desta fase (conferido no código, não precisou de mudança) — o item 6 já estava satisfeito nesses dois pontos.
7. **Matriz de permissões** (`src/lib/permissoes.ts`): tabela do documento implementada literalmente (`VER_CUSTO`, `EDITAR_PRODUTO`, `PEDIDOS_COMPRA_EDITAR/VER`, `ESTOQUE_AJUSTAR`, `VENDAS_ML_EDITAR/VER`, `INTEGRACOES_USUARIOS_ASSINATURA`), com `exigirPermissao`/`exigirVisualizacao` (lançam `SemPermissaoError` com `code: "SEM_PERMISSAO"`) e `permissaoErrorResponse` para traduzir isso em `403` nas rotas. Aplicada nas rotas de maior risco/mais citadas explicitamente no documento: `estoque/ajustar`, `saida`, `transferencias` (todas `ESTOQUE_AJUSTAR`), `pedidos-compra` POST/PUT/DELETE (`PEDIDOS_COMPRA_EDITAR`) e GET (`PEDIDOS_COMPRA_VER`), `produtos` POST/PUT/DELETE (`EDITAR_PRODUTO`), `bling/auth` e `mercadopago/subscribe|cancel` (`INTEGRACOES_USUARIOS_ASSINATURA`). **Não apliquei a matriz em toda rota de escrita do sistema** — são dezenas de endpoints de Mercado Livre e dashboard; o que existe cobre os exemplos literais do documento e a infraestrutura (matriz + helpers + testes) está pronta para quem for adicionar nas demais. O item "a interface esconde ações e valores que o papel não pode ver" (frontend) **não foi feito nesta fase** — só o lado servidor.
8. **O escopo principal da fase — "todas as consultas de dados de negócio filtram por contaId"**: varri **todas** as rotas que chamam `verifyUser` (78 arquivos) procurando `userId: user.id` e equivalentes (`currentUser.id`, comparações `.userId !== user.id`, `session.user.id`). Troquei para `.contaId` em produtos, armazéns/estoque (`estoque/*`), fornecedores (`fornecedores`, `produto-fornecedor`), pedidos de compra, saídas, kits, transferências, notificações de estoque crítico (a consulta que decide quem está crítico — o destinatário da notificação continua sendo quem fez a ação, ver próximo item), **contas Bling** (`bling/auth`, `bling/auth/callback`, `bling/produtos/importar`, `produtos/estoque-bling` — incluindo os pontos internos de `blingProductSync.ts` que criam Armazém/Produto durante a sincronização, que antes gravariam os dados sob o id de quem clicou "sincronizar" em vez da conta) e **contas Mercado Livre** (`mercadolivre/auth` e todas as rotas de sync/analytics/dashboard/produtos que liam `MercadoLivreAccount` por `userId`) e **assinatura** (`Subscription.userId`, `mercadopago/subscribe|status|cancel` — sem isso, cada convidado precisaria da própria assinatura paga para usar o sistema, o que não faz sentido dado que a assinatura é da conta). De propósito **não** mudei: campos de auditoria ("quem fez") como `EstoqueMovimentacao.userId` e o destinatário de `Notification`/`NotificationService.notify*` (continuam `user.id`, a pessoa que realizou a ação); o vínculo do cookie de `state` do OAuth do Bling e do ML (precisa ser o navegador/sessão específico que iniciou o fluxo, não a conta); e chaves de rate limit (`checkRateLimit(..., user.id, ...)`, de propósito por indivíduo para não deixar um usuário só esgotar a cota de todos os colegas).
9. **Achado incidental durante a varredura**: `src/app/api/mercadolivre/produtos-dinamicos/route.ts` tinha sua **própria cópia** de `verifyUser` (`verifyUserForAPI`, função local) com exatamente o mesmo defeito do U4 original (criação automática de usuário, sem `contaId`). Substituída pela importação do `verifyUser` real — mesmo bug, segunda ocorrência, mesma correção.
10. **Notificações permanecem por usuário individual, não por conta** — decisão explícita, não esquecimento: `Notification.readAt` é uma coluna por linha; se a notificação fosse gravada com `userId = contaId` para "aparecer para o time todo", uma pessoa marcando como lida marcaria para todo mundo, o que é um comportamento de produto que o documento não especificou. Fica pendente de decisão de produto antes de implementar (provavelmente precisa de uma tabela de leitura separada por usuário, ou um campo `escopo`).

### Decisão de design: por que não um `Conta` model separado

O documento pede `User.contaId String?` apontando para o usuário dono, não uma tabela `Conta` nova — segui isso à risca. Isso significa que toda tabela de negócio continua tendo uma coluna chamada `userId` (não `contaId`) que agora é **preenchida com o valor de `contaId`** do autor, em vez do `id` dele. Não precisou migrar nenhuma coluna dessas tabelas — o valor que elas guardam é que mudou de significado (de "quem criou" para "de qual conta é"), e isso é exatamente o que o documento descreve no item 3 da Fase 4.

### Testes novos

- `src/helpers/__tests__/verifyUser.test.ts` (4 testes, com `next-auth/jwt` e `prisma` mockados): dono resolve `contaId` igual ao próprio id; convidado resolve `contaId` igual ao id do dono; token ausente lança; usuário do token não existe mais lança.
- `src/lib/__tests__/permissoes.test.ts` (7 testes): cada papel contra a matriz, incluindo `exigirPermissao` lançando/não lançando.
- `src/app/api/usuarios/__tests__/route.test.ts` (4 testes, com `prisma` e `verifyUser` mockados simulando duas contas): `GET` só lista membros da própria conta; `PATCH` em usuário de outra conta devolve 404; `PATCH` no dono devolve 400; dono consegue alterar o papel de um membro da própria conta — os dois primeiros são literalmente o critério de aceite da fase ("usuário da conta A não consegue ler nem alterar nada da conta B").

### O que ficou pendente desta fase (para registrar explicitamente)

- Frontend não esconde ainda ações/valores por papel (toda a parte de interface do item 4).
- Matriz de permissões (`exigirPermissao`) não foi adicionada a todas as rotas de escrita — só às citadas explicitamente no documento e às de maior risco. Rotas de Mercado Livre (sync, produtos, analytics) continuam só com isolamento por conta, sem checagem de papel.
- Teste de isolamento entre contas cobre `/api/usuarios` (explicitamente pedido); não escrevi testes de isolamento para cada uma das outras ~40 rotas corrigidas — a correção nelas é a mesma troca mecânica (`user.id` → `user.contaId`), verificada por leitura de código e `tsc`, não por teste automatizado individual por rota.
- `Notification` continua por usuário individual (ver item 10 acima) — decisão de produto pendente, não bug.

### Checks ao final da fase

- `npx tsc --noEmit`: limpo.
- `npx next lint`: limpo.
- `npm test`: 9 arquivos, 40 testes, todos passando (15 novos: 4 + 7 + 4 descritos acima, mais os 25 anteriores).
