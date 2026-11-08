# Auditoria — Ciclo 14 (identidade, Bling, Central de controle, admin)

## O que foi pedido

Identidade visual com mais qualidade (logo, "Skubo" com S maiúsculo, ML com quadrado no modo escuro), partes quebrando (Bling não conectando/vinculando), jornada inicial fraca, menos redundância, mais usuários, financeiro melhor (faturamento com frete como no Mercado Turbo), página de admin para subdomínio, central de controle dos dados com IA paga, código limpo sem comentários, responsivo, todos os testes passando.

## Entregue

### Identidade
- Símbolo redesenhado: caixa isométrica em degradê violeta com tampa verde flutuando (borda iluminada, interior escuro aparecendo entre caixa e tampa). Wordmark "Skubo" em Sora 700, gerado como contorno vetorial (não depende de fonte).
- Ícones do app (`icon`, `apple-icon`, 192, 512, maskable) regerados a partir dos SVGs em `public/brand/skubo/`.
- `ML.png` com fundo transparente: some o quadrado branco no tema escuro. `MercadoLivreIcon` passa a usar `unoptimized`.
- Bug achado no caminho: o middleware redirecionava qualquer arquivo de `public/` para `/login` quando a requisição não tinha cookie — o `_next/image` busca a imagem sem cookie e quebrava o ícone do ML. O matcher agora libera todo caminho com extensão.
- Fontes locais (`next/font/local`, Inter/Sora/JetBrains Mono em `src/app/fonts`) — o build deixou de depender do Google Fonts.
- Refino visual: barra superior flutuante com vidro, fundo com brilho da marca, item ativo da sidebar com barra lateral, cartões com sombra/hover, `StatCard` com ícone e versão destaque em degradê, paleta dos gráficos alinhada à marca, containers das páginas alinhados com a barra (30 páginas).

### Bling
- `state` do OAuth assinado (HMAC com `NEXTAUTH_SECRET`, carrega o usuário e expira em 15 min): o callback não depende mais do cookie de sessão voltar do Bling, que era a causa de `sessao_invalida`/`state_expirado` quando o domínio de retorno diferia.
- `BLING_CLIENT_ID/SECRET` lidos com `trim()` (espaço/quebra de linha no painel da Vercel quebrava a troca do código).
- Teste de escopos logo após conectar (`verificarEscopos`): Integrações mostra o que falta marcar e o botão Reconectar; se estiver tudo certo, já abre a sincronização de catálogo.
- Fim das rotinas paralelas de importação (decisão pendente desde o Ciclo 12): removidos `/api/bling/produtos/importar`, `/api/produtos/estoque-bling`, `/api/produtos/matching`, `productMatchingService`, `pollBlingSyncHistory` e a tela `/produtos/importar` (redireciona para `/comecar`). Tudo passa pelo motor único `catalogo/sincronizacao`.
- Vínculo: sugestões agora encontram **kits do Bling pelo SKU** (antes `isKit: false` excluía) e incluem anúncios **pausados**.

### Usuários e acesso
- Convite aceita quem já tem login no Skubo sem loja própria (antes: "já existe usuário" e travava). Convite pendente vencido não bloqueia; reconvidar revoga o anterior.
- Convite aplicado também no login com Google (`aplicarConvitePendente` no `jwt`).
- Login com Google para um e-mail já cadastrado com senha criava usuário duplicado e estourava a unique de e-mail — agora reaproveita o usuário.
- E-mails normalizados (minúsculas, sem espaço) em cadastro, login e convite.
- `/api/register` devolvia o hash da senha na resposta — corrigido; ganhou limite de tentativas e senha mínima de 8.
- Depois do cadastro o usuário entra direto e cai em `/comecar` (antes voltava para o login).
- Link do convite: copiar de novo da lista e enviar pelo WhatsApp. Sem limite de pessoas.

### Jornada inicial
- `/comecar` refeito: cabeçalho com saudação, próximo passo em destaque com tempo estimado, progresso e níveis; etapas agrupadas em 4 fases com linha do tempo; painel lateral com benefícios e ajuda.

### Faturamento com frete (Mercado Turbo)
- Cartão "Quanto foi faturado de verdade" na Visão geral e no Financeiro, com três visões: só produtos, com frete (produtos + frete do comprador + frete do vendedor) e em nota fiscal; hoje, frete do período e tabela por dia.
- Notas fiscais de saída do Bling (`NotaFiscalVenda`), lidas pelo cron diário (3 dias) e pelo botão "Trazer notas do Bling", ligadas à venda pelo `numeroPedidoLoja`. Novo escopo: Notas fiscais (leitura).

### Central de controle (`/controle`)
- Substitui "Saúde dos dados". Nota 0–100, 5 áreas (Integrações, Estoque, Cadastro, Anúncios, Financeiro e DRE) e lista priorizada com ação direta: produto vendendo sem estoque, ruptura antes do prazo do fornecedor, capital parado 90 dias, sem custo, margem negativa, sem fornecedor, anúncios sem vínculo/abaixo do custo, vendas do mês sem CMV, vendas sem detalhe do pagamento, imposto não configurado, nenhuma despesa lançada, cobranças sem categoria, notas fiscais não trazidas.
- Só agrega regras existentes (reposição, pendências, saúde dos anúncios, motor do Financeiro).

### Análise com IA (paga)
- `AnaliseIa` + `Subscription.iaAtiva/iaAtivadaEm/iaSolicitadaEm`. Pedido de ativação na tela de Assinatura notifica os admins; ativação pelo painel admin. Limite mensal configurável. Resposta estruturada (resumo, 5 prioridades, riscos, oportunidades) salva com tokens.

### Painel admin (`/admin`)
- MRR estimado, lojas (total, novas, ativas), assinaturas (teste, ativas, inadimplentes, conversão, testes vencendo), IA, integrações, GMV e pedidos com gráficos de 30 dias, saúde técnica (webhooks, fila, falhas de detalhe). Lista de contas com busca, filtros e interruptor de IA.
- Pronto para subdomínio: `ADMIN_HOST` faz o middleware servir `/admin/*`; `AUTH_COOKIE_DOMAIN` compartilha a sessão; `redirect` do NextAuth aceita o host do admin.

### Limpeza
- Sidebar: Central de controle no topo; o grupo "Mercado Livre" com um item só virou link em Anúncios.
- Código sem comentários (1.634 removidos via AST do TypeScript, preservando diretivas de lint e `@ts-*`; CSS também).

## Verificação

- `tsc --noEmit`: limpo. `next lint`: limpo. `next build`: ok.
- Vitest: 136 arquivos, 789 testes passando (novos: state do Bling, convites, sugestões de kit/pausado, notas fiscais, faturamento com frete, diagnóstico, parser da IA, métricas admin, admin da plataforma).
- Playwright: 15 passando nos 3 viewports, incluindo o novo `06-central-controle-faturamento` (Central, cartão de faturamento, admin fechado para não-admin).
- Inspeção visual em claro/escuro, desktop e 390px.

## Pontos para o próximo ciclo

- Campos da NF do Bling: o mapeamento aceita `valorNota`/`valorFrete`/`numeroPedidoLoja` no topo ou `transporte.frete`; validar com uma conta real e ajustar se o Bling devolver outro nome.
- Cobrar a IA pelo Mercado Pago junto com a assinatura (hoje é ativação manual).
- Migrations escritas à mão (sem `prisma migrate diff` disponível no ambiente); rodar `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url ...` uma vez para confirmar que não há drift.
