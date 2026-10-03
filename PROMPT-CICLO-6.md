# Leap Stock — Ciclo 6: Integrações confiáveis, cadastro completo e dashboard profissional

Documento autocontido de execução para o Claude Code. Revisão feita em 03/10/2026 lendo o código do repositório e a documentação atual da API v3 do Bling. Execute as fases **na ordem**, uma por vez. Ao final de cada fase: `npx tsc --noEmit`, `npx next lint`, `npm test` e commit descritivo em português.

**Regras inegociáveis**
1. As Fases 1 a 4 corrigem coisas que hoje **corrompem dados ou expõem dados de outros clientes**. Faça cada uma, valide e só então siga.
2. Antes de apagar arquivo, rota ou coluna, rode `grep -rn` pelo nome e confirme que nada usa. Se algo deste documento não bater com o código (arquivo mudou, lógica já corrigida), **verifique, registre em `docs/AUDITORIA-CICLO-6.md` e adapte** — não force a mudança.
3. Toda migração Prisma deve ser aditiva primeiro (coluna nova, backfill, depois remover a antiga em migração separada). Nada de `migrate reset`.
4. Nenhuma tela pode exibir número inventado. Se faltar dado (custo, preço, frete), mostrar "—" com o motivo, nunca 0.

## Diretrizes de código (iguais aos ciclos anteriores)
1. Sem comentários em código; nomes explicam a intenção. Remova comentários e `console.log` dos arquivos que editar (mantenha só `console.error` de exceção).
2. TypeScript estrito, sem `any` novo, retornos explícitos em rotas e serviços.
3. Cor apenas por token semântico (`styles/global.css`, `PROMPT-IDENTIDADE-LEAP.md`). Proibido `bg-white`, `bg-gray-*`, hex hardcoded e emoji em texto de interface.
4. Prisma sempre pelo singleton `@/lib/prisma`. Toda rota: autenticação, validação Zod, escopo pela conta, permissão por papel, erro tipado `{ error, code? }`.
5. Telas novas usam os componentes já existentes: `PageHeader`, `HeroMetric`, `StatStrip`, `SectionCard`, `StatusPill`, `DeltaIndicator`, `KpiCard`, `PartialDataAlert`, `ProductImage`, `DataTable`, `Skeleton`. Responsivo em 375px, tema claro e escuro.

---

## Diagnóstico verificado nesta revisão

### Bling (o ponto mais crítico)
| # | Problema | Onde | Efeito |
|---|---|---|---|
| B1 | **Nenhuma requisição envia o header `enable-jwt: 1`.** O Bling está descontinuando o token opaco; o header é obrigatório na troca do código, no refresh e em toda chamada autenticada. Prazo divulgado por integradores: **15/10/2026** (a página oficial diz "data em definição, migre o quanto antes"). | `src/services/blingService.ts` (`exchangeCodeForTokens`, `refreshAccessToken`, `apiFetch`) | Integração para de funcionar no corte |
| B2 | **Refresh sem trava entre instâncias.** O Bling invalida o refresh token a cada renovação. Duas requisições simultâneas (ou o cron das 06h junto com um usuário) usam o mesmo refresh token; a segunda recebe `invalid_grant` e o código marca a conta como `isActive: false`. | `getValidToken`, `refreshAccountTokens`, `api/cron/bling-refresh` | Conta "expira sozinha" — principal causa das falhas recorrentes |
| B3 | **Sincronização de estoque zera o estoque.** `produtos/estoque-bling` lê `estoque.saldoFisicoTotal` da **listagem** `/produtos`, que só devolve `saldoVirtualTotal`. Resultado: `undefined → 0` gravado para todos os produtos. | `src/app/api/produtos/estoque-bling/route.ts` | Estoque local errado, reposição errada |
| B4 | Interface de saldo errada: `/estoques/saldos` exige `idsProdutos[]` e devolve `{ produto: { id }, saldoFisicoTotal, saldoVirtualTotal, depositos: [{ id, saldoFisico, saldoVirtual }] }`. O tipo `BlingStockItem` espera `id/codigo/nome/depositos[].saldo`. | `blingService.ts` | Qualquer uso futuro quebra |
| B5 | Escrita de estoque em endpoint inexistente: `POST /produtos/{id}/estoques`. O correto é `POST /estoques` com `{ produto: { id }, deposito: { id }, operacao: "B", quantidade, observacoes }`. | `updateProductStock` | Falha silenciosa |
| B6 | **OAuth sem validação de `state`.** O callback extrai o `userId` do texto do `state` e grava a conta Bling nesse usuário sem conferir sessão. Qualquer pessoa pode montar um `state` com o UUID de outro cliente. | `api/bling/auth/route.ts`, `api/bling/auth/callback/route.ts` | Falha de segurança |
| B7 | Importação usa `criterio=1` (só "últimos incluídos"), não lê detalhe do produto (GTIN, marca, dimensões, peso, composição de kit, fornecedor), não importa **preço de venda**, sempre grava `isKit: false`, faz `BigInt(gtin)` sem validar (quebra com GTIN não numérico) e roda o catálogo inteiro numa única requisição serverless. | `api/bling/produtos/importar/route.ts` | Cadastro incompleto, timeouts |
| B8 | Imagem: lê `midia.imagens.internas[0].link`, mas o campo é `linkMiniatura` e as imagens internas têm **validade** (URL temporária). | `extractImageUrl` | Imagens somem depois de alguns dias |
| B9 | Match por SKU inconsistente: importação normaliza (`normalizeSku`), a sincronização de estoque compara `codigo` cru. Não existe `blingId` no `Produto`. | `estoque-bling`, schema | "Não encontrado" falso, duplicidade |
| B10 | Sincronização de estoque sobrescreve `custoMedio` com o custo do Bling a cada execução (inclusive custo digitado à mão) e joga todos os depósitos num único armazém "Principal". Não grava `EstoqueMovimentacao`. | `estoque-bling` | Custo instável, sem trilha de auditoria |
| B11 | Rate limit: só um `sleep(350ms)` entre páginas; o 429 não respeita `Retry-After`; não há limite global por conta. O Bling bloqueia o IP com 300 erros em 10 s, 600 requisições em 10 s ou **20 chamadas a `/oauth/token` em 60 s**. | `apiFetch` | Risco de bloqueio do IP da Vercel |
| B12 | Sem webhooks do Bling (produto, estoque, fornecedor do produto). Tudo depende de clique manual. | — | Dados defasados |
| B13 | Tela Integrações mostra "Conectado" sempre que existe conta, mesmo com `isActive: false`. Callback redireciona para `/produtos` em vez de `/integracoes`. | `(root)/integracoes/page.tsx`, callback | Usuário não percebe que caiu |

### Usuários e permissões
| # | Problema | Onde |
|---|---|---|
| U1 | **`GET /api/usuarios` lista todos os usuários e convites pendentes (com token) do sistema inteiro**, sem filtro por conta. `PATCH /api/usuarios/[id]` altera o papel de **qualquer** usuário do sistema. Como todo cadastro novo nasce `ADMIN`, qualquer cliente vê e altera usuários de outros clientes. | `api/usuarios/route.ts`, `api/usuarios/[id]/route.ts` |
| U2 | Não existe conceito de conta/empresa. Todos os dados são filtrados por `user.id`; um usuário convidado entra num app vazio, sem os produtos de quem o convidou. | `verifyUser`, todas as rotas |
| U3 | Papéis (`COMPRAS`, `ESTOQUE`, `VENDAS`, `LEITURA`) só são checados na tela de usuários; o resto das rotas não verifica papel. O papel vai para o JWT só no login — rebaixar alguém não tem efeito até ele sair e entrar. | `src/lib/auth.ts`, rotas |
| U4 | `verifyUser` cria usuário automaticamente a partir do token e importa o Prisma por caminho relativo (`../../lib/prisma`) — existem dois arquivos `prisma.ts` (`/lib` e `/src/lib`). | `src/helpers/verifyUser.ts` |

### Mercado Livre
| # | Problema | Onde |
|---|---|---|
| M1 | **Taxas inventadas:** `getMarketplaceFees` devolve 12% + 4,9% fixos. Não existe tarifa real nem custo de frete por anúncio no banco. | `mercadoLivreService.ts` |
| M2 | **Risco de venda sem estoque:** `sync/auto-stock` empurra para o ML a **soma de todos os armazéns**, sem checar se o anúncio é Full (`logistic_type = fulfillment`, que o ML não aceita alterar) e sem calcular kit pelo componente limitante. Regras ad hoc ("se ML ≤ 5 então…"). | `api/mercadolivre/sync/auto-stock/route.ts`, `syncStock` |
| M3 | Refresh do token do ML: trava só em memória (não vale entre instâncias serverless), renova só depois de expirado e **qualquer erro** (inclusive rede/5xx) desativa a conta. | `getValidToken`, `performTokenRefresh` |
| M4 | Webhook responde **404** quando a conta não é encontrada e não confere `application_id` com `ML_CLIENT_ID`. O ML conta 4xx como falha e pode desativar as notificações. | `api/mercadolivre/webhook/route.ts` |
| M5 | Estoque Full lido item a item (`getItem` sequencial) dentro de `replenishment/batch-analysis` e `produtos/estoque-full`; não considera unidades em trânsito/indisponíveis no Full. | rotas citadas |

### Reposição (o coração do produto)
| # | Problema |
|---|---|
| R1 | **Pedidos de compra em aberto não são descontados** da sugestão — o sistema manda comprar de novo o que já está a caminho. |
| R2 | **Vendas de kits não geram demanda dos componentes** (análise ignora `isKit` e `Componente`). Componente de kit é subestimado. |
| R3 | Demanda vem só de `mlSold90Days`; vendas por outros canais (saídas manuais) são ignoradas. Produto sem anúncio nunca recebe sugestão. |
| R4 | Ignora o fornecedor: `prazoEntregaDias`, `quantidadeMinima` e `multiplicador` de `ProdutoFornecedor` não entram no cálculo (usa padrão de 7 dias). |
| R5 | N+1: uma consulta de config e N chamadas ao ML por produto, sequenciais. `custoTotal` em reais enquanto o resto do sistema usa centavos. |
| R6 | Produto sem custo some do valor (custo 0) sem aviso. `custoMedio Int? @default(0)` mistura "zero" com "sem custo". |

### Dashboard
| # | Problema |
|---|---|
| D1 | Painel fino: receita bruta do ML, 4 números e top 5 de reposição. Sem conta ML, mostra quase nada. |
| D2 | "Valor do estoque" soma custo 0 para produto sem custo, sem avisar que está subestimado. |
| D3 | Receita "incluindo frete", sem tarifas, frete pago e custo — não existe margem em lugar nenhum. |
| D4 | Não mostra onde está o estoque (local × Full × a caminho), pedidos de compra atrasados, estoque parado, nem a saúde das integrações. |
| D5 | Rotas `dashboard/fluxo-financeiro`, `top-produtos`, `entradas`, `estoque-seguranca` não são usadas pelo painel e têm bugs (período anterior calculado errado, `toFixed` devolvendo string, `take: 3` desde o ano 2000, comparação com `estoqueSeguranca` nulo). |

### Sinais de código amador a remover
Rotas duplicadas (`analytics/restock` × `restock-fixed`, `sales-optimized` × `sales-complete`, `produtos-simple` × `produtos-inteligente` × `produtos-dinamicos`), componentes duplicados (`src/app/components/ui/button.tsx|input.tsx` × `src/components/ui/*`), dois `prisma.ts`, `postcss.config.js` + `.mjs`, `bcrypt` + `bcryptjs`, `ngrok` como dependência de produção, `src/lib/estoque.ts` com 1 linha, páginas duplicadas em `fornecedores/`, middleware com `console.log` e emoji em toda requisição, 12 arquivos `.md` soltos na raiz, `CLAUDE.md` desatualizado (diz Next 13, sem testes, sem Bling). Tokens do ML e do Bling gravados em texto puro.

---

## FASE 0 — Linha de base (sem alterar comportamento)

1. Rodar `npx tsc --noEmit`, `npx next lint`, `npm test` e registrar o resultado em `docs/AUDITORIA-CICLO-6.md`.
2. Para cada item da tabela de diagnóstico, confirmar no código e marcar **confirmado / já corrigido / diferente**. Esse arquivo é a referência do ciclo.
3. Contar no banco (script somente leitura em `scripts/`): produtos, produtos sem custo (`custoMedio` nulo ou 0), sem fornecedor, sem preço, contas Bling e ML e seu `isActive`, armazéns existentes (verificar se existe armazém que representa o Full — se existir, o estoque Full está sendo contado duas vezes na reposição e no auto-stock).

---

## FASE 1 — Bling: JWT e token à prova de corrida (URGENTE — prazo do Bling)

1. Constante única `BLING_JWT_HEADER = { "enable-jwt": "1" }` aplicada em **três pontos**: `POST /oauth/token` com `authorization_code`, `POST /oauth/token` com `refresh_token` (sem ele o próximo refresh devolve token opaco e a migração se desfaz) e **toda** chamada em `apiFetch`.
2. Confirmar que `accessToken`/`refreshToken` são `text` no Postgres (JWT tem 1.500 a 3.000 caracteres). Se houver `VARCHAR(n)`, migrar.
3. **Refresh com trava distribuída**: dentro de `prisma.$transaction`, `SELECT pg_advisory_xact_lock(hashtext(<accountId>))`, reler a conta, renovar **só se ainda estiver dentro da janela** (outra instância pode já ter renovado), gravar o novo refresh token na mesma transação. Manter um `Map<accountId, Promise>` em memória por cima para coalescer chamadas da mesma instância.
4. Desativar a conta **somente** em `invalid_grant`. Rede, 5xx e 429 sobem erro tipado e a conta continua ativa.
5. Em 401 numa chamada de API: uma renovação forçada (passando pela trava) e uma nova tentativa; se falhar de novo, `BlingReconnectError`.
6. Cron `api/cron/bling-refresh`: renovar apenas contas que expiram nas próximas 12 h, usando a mesma função com trava, e espaçar as chamadas (máximo 10 por minuto em `/oauth/token`).
7. Detectar formato do token (JWT = três segmentos separados por ponto) e expor em `GET /api/bling/auth?action=accounts` como `tokenFormato: "jwt" | "opaco"` — nunca o token em si.
8. **OAuth com `state` assinado**: gerar `state` aleatório, gravar em cookie `httpOnly`, `secure`, `sameSite=lax`, 10 min, junto com o `userId` assinado (HMAC com `NEXTAUTH_SECRET`). No callback, exigir sessão válida, comparar o `state` do cookie e usar o `userId` **da sessão**. Redirecionar para `/integracoes?bling=conectado` ou `/integracoes?bling_erro=<motivo>`.
9. Ao conectar, buscar os dados da empresa no Bling (entidade `empresas` da API v3) e gravar `blingCompanyId` na `BlingAccount` (necessário para os webhooks da Fase 3). Adicionar `@@unique([userId])` em `BlingAccount` após remover duplicatas.
10. Testes Vitest: o header aparece nos três pontos; duas renovações simultâneas resultam em **uma** chamada a `/oauth/token`; `invalid_grant` desativa, 503 não desativa.

**Aceite:** após reconectar o Bling uma vez em produção, a tela Integrações mostra "Token: JWT"; 20 requisições simultâneas a rotas do Bling não derrubam a conta; o cron roda sem desativar ninguém.

---

## FASE 2 — Bling: endpoints corretos e cadastro completo

### 2.1 Cliente HTTP
1. Limitador por conta: **3 req/s** (token bucket no Upstash, que já está instalado; fallback em memória). Fila com concorrência 1 por conta.
2. 429: respeitar `Retry-After`; sem ele, backoff exponencial com jitter, até 4 tentativas. Interromper o lote após 20 erros seguidos (evita o bloqueio de 300 erros/10 s).
3. Erros tipados: `BlingReconnectError`, `BlingRateLimitError`, `BlingApiError { status, endpoint, mensagem }`. Mensagens em português na interface.

### 2.2 Modelo de dados (migração aditiva)
- `Produto`: `blingId String?` (IDs do Bling passam de Int32), `precoVenda Int?` (centavos), `precoOrigem` (enum `BLING | MANUAL | ML`), `custoOrigem` (enum `MANUAL | PEDIDO_COMPRA | BLING_FORNECEDOR | BLING_PRODUTO | PLANILHA`), `custoAtualizadoEm DateTime?`. `@@unique([userId, blingId])`.
- `custoMedio`: passa a ser `Int?` **sem default**; backfill `0 → null` (zero não é custo válido). Ajustar todas as leituras para tratar `null` como "sem custo".
- `Armazem`: `blingDepositoId String?`, `tipo` (enum `LOCAL | FULL_ML | OUTRO`). Se a Fase 0 encontrou armazém representando o Full, marcar `FULL_ML`.
- `Fornecedor`: `blingContatoId String?`, `@@unique([userId, blingContatoId])`.
- `BlingAccount`: `blingCompanyId String?`, `ultimaSincronizacaoProdutos DateTime?`, `ultimaSincronizacaoEstoque DateTime?`.
- `EstoqueMovimentacao.origem`: adicionar `SINCRONIZACAO_BLING`.

### 2.3 Produtos
1. Listagem com `criterio=5` (todos) paginada em 100, mapeando `situacao` para `ativo`. Ignorar serviços.
2. Sincronização incremental com `dataAlteracaoInicial` = última sincronização (formato `YYYY-MM-DD HH:mm:ss`); completa só na primeira vez ou por botão.
3. Para produtos novos ou alterados, buscar `GET /produtos/{id}` e gravar: `gtin` (validar com `src/utils/ean.ts` antes do `BigInt`), `marca`, `pesoBruto`, `dimensoes`, `preco → precoVenda`, `formato`. Composição (`formato = "E"`): `isKit = true` e criar `Componente` a partir de `estrutura.componentes` (resolver componente pelo `blingId`).
4. Match na ordem: `blingId` → SKU normalizado (`normalizeSku`) → EAN. Conflito (dois candidatos) vai para o resumo como pendência, nunca cria duplicado.
5. Imagem: preferir `midia.imagens.externas[0].link`; se só houver interna (`linkMiniatura`, temporária), baixar e subir para o Vercel Blob (já usado no avatar) e gravar a URL do Blob. Passar por `normalizeImageUrl`.
6. Executar em lotes: a rota inicia o job, grava `BlingSyncHistory` com `status: processing` e devolve o id; o processamento continua com `after()` em blocos que caibam no `maxDuration` da rota; a tela consulta o progresso. Nada de catálogo inteiro numa requisição.

### 2.4 Fornecedores e custo (resolve "produto sem fornecedor / sem custo")
1. `GET /produtos/fornecedores?idProduto={id}` → `fornecedor.id`, `codigo`, `precoCusto`, `precoCompra`, `padrao`.
2. Para cada `fornecedor.id` novo, `GET /contatos/{id}` e fazer upsert de `Fornecedor` por `blingContatoId` (nome, CNPJ, contato).
3. Upsert de `ProdutoFornecedor` com `principal = padrao`, `preco = precoCompra`, `codigoNoFornecedor = codigo`.
4. Regra única de custo em `src/lib/custo.ts` (substitui `helpers/productCostHelper.ts`), por prioridade: custo `MANUAL` ou `PLANILHA` definido pelo usuário (nunca sobrescrito pela sincronização) → média ponderada dos últimos pedidos de compra concluídos no app (considerando `multiplicador`) → `precoCusto` do fornecedor padrão no Bling → `precoCusto` do produto no Bling → `null`. Gravar `custoOrigem` e `custoAtualizadoEm`. Kit: custo = soma dos componentes; se algum componente não tem custo, o kit fica sem custo.

### 2.5 Estoque
1. `GET /depositos` → tela em Configurações para mapear cada depósito do Bling a um `Armazem` (criar armazém automaticamente na primeira vez, com o nome do depósito).
2. Saldos: `GET /estoques/saldos?idsProdutos[]=…` em lotes de 50 ids, mapeando por `produto.id` e `depositos[].saldoFisico` para o armazém correspondente. Corrigir as interfaces `BlingStockItem`/`BlingStockDeposit`.
3. Reescrever `api/produtos/estoque-bling`: usar os saldos por depósito, **não tocar em custo**, registrar `EstoqueMovimentacao` (`SINCRONIZACAO_BLING`) só quando a quantidade mudar, devolver o resumo com diferenças.
4. Escrita para o Bling: `POST /estoques` com `{ produto: { id }, deposito: { id }, operacao: "B", quantidade, observacoes: "Ajuste Leap Stock" }`. Só executar quando a opção "Enviar ajustes de estoque para o Bling" estiver ligada em Configurações (padrão **desligado**; o Bling é a fonte da verdade do estoque físico). Remover `updateProductStock` antigo.

**Aceite:** importação de um catálogo real traz preço, custo, fornecedor principal, GTIN, imagem e kits; a sincronização de estoque nunca grava 0 por falta de campo; uma segunda execução sem mudanças no Bling não altera nada e não gera movimentação.

---

## FASE 3 — Bling: webhooks e sincronização contínua

1. `POST /api/bling/webhook` (público, liberado no middleware e em `verifyUser`):
   - ler o corpo cru; calcular HMAC-SHA256 com `BLING_CLIENT_SECRET`; comparar com `X-Bling-Signature-256` (`sha256=<hex>`) via `crypto.timingSafeEqual`; inválido → 401.
   - localizar a conta por `companyId`; conta desconhecida → **200** (registrar e ignorar).
   - gravar evento em `BlingWebhookEvent` (`eventId` único, `event`, `companyId`, `payload Json`, `processado`, `erro`, `recebidoEm`); evento repetido → 200 sem reprocessar.
   - responder 200 imediatamente (o Bling exige resposta em até **5 s**; após 3 dias de falhas desativa o webhook) e processar com `after()`.
   - eventos: `product.created|updated|deleted`, `stock.*`, `virtual_stock.*`, `product_supplier.*`. Cada um reaproveita as funções da Fase 2 para um único produto.
2. Cron `api/cron/bling-sync` (protegido por `CRON_SECRET`): reprocessa eventos com erro e faz sincronização incremental de segurança. Se o plano da Vercel for Hobby (cron só diário), documentar no `.env.example` e manter o botão "Sincronizar agora".
3. Tela Integrações (card Bling): status real (`Conectado`, `Reconexão necessária`, `Desconectado`) usando `isActive`; formato do token; expira em; última sincronização de produtos e de estoque; eventos de webhook recebidos nas últimas 24 h e quantos falharam; botões "Sincronizar produtos", "Sincronizar estoque", "Reconectar".

**Aceite:** alterar o preço de um produto no Bling atualiza o Leap Stock em menos de 1 minuto; webhook com assinatura inválida recebe 401; o mesmo evento enviado duas vezes é processado uma vez.

---

## FASE 4 — Usuários, conta e permissões consistentes

1. **Correção imediata de vazamento** (pode ir num commit isolado antes do resto): `GET/POST /api/usuarios` e `PATCH /api/usuarios/[id]` passam a operar só dentro da conta do usuário logado. Nunca devolver `token` de convite na listagem (só o link gerado no momento da criação).
2. **Conta (tenant)**: adicionar `User.contaId String?` apontando para o usuário principal (dono). Dono: `contaId = null` (a conta é o próprio `id`). Convite aceito grava `contaId = invitedById` (ou o `contaId` de quem convidou). Backfill: todos os usuários atuais são donos.
3. `verifyUser` passa a devolver `{ usuario, contaId, papel }`, onde `contaId = usuario.contaId ?? usuario.id`. **Todas** as consultas de dados de negócio (produtos, armazéns, fornecedores, pedidos, saídas, contas Bling/ML, configs, notificações de negócio) filtram por `contaId`. Ações continuam registrando quem fez (`usuario.id`). Remover a criação automática de usuário dentro de `verifyUser` e importar o Prisma de `@/lib/prisma`.
4. Matriz de permissões em `src/lib/permissoes.ts` com função `exigirPermissao(papel, acao)` usada em toda rota de escrita e nos dados financeiros:

| Ação | ADMIN | COMPRAS | ESTOQUE | VENDAS | LEITURA |
|---|---|---|---|---|---|
| Ver custo, margem, valor de estoque, pendências de custo/preço/frete | sim | sim | não | não | não |
| Editar produto, custo, fornecedor, preço | sim | sim | não | não | não |
| Pedidos de compra | sim | sim | ver | não | ver |
| Ajustar estoque, transferências, saídas | sim | não | sim | não | não |
| Vendas e anúncios ML | sim | ver | ver | sim | ver |
| Integrações, usuários, assinatura | sim | não | não | não | não |

   As rotas devolvem 403 com `code: "SEM_PERMISSAO"`; a interface esconde ações e valores que o papel não pode ver (mostrando "—" em vez de omitir a coluna, para manter o layout).
5. Papel sempre atual: no callback `jwt`, reler `role` e `contaId` do banco a cada 5 minutos (`token.roleCheckedAt`) para que rebaixamentos valham sem novo login.
6. Proteções: não é possível remover/rebaixar o dono nem o último ADMIN da conta; convites expiram em 7 dias; convite aceito com e-mail diferente do convidado é recusado.
7. Teste: usuário da conta A não consegue ler nem alterar nada da conta B em nenhuma rota de `/api/usuarios`, `/api/produtos`, `/api/estoque`, `/api/bling/*`.

**Aceite:** um usuário COMPRAS convidado vê os mesmos produtos do dono e consegue lançar pedido de compra; um usuário VENDAS não vê custo nem margem em nenhuma tela; nenhum ADMIN vê usuários de outra conta.

---

## FASE 5 — Mercado Livre: preço, frete e tarifa reais; estoque sem risco

1. Novos campos em `ProdutoMercadoLivre`: `mlTarifaVenda Int?` (centavos por unidade), `mlCustoFrete Int?` (centavos que o vendedor paga por envio), `mlLogisticType String?`, `mlInventoryId String?`, `mlCustosAtualizadosEm DateTime?`.
2. Na sincronização de anúncios, para cada item ativo (respeitando a fila/concorrência do `mlFetch`):
   - tarifa: `GET /sites/MLB/listing_prices?price={preco}&listing_type_id={tipo}&category_id={categoria}` → `sale_fee_amount`;
   - frete pago pelo vendedor em anúncio com frete grátis/Mercado Envios: `GET /users/{seller_id}/shipping_options/free?item_id={id}` → `coverage.all_country.list_cost`; sem frete grátis → `0` explícito.
   - Conferir os nomes dos campos na documentação de custos de envio do ML antes de implementar; se a chamada falhar, deixar `null` (vira pendência), nunca estimar.
3. Nas vendas, usar `order_items[].sale_fee` e o custo de envio real do pedido para a receita líquida. **Remover `getMarketplaceFees` e todo percentual fixo.**
4. `src/lib/margem.ts` com `calcularMargemUnitaria({ precoVenda, tarifa, frete, custo, aliquotaImposto })` → `{ margemValor, margemPercentual, completo, faltando: string[] }`. Alíquota de imposto (Simples etc.) configurável em Configurações Gerais (padrão 0, com aviso). Testes cobrindo dado faltante.
5. Estoque enviado ao ML (`sync/auto-stock`, `syncStock`):
   - nunca enviar para anúncio `fulfillment`;
   - quantidade = soma apenas dos armazéns `LOCAL` (excluir `FULL_ML`);
   - anúncio de kit = `min(estoque do componente ÷ quantidade no kit)`;
   - anúncio com variações: atualizar a variação correta;
   - substituir as regras ad hoc por: enviar quando a diferença for ≠ 0 e o último envio tiver mais de 10 minutos, com opção "pausar envio automático".
6. Estoque Full: usar `mlInventoryId` e o endpoint de estoque de fulfillment do ML (disponível + em trânsito/indisponível), gravando num snapshot por produto em vez de chamar `getItem` produto a produto em cada tela.
7. Token do ML: mesma trava distribuída da Fase 1, renovar com 10 minutos de antecedência, desativar só quando o ML responder `invalid_grant`.
8. Webhook do ML: conferir `application_id === ML_CLIENT_ID`, sempre responder 200 (conta desconhecida inclusive), deduplicar por `_id` da notificação.

---

## FASE 6 — Pendências de cadastro (fonte única)

1. `src/lib/pendencias.ts` exporta `calcularPendencias(produto)` devolvendo uma lista de `{ codigo, severidade, mensagem, acao }`:

| Código | Regra | Severidade |
|---|---|---|
| `SEM_CUSTO` | `custoMedio` nulo (kit: algum componente sem custo) | crítica |
| `SEM_FORNECEDOR` | nenhum `ProdutoFornecedor` | crítica |
| `SEM_FORNECEDOR_PRINCIPAL` | tem fornecedores mas nenhum `principal` | atenção |
| `SEM_PRECO` | sem `precoVenda` e sem anúncio ML ativo com preço | crítica |
| `SEM_FRETE` | anúncio ML ativo com frete pelo vendedor e `mlCustoFrete` nulo ou com mais de 7 dias | atenção |
| `SEM_TARIFA` | anúncio ML ativo com `mlTarifaVenda` nula | atenção |
| `SEM_PRAZO_FORNECEDOR` | fornecedor principal sem `prazoEntregaDias` (a reposição usa o padrão) | atenção |
| `MARGEM_NEGATIVA` | margem completa < 0 | crítica |
| `ESTOQUE_DIVERGENTE` | saldo do Bling ≠ saldo local no armazém mapeado | atenção |
| `SEM_EAN` | sem GTIN válido | informativa |
| `SEM_VINCULO_ML` | produto ativo sem anúncio vinculado | informativa |

2. `GET /api/produtos/pendencias` → contagem por código, valor de estoque afetado e lista paginada; cache curto (60 s) invalidado nas escritas de produto, custo, fornecedor e sincronizações.
3. Produtos: coluna "Pendências" com `StatusPill` (crítica = destructive, atenção = warning, informativa = muted) e tooltip com as mensagens; filtro por código lido da URL (`/produtos?pendencia=SEM_CUSTO`), para os cards do dashboard levarem direto à lista; ligar as ações em lote já existentes (`BulkAssignDialog`, importação de custos por planilha) ao filtro.
4. Ficha do produto (`produtos/[id]`): bloco "Cadastro" listando as pendências com o botão da ação correspondente; bloco "Margem por canal" com preço, tarifa, frete, custo, imposto e margem (cada linha mostra "—" e o motivo quando faltar).
5. Reposição: produto sem custo ou sem fornecedor **continua aparecendo** com a quantidade sugerida e o selo da pendência; o valor da compra fica "—" e o total exibe "N itens sem custo não somados".
6. Notificação diária (novo tipo `CADASTRO_INCOMPLETO` no enum) para usuários com permissão de ver custo, só quando o número de pendências críticas aumentar.

---

## FASE 7 — Reposição correta (evitar furo e compra em dobro)

Reescrever `api/replenishment/batch-analysis` como serviço testável em `src/services/reposicaoService.ts`:

1. **Demanda diária**: vendas ML do período (pedidos pagos, não `mlSold90Days`) + saídas manuais; venda de kit explode em demanda dos componentes (`Componente.quantidade`). Média ponderada (últimos 30 dias com peso maior que 31–90) e desvio para o estoque de segurança.
2. **Estoque disponível** = armazéns `LOCAL` + Full disponível + Full em trânsito + **pedidos de compra em aberto** (quantidade × multiplicador ainda não recebida).
3. **Lead time** = `prazoEntregaDias` do fornecedor principal (fallback: config do produto, depois padrão global de Configurações) + `fullReleaseDays` quando o produto vende pelo Full.
4. Ponto de pedido = demanda × lead time + estoque de segurança; quantidade sugerida = cobertura alvo − disponível, **arredondada para cima na `quantidadeMinima` e no múltiplo de caixa** do fornecedor.
5. Separar sugestão de **compra** (fornecedor → local) de sugestão de **envio ao Full** (local → Full), já que são decisões diferentes.
6. Uma consulta para configs (`findMany` + `Map`), snapshot do Full da Fase 5, nada de chamada ao ML por produto. Valores sempre em centavos.
7. Ação "Gerar pedido de compra" agrupando as sugestões por fornecedor principal (rascunho em `PedidoCompra`).
8. Testes: kit vendido gera demanda no componente; pedido em aberto reduz a sugestão; arredondamento por caixa; produto sem custo aparece com valor nulo.

---

## FASE 8 — Dashboard profissional

Criar `GET /api/dashboard/resumo?periodo=7|30|90` que agrega tudo no servidor com `Promise.allSettled` (cada bloco tem `parcial: boolean` e `erro?`), devolve `geradoEm` e usa cache de 2 minutos por conta. Os campos financeiros só vão na resposta para papéis com permissão (Fase 4). Remover as chamadas client-side ao ML no `dashboard/page.tsx` e as rotas `dashboard/*` antigas que ficarem sem uso.

Layout (de cima para baixo, componentes existentes, mesma largura `max-w-[1400px]`):

1. **Cabeçalho** — `PageHeader` "Visão Geral", seletor de período, "Atualizado às HH:mm" e botão atualizar.
2. **Métricas principais** — `HeroMetric` de **Faturamento líquido** do período (vendas − tarifas − frete pago pelo vendedor) com `DeltaIndicator` vs período anterior, e `StatStrip` com: Margem de contribuição (R$ e %), Unidades vendidas, Ticket médio, Valor em estoque a custo. Quando houver produto sem custo, o valor do estoque e a margem trazem a observação "N produtos sem custo não entram neste valor" com link.
3. **Pendências que afetam seus números** (só para quem vê custo; é o bloco que o usuário principal precisa ver) — grade de cards: Sem custo, Sem fornecedor, Sem preço de venda, Sem custo de frete, Sem tarifa, Margem negativa, Estoque divergente do Bling. Cada card: contagem, impacto em uma frase ("R$ X em estoque sem custo", "N anúncios sem frete calculado"), botão que abre `/produtos?pendencia=…`. Sem pendências: estado vazio "Cadastro completo".
4. **Onde está o estoque** — barras empilhadas por produto top 10 e totais: Local (por armazém), Full disponível, Full em trânsito, A caminho (pedidos de compra). Unidades e valor.
5. **Risco de ruptura** — tabela top 10 por dias de cobertura < lead time: produto (`ProductImage`), estoque disponível, vendas/dia, dias restantes, quantidade sugerida, valor da compra, fornecedor. Contadores "Já sem estoque", "Rompe antes do próximo pedido chegar". Link para `/reposicao`.
6. **Capital parado** — produtos sem venda há 60+ dias e cobertura acima de 120 dias, com valor parado.
7. **Vendas** — série diária (receita líquida e unidades), top 10 produtos por margem (não só por volume), curva ABC (quantos SKUs fazem 80% do faturamento).
8. **Compras** — pedidos em aberto, atrasados (`dataPrevista` < hoje) e valor a receber.
9. **Saúde das integrações** — Bling (status, formato do token, expira em, última sincronização, webhooks 24 h) e Mercado Livre (status, última sincronização, anúncios pausados com estoque, anúncios com erro de sync). Qualquer problema vira `StatusPill` de alerta com ação "Reconectar"/"Sincronizar".

Regras: sem conta ML o painel funciona com dados locais e Bling (o card do ML vira chamada para conectar); todo número tem tooltip com a fórmula; skeleton por bloco; `PartialDataAlert` quando um bloco vier parcial; gráficos com `src/lib/chart-colors.ts`; 375px sem rolagem horizontal; tema escuro conferido.

**Aceite:** os números do dashboard batem com Produtos, Reposição e Análise de Vendas para o mesmo período (conferir 5 produtos à mão e registrar no `docs/AUDITORIA-CICLO-6.md`); um usuário VENDAS vê o painel sem nenhum valor de custo ou margem.

---

## FASE 9 — Profissionalização do código

1. Remover rotas e componentes duplicados listados no diagnóstico, um de cada vez, depois de `grep` confirmar que não há uso. Unificar em `src/lib/prisma.ts` e `src/components/ui/*`.
2. Dependências: manter só `bcryptjs`; mover `ngrok` para `devDependencies` (ou remover); um único `postcss.config`.
3. Integridade do schema: `Componente` com `@@unique([kitId, produtoId])` e `onDelete: Cascade`; `Estoque`, `DetalhesSaida`, `PedidoProduto`, `ProdutoFornecedor` com `onDelete` coerente; índices em todas as FKs de `userId`/`contaId`.
4. Tokens do ML e do Bling criptografados em repouso (AES-256-GCM, chave `TOKEN_ENCRYPTION_KEY`), com leitura que aceita texto puro durante a transição e script de migração.
5. Middleware sem `console.log`; liberar explicitamente `/api/bling/webhook`, `/api/mercadolivre/webhook`, `/api/mercadopago/webhook` e `/api/cron/*` (protegido por `CRON_SECRET`).
6. Mover os `.md` antigos da raiz para `docs/historico/`; reescrever `CLAUDE.md` (Next 15, Vitest, Bling v3 com JWT, conta/papéis, fonte da verdade de cada dado); atualizar `env.example` (`TOKEN_ENCRYPTION_KEY`, observação de webhook do Bling).
7. Testes Vitest mínimos: assinatura do webhook Bling, trava de refresh, mapeamento de saldos por depósito, `calcularMargemUnitaria`, `calcularPendencias`, `reposicaoService`, isolamento entre contas.

---

## FASE 10 — Verificação final

1. `npx tsc --noEmit`, `npx next lint`, `npm test` e `npm run build` limpos.
2. Deslogado: nenhuma rota `/api/*` (exceto auth, webhooks e cron com segredo) responde 200.
3. Fluxo Bling ponta a ponta na conta real: reconectar → token JWT → importar produtos (preço, custo, fornecedor, imagem, kits) → mapear depósitos → sincronizar estoque → alterar algo no Bling e ver o webhook chegar.
4. Fluxo ML: anúncios com tarifa e frete preenchidos; auto-stock não tenta alterar anúncio Full.
5. Percorrer todas as telas com papel ADMIN e VENDAS, registrando qualquer 4xx/5xx e corrigindo.
6. Atualizar `docs/AUDITORIA-CICLO-6.md` com o que foi feito, o que ficou pendente e por quê.

---

## Passos manuais do Lucas (fora do código)

1. No painel de desenvolvedor do Bling, no aplicativo: incluir os escopos de **Produtos, Produtos – Fornecedores, Estoques, Depósitos, Contatos e Dados da empresa**; depois do deploy, **reconectar o Bling** na tela Integrações (escopo novo exige nova autorização e é isso que gera o primeiro token JWT).
2. No mesmo aplicativo, cadastrar o webhook `https://<seu-domínio>/api/bling/webhook` para os recursos Produto, Estoque e Produto–Fornecedor.
3. Na Vercel: definir `TOKEN_ENCRYPTION_KEY` (32 bytes em base64) e conferir `CRON_SECRET`, `BLING_CLIENT_SECRET` e o plano (Hobby só permite cron diário).
4. Fazer backup do banco antes das migrações das Fases 2 e 4.
