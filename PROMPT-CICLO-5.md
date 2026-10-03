# Leap Stock — Ciclo 5: Corrigir integrações e deixar pronto para produção

Documento autocontido de execução. Diagnóstico verificado em produção em 20/09/2026 na conta real (leapstoreoficial@gmail.com · conta ML LEAPSTORE ativa · 35 produtos · 55 anúncios). Execute as fases **na ordem**, uma por vez. Ao final de cada fase: `npx tsc --noEmit`, `npx next lint` e commit descritivo em português.

**Regra inegociável:** as Fases 1 e 2 consertam coisas quebradas em produção. Faça cada uma e valide antes de seguir. Não altere contratos de API, cálculos ou lógica de sincronização nas fases de acabamento — se um ajuste exigir mudar dados, pare e reporte.

## Diretrizes de código
1. Sem comentários em código; nomes explicam a intenção. Remova comentários dos arquivos que editar.
2. TypeScript estrito, sem `any` novos, retornos explícitos em rotas e serviços.
3. Cor apenas por token semântico. Proibido `bg-white`, `bg-gray-*`, hex hardcoded e emoji em texto de interface.
4. Prisma sempre pelo singleton `@/lib/prisma`. Toda rota: `verifyUser`, validação de entrada, verificação de posse pelo `userId`, erro tipado `{ error, code? }`.
5. Nenhuma tela pode exibir dado inventado ou placeholder — tudo vem do banco ou da API.

---

## Estado verificado (rotas testadas na conta real)

| Rota | Status |
|---|---|
| `mercadolivre/analytics/sales-complete` | **503 ML_DADOS_PARCIAIS** |
| `produtos/vendas-ml` | **503 ML_DADOS_PARCIAIS** |
| `saida/vendas-ml` | **503 ML_DADOS_PARCIAIS** |
| `mercadolivre/sync` (GET) | **500 Erro ao carregar dados de sincronização** |
| `produtos/pendentes` | 400 "ID da conta ML não fornecido" |
| `perfil` | **404 (rota não existe)** |
| `mercadolivre/dashboard/metrics`, `orders`, `produtos`, `restock`, `bling/auth`, `notificacoes`, `usuarios`, `integracoes/historico` | 200 |

---

## FASE 1 — Imagens dos produtos (causa raiz encontrada)

### Diagnóstico
As URLs estão gravadas no banco com protocolo **HTTP**, não HTTPS. Amostra real vinda de `GET /api/produtos`:

```
"imagemUrl": "http://http2.mlstatic.com/D_873469-MLB93570247071_092025-I.jpg"
```

O `next.config.mjs` declara `remotePatterns` apenas com `protocol: "https"`. O componente `next/image` recusa a URL e não renderiza nada. Três pontos se somam:

1. `src/app/api/produtos/importar-ml/route.ts:197` grava `imagemUrl: item.thumbnail || null`. Na API do Mercado Livre, o campo `thumbnail` é servido em **HTTP**; o campo correto é **`secure_thumbnail`** (ou `pictures[0].secure_url`, de maior resolução).
2. `src/app/api/mercadolivre/produtos/link/route.ts:122` grava `imagemUrl: mlItem.thumbnail` com o mesmo problema.
3. `src/app/(root)/produtos/components/ProdutoTableRow.tsx:82` usa `<Image src={produto.imagemUrl}>` **direto**, sem passar pela normalização que existe em `src/app/components/shared/MLImage.tsx` (`fixImageUrl`, que converteria http→https).

### Correção
1. Na gravação, usar `secure_thumbnail` com fallback para `pictures?.[0]?.secure_url` e, por último, `thumbnail` normalizado. Aplicar nos dois arquivos acima e em qualquer outro ponto que grave imagem.
2. Criar `src/lib/imageUrl.ts` com `normalizeImageUrl(url: string | null): string | null` que force HTTPS, corrija protocolo duplicado e devolva `null` para valor vazio. Usar na gravação **e** na leitura (serialização em `/api/produtos` e `/api/produtos/[id]`).
3. Criar um componente único `ProductImage` em `src/components/ui`, com `next/image`, normalização, `onError` e fallback com o cubo da marca em `bg-muted`. Substituir **todos** os usos diretos de `next/image` e `<img>` para imagem de produto: `ProdutoTableRow.tsx`, `produtos/[id]/page.tsx`, `produtos/vincular/page.tsx`, `saidas/components/VendaMLDetalhesDialog.tsx`, `MercadoLivre/MLProductRow.tsx`, `MLProductLinkModal.tsx`, `MercadoLivreProductInfo.tsx`, `MercadoLivreSmartSync.tsx`, `configuracoes/page.tsx`.
4. Adicionar em `next.config.mjs` o padrão curinga `{ protocol: "https", hostname: "**.mlstatic.com" }`, mantendo os existentes — o ML usa muitos subdomínios (`mlb-d1-p`, `mlb-s3-p`, etc.) que hoje não estão listados.
5. **Migração dos dados existentes**: script que percorre `Produto` e reescreve `imagemUrl`/`imagemThumbUrl` para HTTPS. Rodar em modo simulação primeiro, informando quantos registros serão alterados (esperado: 35).

### Aceite
As imagens aparecem em Produtos, ficha do produto, Anúncios do ML e vínculo; nenhum registro com `http://` em `imagemUrl`; produto sem imagem mostra o fallback da marca, nunca ícone quebrado.

---

## FASE 2 — Sincronização do Mercado Livre (regressão ainda ativa)

### Diagnóstico
`sales-complete`, `produtos/vendas-ml` e `saida/vendas-ml` respondem **503**. A interface exibe "Não foi possível carregar todos os pedidos do Mercado Livre" no painel do ML e derruba Dashboard, Análise de Vendas, a coluna "Vendas ML" em Produtos e a aba Mercado Livre em Saídas.

Causa em três camadas:
1. `MercadoLivreService.getUserOrders` **não aceita filtro de data** — só `seller`, `buyer`, `status`, `offset`, `limit`, `sort`. O código busca **todo o histórico** e filtra o período em memória.
2. `src/lib/mlOrders.ts` tem `DEFAULT_MAX_ORDERS = 2000`; a conta já passa disso, então a coleta retorna `truncated: true`.
3. `fetchAllOrdersOrThrow` transforma isso em `PartialOrdersError` e a rota devolve 503 sem dados.

### Correção
1. **Filtro de data em `getUserOrders`**: aceitar `dateFrom?: Date | string` e `dateTo?: Date | string`, repassando à API como `order.date_created.from` e `order.date_created.to` em ISO-8601 com offset (ex.: `2026-08-21T00:00:00.000-03:00`). Preservar parâmetros e comportamento atuais quando as datas não forem informadas.
2. **Propagar em `fetchAllOrders`** (`dateFrom`/`dateTo` em cada página). Com o recorte, cada consulta traz dezenas de pedidos e o truncamento deixa de ocorrer.
3. **Aplicar o recorte nas rotas**, inclusive na consulta do período anterior usada para comparação: `analytics/sales-complete`, `analytics/sales-optimized`, `produtos/vendas-ml`, `saida/vendas-ml`.
4. **Elevar `DEFAULT_MAX_ORDERS` para 5000** como rede de segurança, mantendo a sinalização de truncamento.
5. **Degradar em vez de bloquear**: se ainda vier incompleto, responder **200** com os dados obtidos mais `parcial: true` e `pedidosFaltantes`. A interface mostra aviso discreto ao lado dos números, nunca tela vazia. Reservar `PartialOrdersError` só para falha total.
6. **Corrigir `GET /api/mercadolivre/sync` (500)**: hoje responde "Erro ao carregar dados de sincronização". Investigar, tratar o erro real e devolver histórico vazio com 200 quando não houver registros.
7. **Corrigir `produtos/pendentes` (400)**: garantir que o frontend envie `accountId` ou que a rota use a conta ativa do usuário como padrão.

### Aceite
Nenhuma rota responde 503 ou 500; cinco chamadas seguidas a `sales-complete` retornam o mesmo total; Dashboard e Análise de Vendas exibem o mesmo valor para o mesmo período.

---

## FASE 3 — Conformidade com a API do Mercado Livre

Revisar `src/services/mercadoLivreService.ts` contra o comportamento documentado da API:

1. **Imagens**: preferir `secure_thumbnail` e `pictures[].secure_url`; `thumbnail` é HTTP e tem baixa resolução (Fase 1).
2. **Paginação de `/orders/search`**: limite máximo de 50 por página e `offset` máximo de 10.000. Com o filtro de data da Fase 2 isso deixa de ser limitante, mas o código deve tratar o teto explicitamente em vez de estourar.
3. **Rate limit**: implementar backoff exponencial para HTTP 429 e limitar chamadas concorrentes (fila com concorrência máxima de 5). Hoje há `Promise.allSettled` disparando várias chamadas de uma vez.
4. **Token**: o access token dura ~6 horas e o refresh token é de **uso único** — a cada refresh, o ML devolve um novo refresh token que precisa ser persistido. Verificar se `getValidToken` está gravando o novo refresh token; se não estiver, a conta expira sozinha depois de um tempo.
5. **Taxas reais**: usar `sale_fee` de cada `order_item` e o custo de frete do pedido para a receita líquida, em vez de percentual estimado.
6. **Webhooks**: conferir os tópicos assinados (`orders_v2`, `items`, `questions`, `messages`) e que o endpoint responda **HTTP 200 em até 500 ms**, processando em segundo plano — o ML remove a aplicação de notificações se houver falhas recorrentes.
7. **Status de anúncio**: tratar `active`, `paused`, `closed` e `under_review`. Hoje a listagem filtra "Ativos" por padrão e esconde os demais (ver Fase 4).

---

## FASE 4 — Anúncios, sincronização e dados que hoje enganam

### Diagnóstico
- A tela `Produtos Mercado Livre` mostra **7 de 55 anúncios**, porque o filtro padrão é "Ativos". Chamando a API com `status=all` retornam os 55. O seller tem **44 anúncios pausados** e a interface não ajuda a tratá-los.
- A coluna "Última Sync" mostra **22/08/2026** e, em alguns itens, **05/10/2025** — um mês e quase um ano sem sincronizar, mesmo com "Auto ativado" no painel.
- "Vendas Hoje 0" convive com "17 na semana" sem indicação de horário da última atualização dos dados.
- Todos os 35 produtos estão sem custo médio e sem fornecedor, o que inviabiliza a Reposição (a própria tela já avisa isso).

### Correção
1. Filtro padrão passa a ser **"Todos"**, com contadores visíveis por status (Ativos 7 · Pausados 44 · Encerrados N). Manter o filtro por status disponível.
2. Destaque acionável para anúncios pausados: bloco no painel do ML com a contagem, o valor potencial parado e link direto para a lista filtrada.
3. **Auto-sync real**: verificar se o agendamento está registrado em `vercel.json` como cron e se o handler está protegido por `CRON_SECRET`. O rótulo "Auto ativado" só pode aparecer se houver execução recente registrada; caso contrário, mostrar "Nunca sincronizado" com botão de sincronizar agora.
4. Exibir em cada tela de dados do ML a hora da última atualização e o botão de recarregar (padrão já usado no painel).
5. Na tela de Produtos, transformar o aviso "35 produtos sem custo médio ou sem fornecedor" em fluxo: ação em lote para definir fornecedor e custo, e importação de custos por planilha.

---

## FASE 5 — Bling

1. A conta está com `isActive: false` (token expirado) e a interface já mostra o CTA "Reconectar" corretamente. Após o deploy das fases anteriores, reconectar manualmente e validar o fluxo inteiro.
2. Conferir na API v3 do Bling: access token de ~6 horas, **refresh token de uso único** (persistir o novo a cada renovação), rate limit de 3 requisições por segundo e 120.000 por dia, paginação com limite de 100 por página.
3. Garantir backoff em HTTP 429 e paginação completa na importação de produtos, com upsert idempotente por SKU normalizado.
4. Confirmar que o cron diário de refresh existe e está protegido — sem ele o refresh token morre por inatividade, que foi o que aconteceu.
5. Importação deve gravar a imagem do produto do Bling já normalizada em HTTPS (Fase 1).

---

## FASE 6 — Perfil do usuário

`GET /api/perfil` responde **404** — a funcionalidade nunca foi criada, embora exista a área de Usuários. O modelo `User` já tem o campo `image`.

1. `GET /api/perfil`: `id`, `name`, `email`, `image`, `createdAt`, provedor de login e se possui senha definida.
2. `PATCH /api/perfil`: atualizar `name` e `image`, com Zod (nome de 2 a 80 caracteres). Nunca permitir alterar e-mail de conta OAuth.
3. `POST /api/perfil/senha`: exige senha atual, valida a nova (mínimo 8 caracteres com letra e número), grava com bcrypt. Bloquear para contas exclusivamente Google, com mensagem explicativa.
4. `POST /api/perfil/avatar`: upload via Vercel Blob (o domínio já está liberado em `next.config.mjs`), jpg/png/webp até 2 MB, validando o tipo real do arquivo e removendo o anterior.
5. Componente `UserAvatar` (imagem ou iniciais sobre `bg-accent`), usado no header e no perfil. Menu do usuário com avatar, nome, e-mail e itens "Meu perfil", "Configurações", "Sair".
6. Tela `/perfil` com avatar, nome editável, e-mail somente leitura, bloco de segurança e data de criação. Atualizar a sessão (`useSession().update()`) após salvar.

---

## FASE 7 — Revisão tela a tela

Percorrer **todas** as telas logado na conta real e corrigir o que aparecer. Para cada uma: carrega sem erro, dados reais, estados de carregamento e vazio, ações funcionando, responsivo em 375px e nenhum erro no console.

`visao-geral` · `produtos` · `produtos/[id]` · `produtos/importar` · `produtos/importar-estoque` · `produtos/vincular` · `reposicao` · `saidas` · `pedidos-compra` (+ pendentes e concluídos) · `fornecedores` (+ subtelas) · `estoque/armazens` · `estoque/criarArmazem` · `estoque/transferencias` · `mercado-livre` · `mercado-livre/produtos` · `mercado-livre/vendas` · `mercado-livre/configuracoes` · `configuracoes` · `configuracoes-gerais` · `integracoes` · `usuarios` · `onboarding` · `perfil`

Pontos já conhecidos a resolver nessa passagem:
- Painel `mercado-livre` ainda usa 8 cards uniformes com ícone decorativo; aplicar `PageHeader`, `HeroMetric`, `StatStrip` e `SectionCard` como nas telas já refeitas.
- Pedidos concluídos exibindo "0 produtos / R$ 0,00" — o dado existe, falta incluir no `include` da listagem.
- Transferências sem registros: empty state com ação.

---

## FASE 8 — Fechamento para produção

1. Navegar por todas as telas registrando qualquer 4xx/5xx e corrigir; nenhuma tela pode terminar em erro silencioso.
2. Remover `console.log` de rotas e serviços; manter apenas `console.error` de exceção.
3. Confirmar que o Sentry está capturando erros de client e server.
4. Acessibilidade: foco visível, contraste AA nos dois temas, `aria-label` em botões só com ícone.
5. Segurança: deslogado, nenhuma rota `/api/*` (exceto auth e webhook) pode responder 200.
6. Conferência final: Dashboard e Análise de Vendas com o mesmo número para o mesmo período, estável em cinco recargas.
7. `npx tsc --noEmit` e `npx next lint` limpos; build de produção sem warnings novos.

---

## Ordem de execução

1. Imagens: `secure_thumbnail`, `normalizeImageUrl`, `ProductImage`, curinga `**.mlstatic.com`, migração dos 35 registros
2. Sincronização: filtro de data, recorte nas 4 rotas, limite 5000, degradação em vez de 503, correção do `sync` 500 e do `pendentes` 400
3. Conformidade com a API do ML: rate limit, refresh token de uso único, taxas reais, webhooks
4. Anúncios: filtro padrão "Todos", bloco de pausados, auto-sync real, fluxo de custo e fornecedor
5. Bling: reconexão, paginação, backoff, cron de refresh, imagem normalizada
6. Perfil: rotas, avatar, `UserAvatar`, menu e tela
7. Revisão tela a tela com a identidade aplicada no painel do ML
8. Fechamento: logs, Sentry, acessibilidade, segurança e verificação final
