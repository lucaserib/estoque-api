# Estoca — Ciclo 2 de Correções e Melhorias (prompt de execução)

Você vai corrigir e melhorar o sistema Estoca (este repositório). Este documento é autocontido: contém diagnóstico verificado em produção (19/07/2026, conta real Leap Store), as correções exigidas e os critérios de aceite. Execute as fases NA ORDEM. Ao final de cada fase: rode `npm run build` e `npm run lint` sem erros, e faça um commit com mensagem descritiva em português.

## Contexto da stack
Next.js 15 App Router · React 19 · TypeScript · Prisma/PostgreSQL · NextAuth (userId injetado em headers, rotas usam `verifyUser(request)`) · Tailwind com tokens CSS (padrão shadcn, já implementado: `bg-background`, `bg-card`, `text-muted-foreground`, `--primary` esmeralda etc.) · Deploy Vercel a partir do GitHub, branch master. `User.id` é UUID. Valores monetários no banco em centavos (int).

## Diretrizes de código (valem para TODAS as fases)
1. Nenhum comentário em código: nada de `//` ou `/* */` no código produzido ou editado; o código deve se explicar por nomes claros de funções, variáveis e tipos. Remova comentários existentes dos arquivos que você editar (inclusive os blocos de emoji tipo `// ✅ NOVO:`).
2. TypeScript estrito: sem `any` novos, tipos de retorno explícitos em serviços e rotas, interfaces para payloads de API.
3. Extraia lógica repetida: helpers em `src/lib/` (ex.: `formatBRL`, `formatDateBR`), serviços em `src/services/`, hooks em `src/hooks/`. Nada de fetch inline duplicado entre componentes.
4. Componentes pequenos e focados; UI somente com tokens do design system (`bg-card`, `text-muted-foreground`, `--primary` etc.) — proibido `bg-white`, `bg-gray-*`, cores hex hardcoded e emojis em strings de UI.
5. Toda rota de API: validar entrada (Zod), verificar propriedade do recurso pelo `userId`, responder erros tipados `{ error: string, code?: string }` com status HTTP correto, nunca vazar stack trace ou JSON de bibliotecas externas para o cliente.
6. Estados de carregamento com skeleton, estados vazios com CTA, erros com mensagem humana em pt-BR e ação de recuperação.

---

## FASE A — Bling: sincronização confiável de ponta a ponta

### Diagnóstico verificado
`POST /api/bling/produtos/importar` responde 404 `{"error":"Conta Bling não encontrada ou inativa"}`. A conta Bling do usuário está no banco com `isActive: false` e token expirado (o tratamento de `invalid_grant` marca a conta como inativa — comportamento correto). Porém `GET /api/bling/auth?action=accounts` retorna a conta sem expor/filtrar `isActive`, então a tela `/produtos/importar` mostra "Conectar Bling — Concluído" (verde) com a conta morta, e não existe nenhum caminho de reconexão na UI.

### Correções
1. `GET /api/bling/auth?action=accounts`: retornar apenas `id`, `isActive`, `expiresAt`, `createdAt` (nunca tokens). O front considera conectado somente `isActive === true`.
2. Em `/produtos/importar` (e em qualquer outro ponto que exiba status Bling, como o botão "Atualizar Estoque Bling" em `/produtos`): quando existir conta com `isActive: false`, exibir card de alerta âmbar "Conexão com o Bling expirou" com botão "Reconectar" que dispara o fluxo `action=connect`. O callback existente fará upsert dos tokens na conta.
3. `BlingService`: renovar o access token proativamente quando faltar menos de 10 minutos para `expiresAt`. Em `invalid_grant`: marcar conta inativa e lançar erro tipado com `code: "BLING_RECONNECT_REQUIRED"`; todas as rotas que usam Bling propagam esse code e o front trata exibindo o CTA de reconexão.
4. Criar `GET /api/cron/bling-refresh` protegido por `CRON_SECRET` (header `Authorization: Bearer`), que renova tokens de todas as contas ativas; registrar em `vercel.json` com schedule diário. Isso impede o refresh token de expirar por inatividade, que foi a causa raiz do estado atual.
5. `POST /api/bling/produtos/importar`: paginação completa da API v3 (`/produtos?pagina=N&limite=100`) até a última página; tratamento de HTTP 429 com backoff exponencial (limite do Bling: 3 req/s); upsert idempotente por SKU/código; resposta `{ criados, atualizados, ignorados, erros: string[] }` exibida na UI como resumo da importação.
6. `POST /api/produtos/estoque-bling`: mesmas garantias de token e mesmo tratamento de `BLING_RECONNECT_REQUIRED`.

### Aceite
Com conta reativada, importação multi-página funciona e mostra resumo; token invalidado manualmente no banco leva a UI a exibir o CTA de reconexão em vez de erro genérico; cron registrado; nenhum token trafega para o cliente.

---

## FASE B — Notificações e botão de configurações (defeitos no header)

### Diagnóstico verificado
Em `src/app/components/Navbar.tsx`: o ícone `Bell` tem badge fixo "3" e nenhum handler — clicar não faz nada; o link da engrenagem aponta para `/settings`, rota que não existe → 404 em produção.

### Correções — Configurações
1. Criar a página `/configuracoes-gerais` (ou renomear a atual estrutura, mantendo URLs coerentes): a engrenagem do header deve levar a uma página real de configurações com seções:
   - Conta: nome, e-mail (somente leitura se OAuth Google), botão sair.
   - Aparência: toggle claro/escuro persistido.
   - Integrações: status das conexões Mercado Livre e Bling (ativo/expirado, e-mail da conta, última sincronização), com ações conectar/reconectar/desconectar — reutilizar a lógica existente de `/configuracoes` (ML) e do fluxo Bling da Fase A.
2. A página atual `/configuracoes` (integração ML) passa a ser acessível também pela seção Integrações; corrigir todos os links do app que apontem para `/settings`.

### Correções — Notificações
3. Modelo `Notification` no Prisma: `id`, `userId`, `type` (enum: `ESTOQUE_CRITICO`, `SYNC_ERRO`, `BLING_EXPIRADO`, `ML_EXPIRADO`, `PEDIDO_CONCLUIDO`), `title`, `body`, `link`, `readAt`, `createdAt`; índice por `userId, readAt`.
4. Rotas: `GET /api/notificacoes` (lista, paginada, contagem de não lidas), `PATCH /api/notificacoes` (marcar todas como lidas), `PATCH /api/notificacoes/[id]` (marcar uma).
5. Geração de notificações nos pontos que já existem: falha de sincronização ML (rotas de sync), conta Bling/ML marcada inativa (Fase A item 3), produto entrando em estoque crítico (cálculo de reposição). Sem duplicar: não criar nova notificação do mesmo `type`+contexto se houver uma não lida.
6. UI no Navbar: badge com contagem real de não lidas (esconder quando zero); clique abre dropdown (Popover) com as últimas 10 — título, tempo relativo ("há 2 h"), clique navega para `link` e marca como lida; ação "Marcar todas como lidas"; estado vazio "Nenhuma notificação". Polling leve (60 s) ou revalidação ao focar a janela.

### Aceite
Engrenagem abre página de configurações funcional (zero 404); sino mostra contagem real, abre dropdown, marca como lida e navega; forçar um erro de sync gera notificação visível.

---

## FASE C — Dashboard de Vendas ML: estatísticas corretas e úteis

### Diagnóstico verificado
Em `/mercado-livre/vendas`: "Indicadores de Performance" exibe "Itens por Pedido" duplicado (1º e 4º) e métricas sem significado acionável ("Top Produto 44%", "Consistência de Preços 70%"); as visões "Tendências" e "Comparar" renderizam vazias (nada abaixo dos KPIs); "Pedidos Cancelados" e "Produtos Cancelados" idem; o gráfico Evolução mistura 3 séries em 2 eixos; o Top 5 é pizza com valores soltos sem nome de produto; na visão "Relatórios" o card "Relatório Mensal" está com datepicker sobreposto ao texto; KPIs não comparam com período anterior; em `/mercado-livre` o card "Receita Semanal" mostra "1.710,76" sem `R$`; o Dashboard Home (`/dashboard`) continua zerado para seller ML (só considera estoque/saídas locais) e tem controles duplicados ("Limpar filtros" duas vezes, busca interna duplicando a do header).

### Correções
1. Criar `formatBRL(cents: number)` e `formatPercent` em `src/lib/format.ts` e usar em todos os valores monetários/percentuais das telas ML e do Home (corrige o "1.710,76" sem R$).
2. Indicadores de Performance — substituir o bloco pelos 4 indicadores: variação de receita vs período anterior (%), variação de itens vendidos (%), taxa de cancelamento (pedidos cancelados/total), SKUs sem venda no período (com link para a lista filtrada). Tooltip em cada um explicando o cálculo.
3. KPI cards — todos com comparação vs período anterior equivalente (`+12,4% vs 30d anteriores`), seta para cima/baixo com `success`/`destructive`.
4. Gráfico Evolução — uma série por vez com tabs "Receita | Itens | Pedidos", eixo único, área preenchida com a cor primária (`fillOpacity` baixa) e linha de média móvel 7 dias; tooltip mostra os três valores do dia.
5. Top produtos — substituir a pizza por barras horizontais: nome truncado com tooltip completo, valor formatado e % de participação.
6. Dropdown de visões — manter apenas "Visão Geral", "Produtos" e "Relatórios"; remover "Tendências", "Comparar", "Pedidos Cancelados" e "Produtos Cancelados" (os cancelamentos viram o indicador do item 2). Nenhuma visão pode renderizar vazia.
7. Visão Relatórios — corrigir a sobreposição do datepicker no card "Relatório Mensal"; validar exportação CSV.
8. Métricas novas (nesta ordem de prioridade):
   - Receita líquida estimada: receita bruta menos tarifa ML por venda (usar `sale_fee` dos orders quando disponível) menos frete pago pelo seller; exibir como KPI com tooltip do cálculo.
   - Lucro estimado por produto na visão Produtos: (receita líquida − custo médio × unidades), somente quando houver `custoMedio`; coluna com valor em `success`.
   - Projeção do mês: receita acumulada ÷ dias decorridos × dias do mês.
   - Heatmap dia da semana × faixa de horário com contagem de vendas.
9. Dashboard Home unificado — quando o usuário tem conta ML ativa: linha 1 de KPIs (Vendas hoje, Receita 30d ML, SKUs a repor, Valor do estoque local); linha 2 (gráfico de receita 30d + lista dos 5 produtos com reposição mais urgente, com link para `/reposicao`). Remover o card gigante de filtros com controles duplicados; manter um seletor de período compacto no PageHeader. Usuário sem conta ML vê empty state com CTA "Conectar Mercado Livre".

### Aceite
Nenhum valor sem formatação pt-BR; todo KPI com delta; nenhuma visão vazia; indicadores sem duplicata e com tooltip; Home útil para seller ML sem navegar; build sem warnings novos.

---

## FASE D — Redesign visual dos dashboards

Aplicar em `/mercado-livre/vendas`, `/mercado-livre` e `/dashboard` o padrão visual (referência aprovada pelo dono; especificação completa abaixo — siga-a mesmo sem acesso ao mockup):

1. KPI cards neutros: fundo `bg-card`, borda `border-border`, radius 12px; label 13px `text-muted-foreground`; valor 30px, peso 700, `tabular-nums`; delta 13px colorido com seta; ícone Lucide 18px `text-muted-foreground` no canto superior direito. Eliminar todos os cards com fundos pastel coloridos (verde/azul/roxo/laranja) das telas ML e Home.
2. Grid: container `max-w-7xl`, grid de 12 colunas, `gap-4`; seções separadas por 32px; KPIs em 4 colunas → 2 (tablet) → 1 (mobile).
3. Gráficos Recharts: grid horizontal tracejado na cor `border`, sem linhas verticais; eixos sem linha de eixo, labels 12px `muted-foreground`; série principal na cor primária; tooltip com fundo `card`, borda e sombra; sem legenda quando houver uma única série.
4. Filtros: barra única compacta (chips de período · dropdown de visão · atualizar · exportar) alinhada à direita do PageHeader.
5. Skeletons em todos os blocos que carregam dados (shimmer com `bg-muted`); nunca tela em branco ou spinner de página inteira.
6. Microinterações discretas: hover de card elevando sombra com `transition` 200ms.
7. Tabela da visão Produtos: manter estrutura, barra de participação inline na cor primária, badges pill padronizados, coluna de lucro estimado.

### Aceite
Três telas consistentes com a especificação; zero fundos pastel; responsivo em 375px; skeletons presentes; Lighthouse ≥ 90 em performance e acessibilidade nessas rotas.

---

## Verificação final do ciclo (produção, após deploy)
1. Fluxo Bling: reconectar → importar (resumo com números) → atualizar estoque, sem nenhum erro genérico.
2. Sino: contagem real, dropdown funcional, marcar como lida.
3. Engrenagem: abre configurações reais (zero 404).
4. `/mercado-livre/vendas`: todas as visões renderizam, valores formatados, KPIs com delta.
5. `/dashboard`: dados ML no Home, sem controles duplicados.
6. Console do navegador sem erros e sem requisições 404/405 navegando por todas as telas.
7. `grep -rn "//" src --include=*.ts --include=*.tsx` não retorna comentários nos arquivos tocados neste ciclo (exceto URLs em strings).
