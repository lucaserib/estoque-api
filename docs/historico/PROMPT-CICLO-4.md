# Leap Stock — Ciclo 4: Levar o software a 100%

Documento autocontido de execução. Diagnóstico verificado em produção em 24/08/2026 com a conta real (leapstoreoficial@gmail.com, 35 produtos, 55 anúncios ML). Execute as fases **na ordem**. Ao final de cada fase: `npx tsc --noEmit` e `npx next lint` limpos, e um commit descritivo em português.

**Objetivo final:** aplicação sem erros, com dados reais em todas as telas, identidade visual consistente, perfil de usuário completo e nome Leap Stock. Sem quebrar nenhuma integração.

**Regra inegociável:** a Fase 1 corrige uma regressão que está derrubando telas agora. Execute e faça deploy da Fase 1 antes de qualquer mudança visual. Nas fases visuais, não altere contratos de API, cálculos, queries Prisma nem lógica de sincronização — se um ajuste visual exigir mudar dados, pare e reporte.

## Diretrizes de código
1. Sem comentários em código; nomes explicam a intenção. Remova comentários dos arquivos que editar.
2. TypeScript estrito, sem `any` novos, retornos explícitos em rotas e serviços.
3. Cor apenas por token semântico. Proibido `bg-white`, `bg-gray-*`, `bg-emerald-*`, hex hardcoded em componente e emoji em texto de interface.
4. Prisma sempre pelo singleton `@/lib/prisma`. Toda rota: `verifyUser`, validação de entrada, verificação de posse pelo `userId`, erro tipado `{ error, code? }`.
5. Skeleton em carregamento, empty state com ação, erro com mensagem humana e botão de recuperação.
6. Nenhuma tela pode exibir dado inventado, placeholder ou valor fixo — tudo vem do banco ou da API.

---

## Estado atual verificado (rotas testadas na conta real)

| Rota | Status |
|---|---|
| `analytics/sales-complete` | **503 ML_DADOS_PARCIAIS** |
| `produtos/vendas-ml` | **503 ML_DADOS_PARCIAIS** |
| `saida/vendas-ml` | **503 ML_DADOS_PARCIAIS** |
| `analytics/sales` | **404** (rota não existe, front ainda chama) |
| `produtos/pendentes` | 400 "ID da conta ML não fornecido" |
| `replenishment/config` | 400 "ID do produto é obrigatório" |
| `produtos`, `fornecedores`, `pedidos-compra`, `saida`, `estoque/armazens`, `transferencias`, `notificacoes`, `dashboard/valor-estoque`, `analytics/restock`, `dashboard/metrics` | 200 |

---

## FASE 1 — Corrigir a sincronização do Mercado Livre (CRÍTICO)

### Causa raiz
1. `MercadoLivreService.getUserOrders` **não aceita filtro de data** — a assinatura só tem `seller`, `buyer`, `status`, `offset`, `limit`, `sort`. O código busca **todo o histórico de pedidos** e filtra por período em memória.
2. `src/lib/mlOrders.ts` usa `DEFAULT_MAX_ORDERS = 2000`. A conta já ultrapassa esse volume, então a coleta termina com `truncated: true` e `complete: false`.
3. `fetchAllOrdersOrThrow` converte isso em `PartialOrdersError` e a rota devolve 503 sem dados. Antes o limite era 500 e truncava em silêncio (números errados); agora a tela não abre. Os dois comportamentos estão errados.

### Correção
1. **Filtro de data em `getUserOrders`**: aceitar `dateFrom?: Date | string` e `dateTo?: Date | string`, repassando à API do ML como `order.date_created.from` e `order.date_created.to` em ISO-8601 com offset (ex.: `2026-07-24T00:00:00.000-03:00`). Preservar todos os parâmetros e o comportamento atual quando as datas não forem informadas.
2. **Propagar em `fetchAllOrders`**: campos opcionais `dateFrom`/`dateTo` repassados a cada página. Com o recorte, o volume por consulta cai para dezenas de pedidos e o truncamento deixa de ocorrer.
3. **Aplicar o recorte nas 4 rotas** que usam a coleta estrita, inclusive na consulta do período anterior para comparação:
   - `src/app/api/mercadolivre/analytics/sales-complete/route.ts`
   - `src/app/api/mercadolivre/analytics/sales-optimized/route.ts`
   - `src/app/api/produtos/vendas-ml/route.ts`
   - `src/app/api/saida/vendas-ml/route.ts`
4. **Elevar `DEFAULT_MAX_ORDERS` para 5000** como rede de segurança, mantendo a sinalização de truncamento.
5. **Degradar em vez de bloquear**: se ainda vier incompleto, responder **200** com os dados obtidos mais `parcial: true` e `pedidosFaltantes: number`. A interface exibe aviso discreto ao lado dos números, nunca tela vazia. Reservar `PartialOrdersError` apenas para falha total (nenhuma página carregada).
6. **Remover a chamada morta** a `/api/mercadolivre/analytics/sales` (404) no frontend, apontando para `sales-complete`.
7. **Corrigir os 400 legítimos**: `produtos/pendentes` e `replenishment/config` exigem parâmetro obrigatório — garantir que o frontend sempre envie, ou que a rota tenha padrão sensato.

### Aceite
Nenhuma rota responde 503 na conta real; cinco chamadas seguidas retornam o mesmo total; Dashboard, Análise de Vendas, painel Mercado Livre, coluna "Vendas ML" em Produtos e aba Mercado Livre em Saídas voltam a exibir dados.

---

## FASE 2 — Rebrand: Leap Store → Leap Stock

1. Substituir em todo o código: `"Leap Store"` → `"Leap Stock"`, `LEAP STORE` → `LEAP STOCK`, e qualquer resíduo de `Estoca`.
2. `src/app/layout.tsx`: `title` "Leap Stock — Estoque e reposição para sellers", `description` e `openGraph` coerentes.
3. `src/components/brand/Logo.tsx`: wordmark "LEAP STOCK" em Display 700, caixa alta, `tracking-[0.18em]`. O cubo permanece.
4. Sidebar, login, registro, rodapé (`Leap Stock © {ano}` dinâmico), e-mails transacionais, onboarding e textos de ajuda.
5. **Não alterar** o nickname do seller vindo da API do ML ("Leap Store"/"LEAPSTORE") nem o nome da conta exibido em Integrações — é dado do marketplace, não marca do produto.
6. Conferir que nenhum `redirect_uri`, nome de tabela, chave de banco ou variável de ambiente foi renomeado junto.

### Aceite
`grep -rn "Estoca" src` vazio; ocorrências de "Leap Store" apenas onde representam o seller; integrações intactas.

---

## FASE 3 — Perfil de usuário completo

### Diagnóstico
Não existe **nenhuma** rota de perfil no projeto. O modelo `User` tem o campo `image`, mas nada o preenche ou exibe. Na tela de Configurações, o bloco "Conta" mostra apenas nome e e-mail como texto estático, com um botão "Sair da conta". O menu do header tem somente "Sair da conta", sem avatar. É o ponto que mais faz o software parecer inacabado.

### Backend
1. `GET /api/perfil`: retorna `id`, `name`, `email`, `image`, `createdAt`, provedor de login (credenciais ou Google) e se possui senha definida.
2. `PATCH /api/perfil`: atualiza `name` e `image`. Validar com Zod (nome de 2 a 80 caracteres). Nunca permitir alterar `email` de conta OAuth.
3. `POST /api/perfil/senha`: troca de senha para contas com credenciais — exige senha atual, valida a nova (mínimo 8 caracteres, com letra e número), grava com bcrypt. Bloquear para contas exclusivamente OAuth, com mensagem explicativa.
4. `POST /api/perfil/avatar`: upload de imagem via Vercel Blob (`@vercel/blob`), aceitando jpg/png/webp até 2 MB, com validação de tipo real do arquivo. Gravar a URL em `User.image` e remover o arquivo anterior. Alternativa aceita: aceitar apenas URL externa, se preferir não adicionar dependência — nesse caso documentar a escolha.
5. Todas as rotas com `verifyUser` e operando exclusivamente sobre o próprio usuário.

### Frontend
1. Componente `UserAvatar` em `src/components/brand`: exibe a imagem quando houver; sem imagem, mostra as iniciais do nome sobre fundo `--accent` com texto `--primary`. Tamanhos `sm` (header), `md` (menu), `lg` (perfil).
2. Menu do header: `UserAvatar` + nome + e-mail no topo, itens "Meu perfil", "Configurações", "Sair da conta". Substitui o menu atual de item único.
3. Nova tela `/perfil` (ou seção "Conta" expandida em `/configuracoes-gerais`) com:
   - Avatar grande com ação de trocar e remover foto, mostrando progresso do upload
   - Campo de nome editável com salvamento e feedback
   - E-mail somente leitura, com aviso quando vier de login Google
   - Bloco "Segurança": troca de senha (oculto para contas OAuth)
   - Bloco "Conta": data de criação e plano/assinatura, se existir
4. Atualizar a sessão do NextAuth após salvar (`useSession().update()`) para o header refletir nome e foto sem recarregar.
5. Estados completos: skeleton ao carregar, botão desabilitado durante o envio, toast de sucesso e erro humano.

### Aceite
Perfil abre com dados reais, permite trocar nome e foto com efeito imediato no header, troca de senha funciona para conta com credenciais e é ocultada em conta Google; nenhuma imagem quebrada.

---

## FASE 4 — Concluir a identidade nas telas restantes

Apenas 4 de 26 telas usam o novo sistema (`dashboard`, `mercado-livre/vendas`, `reposicao`, `produtos`). As demais seguem com `Card` genérico e composição antiga. Aplicar `PageHeader`, `HeroMetric`, `StatStrip`, `SectionCard`, `DataTable` e `StatusPill` nesta ordem:

### 4.1 Canal Mercado Livre
- `mercado-livre/page.tsx`: hoje são 8 cards uniformes com ícone decorativo. Passa a `PageHeader` "MERCADO LIVRE", `HeroMetric` com a receita da semana, `StatStrip` (Vendas hoje · Pedidos pendentes · Produtos ativos · Estoque baixo) e `SectionCard` para Saúde dos Produtos e Ações Rápidas. Dar destaque próprio e ação ao bloco "Produtos Pausados 44 de 55" — é receita parada.
- `mercado-livre/produtos/page.tsx`: `DataTable` com miniatura, `StatusPill` para ativo/pausado, filtros na barra do `PageHeader`.
- `mercado-livre/configuracoes/page.tsx` e `configuracoes/page.tsx`: `SectionCard` por bloco, conexão com `StatusPill`, ações de conectar/reconectar/desconectar.

### 4.2 Produtos e estoque
- `produtos/[id]/page.tsx`: abas Dados · Fornecedores · Estoque · Mercado Livre · Histórico; cabeçalho com imagem e SKU em destaque.
- `produtos/importar`, `produtos/importar-estoque`, `produtos/vincular`: etapas com `StatusPill` (pendente/concluído/erro), sem cards coloridos.
- `estoque/armazens`, `estoque/criarArmazem`, `estoque/transferencias`: `PageHeader` + `DataTable`.

### 4.3 Operação
- `gestao-pedidos` e subtelas: `DataTable`, `StatusPill` no ciclo do pedido, valores com `tabular-nums`. **Corrigir o bug conhecido de pedidos concluídos exibindo "0 produtos / R$ 0,00"** — o dado existe, falta incluir no `include` da listagem.
- `fornecedores` e subtelas: `PageHeader` + `DataTable`.
- `saidas`: `PageHeader`, `StatStrip` (Saídas manuais · Itens · Receita), `DataTable` com as duas abas.
- `configuracoes-gerais` (migrar de `Card` para `SectionCard`) e `onboarding` (aplicar tokens e o cubo da marca).

### Regras da fase
- Um único `HeroMetric` por tela; no máximo 4 métricas em `StatStrip`; nenhum `Card` para número isolado; sem ícone decorativo de canto.
- Nenhuma mudança em chamadas de API, filtros, ordenação ou dados exibidos.

### Aceite
`grep -rn "bg-white\|bg-gray-\|bg-emerald-" src --include=*.tsx` sem resultados; todas as telas com `PageHeader`; temas claro e escuro íntegros; comportamento idêntico.

---

## FASE 5 — Acabamento e robustez

1. **Varredura de erros**: navegar por todas as telas logado e registrar qualquer 4xx/5xx ou erro de console; corrigir cada um. Nenhuma tela pode terminar em estado de erro silencioso.
2. **Estados vazios reais**: toda lista vazia mostra o cubo da marca, uma frase objetiva e um botão de ação (ex.: Transferências, hoje com zero registros).
3. **Skeletons no formato do conteúdo** (linhas de tabela, faixa de stats, bloco de gráfico), não retângulos genéricos.
4. **Remover `console.log`** de rotas e serviços; manter apenas `console.error` de exceção.
5. **Sentry** (`@sentry/nextjs`) em client e server com `tracesSampleRate` baixo.
6. **Acessibilidade**: foco visível com `ring` em `--primary`, contraste AA nos dois temas, `aria-label` nos botões só com ícone.
7. **Responsivo**: validar 375px, 768px e 1440px; `StatStrip` em 2 colunas no mobile; tabelas com rolagem horizontal e primeira coluna fixa.
8. **Metadados**: favicon e `apple-icon` a partir do cubo, imagem de OpenGraph própria.

---

## FASE 6 — Verificação final

1. **Mercado Livre**: conectar/desconectar, sincronizar produtos, atualizar dados, analytics em 7/30/90 dias e período personalizado, webhooks.
2. **Bling**: status correto (`isActive`), fluxo de reconexão, importação com resumo, atualização de estoque.
3. **Conferência cruzada**: Dashboard e Análise de Vendas exibem o mesmo valor para o mesmo período; cinco recargas mantêm o número.
4. **Perfil**: alterar nome e foto reflete no header; troca de senha funciona.
5. **Segurança**: deslogado, nenhuma rota `/api/*` (exceto auth e webhook) responde 200.
6. **Console** sem erros e sem 404/405 em nenhuma tela.
7. `npx tsc --noEmit` e `npx next lint` limpos; build de produção sem warnings novos.

---

## Lista de tarefas em ordem

1. Filtro de data em `getUserOrders` e `fetchAllOrders`
2. Recorte por data nas 4 rotas com coleta estrita
3. Limite para 5000 e troca do bloqueio 503 por resposta parcial com aviso
4. Remover chamada morta a `analytics/sales` e corrigir os 400 de `produtos/pendentes` e `replenishment/config`
5. Deploy e validação da sincronização na conta real
6. Rebrand Leap Store → Leap Stock, preservando o nickname do seller
7. Backend do perfil: `GET/PATCH /api/perfil`, `POST /api/perfil/senha`, `POST /api/perfil/avatar`
8. Frontend do perfil: `UserAvatar`, menu do header e tela `/perfil`
9. Redesenho do canal Mercado Livre (painel, produtos, configurações)
10. Redesenho de Produtos (ficha e fluxos) e Estoque
11. Redesenho de Pedidos (com correção do "0 produtos / R$ 0,00"), Fornecedores, Saídas, Configurações e Onboarding
12. Acabamento: estados vazios, skeletons, limpeza de logs, Sentry, acessibilidade e responsivo
13. Verificação final das integrações e varredura de tokens de cor
