# Handoff: Redesign do app de estoque (Leap Store)

## Visão geral
Redesign completo da interface do sistema de estoque multicanal Leap Store (Next.js + Prisma, integrações Mercado Livre e Bling). Cobre 13 telas: login, visão geral, produtos, detalhe do produto, reposição, saídas, pedidos de compra, fornecedores, vendas Mercado Livre, anúncios e vínculos, integrações, configurações e usuários.

O objetivo do redesign foi tirar o app da aparência "amadora": linguagem visual consistente, densidade de dados legível, padrões consolidados de ERP/SaaS, temas claro e escuro.

## Sobre os arquivos de design
Os arquivos `.dc.html` deste pacote são **referências de design feitas em HTML** — protótipos que mostram aparência e comportamento pretendidos, **não código de produção para copiar**. A tarefa é **recriar esses designs dentro do codebase existente** (`estoque-api`: Next.js App Router, React, TypeScript, Tailwind CSS, componentes em `src/app/components/`), usando os padrões já estabelecidos ali.

Concretamente, isso significa:
- Traduzir os estilos inline dos protótipos para classes Tailwind + tokens CSS em `styles/global.css`.
- Manter a estrutura de rotas existente em `src/app/(root)/`; o redesign não muda rotas, só layout e componentes.
- Reaproveitar `lucide-react` (já usado no projeto) para os ícones, em vez dos SVGs inline dos protótipos.
- Preservar toda a lógica de dados existente (fetchers, server actions, Prisma). O redesign é de camada de apresentação.

Para abrir os protótipos: `Leap Store v2.dc.html` precisa de `support.js` e da pasta `brand/` no mesmo diretório. Abra direto no navegador.

## Fidelidade
**Alta fidelidade (hifi).** Cores, tipografia, espaçamentos, raios, sombras e microestados estão definitivos. Recrie fielmente. A grade de dados fake (SKUs, valores, nomes de fornecedores) é ilustrativa — substitua pelos dados reais do schema Prisma.

`Leap Store v1 (anterior).dc.html` é a primeira iteração, mais dura e quadrada, arquivada apenas como histórico. **Implemente a v2.**

## Navegação e shell

### Sidebar (244px, fixa, `position: sticky; top: 0; height: 100vh`)
- Fundo `--surface`, borda direita 1px `--line`.
- Topo: logo `leap-mark.svg` 26px + "Leap Store" (600, 14px) com subtítulo "Comércio LTDA" (400, 11px, `--faint`) e um ícone chevron-up-down 14px à direita (seletor de empresa).
- Navegação em 3 grupos, cada um com um rótulo `font: 500 11px; letter-spacing: .08em; text-transform: uppercase; color: --faint`, padding `8px 8px 6px`:
  - **Operação** — Visão geral, Produtos, Reposição (badge `23`), Saídas, Pedidos de compra, Fornecedores
  - **Canais** — Vendas Mercado Livre, Anúncios e vínculos (badge `6`)
  - **Sistema** — Integrações, Configurações, Usuários
- Item de navegação: `display:flex; gap:11px; padding:9px 10px; border-radius:8px; font:400 13.5px/1.35`. Ícone 17px stroke 1.7, `opacity:.85`. Label com `text-overflow: ellipsis`.
  - Ativo: `background: --primary-soft; color: --primary; font-weight: 500`.
  - Hover (inativo): `background: --surface2`.
  - "Produtos" permanece ativo quando a rota é o detalhe do produto.
- Badge: pílula `padding:2px 7px; border-radius:99px; background:--danger-soft; color:--danger; font:500 11px`.
- Rodapé: divisória 1px `--line2`, avatar circular 32px (`--primary-soft`, borda `--primary-line`, iniciais 600 12px `--primary`), nome (500 13px) + papel (400 11px `--faint`), e botão de sair 28px (ícone log-out 15px) que revela `background:--surface2` no hover.

### Topbar (sticky, altura mínima 60px, padding `10px 28px`)
- Fundo `--surface`, borda inferior 1px `--line`, `z-index: 20`.
- Busca: pílula `border-radius:99px; border:1px solid --line; background:--sunken; padding:8px 14px`, largura flexível até 420px. Ícone de lupa 15px `--faint`, placeholder "Buscar SKU, produto, pedido ou anúncio", e à direita o hint `⌘K` em `IBM Plex Mono` 11px dentro de caixa `border:1px solid --line; border-radius:5px; padding:3px 6px`.
- À direita (`margin-left:auto`, gap 8px):
  - Pílula de status: `border:1px solid --primary-line; background:--primary-soft; padding:7px 13px; border-radius:99px`, ponto 7px `--primary` + texto "Sincronizado 14:02" (500 12px `--primary`). **Deve refletir o timestamp real da última sincronização**; quando houver falha, usar `--warn` / `--danger` com o mesmo formato.
  - Botão de notificações: círculo 34px, borda 1px `--line`, ícone bell 16px, com ponto 7px `--danger` no canto superior direito (borda 1.5px `--surface`).
  - Botão de tema: círculo 34px idêntico, ícone sun/moon conforme o tema.

### Cabeçalho de página (dentro do conteúdo, `padding: 26px 28px 80px`, `max-width: 1520px`)
- Breadcrumb: grupo / página em 12px (`--faint` / `--line` / `--muted`).
- H1: `font: 600 27px/1.2; letter-spacing: -.015em`.
- Subtítulo: `400 14px/1.55; color:--muted; max-width:70ch`.
- Dois botões à direita: secundário (`border:1px solid --line; background:--surface; color:--fg2`) e primário (`background:--primary; color:--primary-fg`), ambos `padding:10px 15px; border-radius:7px; font:500 13px; box-shadow:--shadow`.

Títulos e ações por tela:

| Rota | Grupo | Título | Ação primária | Ação secundária |
| --- | --- | --- | --- | --- |
| dashboard | Início | Visão geral | Sincronizar tudo | Últimos 30 dias |
| produtos | Catálogo | Produtos | Novo produto | Importar planilha |
| produto | Catálogo | (nome do produto) | Editar produto | Voltar à lista |
| reposicao | Planejamento | Reposição | Gerar pedido de compra | Recalcular |
| saidas | Movimentações | Saídas | Nova saída | Exportar |
| pedidos | Suprimentos | Pedidos de compra | Novo pedido | Exportar |
| fornecedores | Suprimentos | Fornecedores | Novo fornecedor | Exportar |
| mlvendas | Mercado Livre | Análise de vendas | Atualizar dados | Exportar |
| anuncios | Mercado Livre | Anúncios e vínculos | Vincular em lote | Importar anúncios |
| integracoes | Sistema | Integrações | Conectar canal | Ver logs |
| config | Sistema | Configurações | Salvar alterações | Descartar |
| usuarios | Sistema | Usuários e permissões | Convidar usuário | Exportar |

## Telas

### 1. Login (`/login`)
Duas colunas `flex: 1 1 400px`, empilham em telas estreitas.

**Painel esquerdo** — fundo fixo `#101214` (escuro nos dois temas), texto `#e6e9ec`, padding `56px 52px`, `justify-content: space-between`.
- Topo: logo 28px + "Leap Store" (600 16px).
- Meio (`max-width: 46ch`): kicker "Controle de estoque multicanal" em `IBM Plex Mono` 500 12px, `letter-spacing:.1em`, uppercase, cor `#5cc94a`. H1 `600 42px/1.15; letter-spacing:-.02em`: "Um estoque só, todos os canais em ordem." Parágrafo 15px/1.65 `#8d959d`. Três métricas em linha (gap 32px): `1.284 / SKUs ativos`, `412 / Anúncios sincronizados`, `99,4% / Acurácia de estoque` — números `600 26px IBM Plex Mono`, rótulos 13px `#6b737b`.
- Rodapé: copyright 12px `#6b737b`.

**Painel direito** — fundo `--bg`, cartão centralizado `max-width: 392px`, `background:--surface; border:1px solid --line; border-radius:10px; box-shadow:--shadow-lift; padding:34px`.
- H2 "Entrar na sua conta" (600 23px), subtítulo 14px `--muted`.
- Campos: label 500 13px `--fg2`, input `padding:11px 13px; border:1px solid --line; border-radius:7px; background:--sunken`. No campo de senha, "Esqueci a senha" alinhado à direita do label.
- Botão primário full-width, depois divisor "ou" (linha 1px + texto 12px `--faint`), depois botão Google outline com ícone 16px.
- Rodapé: "Não tem acesso? Falar com o administrador".

### 2. Visão geral (`/dashboard`)
Coluna com gap 20px.

**Linha de KPIs** — grid `repeat(auto-fit, minmax(216px, 1fr))`, gap 16px. Cada card: `background:--surface; border:1px solid --line; border-radius:10px; box-shadow:--shadow; padding:18px 20px`. Rótulo 400 13px `--muted`; valor `600 27px/1.15 IBM Plex Mono; letter-spacing:-.02em`; embaixo um chip de variação + nota 12px `--faint`.
- Pedidos Mercado Livre · 1.842 · chip verde +12,1% · "30 dias"
- Ticket médio · R$ 154,60 · chip verde +4,3% · "30 dias"
- Valor em estoque · R$ 612.300 · chip neutro "1.284 SKUs" · "custo médio"
- Rupturas previstas · 23 · chip vermelho "7 críticas" · "próximos 5 dias"

**Grid principal** — `repeat(auto-fit, minmax(330px, 1fr))`, gap 20px.

*Gráfico de receita* (ocupa `grid-column: span 2`): título 600 15px, valor `600 30px IBM Plex Mono` + chip `+18,4%`, legenda "Últimos 14 dias · comparado ao período anterior". Seletor de período à direita: pílula segmentada — track `background:--surface2; border-radius:99px; padding:3px`, opção ativa `background:--surface; box-shadow:--shadow; font-weight:500`, inativa transparente `--muted`; opções 7d/15d/30d/90d (30d ativo). Área do gráfico: altura 186px, barras flex gap 6px, `border-radius:5px 5px 2px 2px`, `--primary-line` nas barras normais e `--primary` na barra máxima; `title` de cada barra traz dia e valor (tooltip nativo).

*Reposição urgente*: header com título, "23 SKUs abaixo da cobertura mínima" e link "Ver tudo" → `/reposicao`. Lista de 5 linhas (`padding:13px 20px; border-bottom:1px solid --line2`): ponto 9px circular (`--danger` até 7 dias, `--warn` de 8 a 15), nome + "SKU · N dias de cobertura", e à direita quantidade sugerida (`600 14px mono`) sobre a palavra "sugerido" (11px `--faint`).

*Canais e integrações*: header com "Estado das conexões nas últimas 24 h". Três linhas com nome + detalhe e pílula de status (Mercado Livre Ativo, Bling ERP Ativo, Webhook de pedidos Atenção). Rodapé com botão outline full-width "Gerenciar integrações" → `/integracoes`.

### 3. Produtos (`/produtos`)
**Barra de filtros** (flex, gap 10px, wrap): campo de busca "Filtrar por nome ou SKU" (`max-width: 330px`, borda 1px, raio 7px, sombra `--shadow`); pílula segmentada Todos / Crítico / Sem fornecedor / Sem vínculo ML; e, à direita (`margin-left:auto`), botão outline "Mais filtros" com ícone filter 15px.

**Tabela** dentro de card `border-radius:10px; overflow:hidden`, envolta em `overflow-x:auto` com `min-width:940px`.
- `thead`: fundo `--sunken`, células `padding:11px 18px`, borda inferior 1px `--line`, `font:500 12px --muted`.
- Colunas: Produto, Fornecedor, Local (dir.), Full ML (dir.), Custo médio (dir.), Preço (dir.), Cobertura.
- Linhas: `padding:13px 18px`, borda inferior 1px `--line2`, `cursor:pointer`, hover `background:--sunken`, clique navega ao detalhe.
- Célula Produto: thumb 34px `border-radius:8px` com iniciais (fundo `--{tone}-soft`, texto `--{tone}`, 600 12px) + nome (450 13px) e SKU em mono 12px `--faint`.
- Números em `IBM Plex Mono`; local e preço em 500 `--fg`, full e custo em 400 `--muted`.
- Coluna Cobertura: barra de progresso (trilha `height:5px; border-radius:99px; background:--surface2`, preenchimento na cor do status) + pílula com os dias. `min-width:132px`.
- Rodapé do card: "Exibindo 8 de 1.284 produtos" + botões Anterior (desabilitado visualmente, cor `--faint`) / Próxima.

Tons por cobertura: até 7 dias `danger`, 8–15 `warn`, 16–20 `info`, acima `primary`; sem custo cadastrado usa pílula neutra.

### 4. Detalhe do produto (`/produtos/[id]`)
Abas no topo: `border-bottom:1px solid --line`, cada aba `padding:10px 14px; margin-bottom:-1px; border-bottom:2px solid` (`--primary` quando ativa, transparente quando não), texto `--fg` 500 / `--muted` 400. Abas: Visão geral, Estoque, Anúncios, Reposição, Histórico.

**Ficha do produto** (card): pares chave/valor em linhas `padding:11px 0; border-bottom:1px solid --line2` — chave 400 13px `--muted` à esquerda, valor 500 13px mono à direita. Campos: SKU, EAN, Fornecedor principal, Prazo de entrega, Custo médio, Preço de venda, Margem bruta, Média de vendas.

**Estoque por armazém** (card): subtítulo com total e disponível. Por armazém: nome (450 13px) + "Mínimo N" (12px `--faint`), quantidade à direita (`600 15px mono`), e abaixo uma barra 5px indicando ocupação vs. mínimo (vermelha abaixo do mínimo, âmbar próximo, azul para em trânsito). Rodapé com botões "Transferir" (outline) e "Ajustar estoque" (primário).

**Anúncios vinculados** (card, largura total): tabela Anúncio (título + MLB em mono) / Tipo / Preço / Estoque / Situação.

### 5. Reposição (`/reposicao`)
Quatro cards de KPI (mesma anatomia do dashboard, mas com nota descritiva em vez de chip):
- Custo total sugerido R$ 96.480 — "23 SKUs em 3 fornecedores" (valor em `--fg`)
- Críticos 7 — "ruptura em até 7 dias" (valor em `--danger`)
- Atenção 16 — "cobertura entre 7 e 15 dias" (valor em `--warn`)
- Saudáveis 1.261 — "acima de 15 dias de cobertura" (valor em `--fg`)

**Sugestão de compra** (card): header com título, explicação "Calculada sobre a média de venda dos últimos 30 dias e o prazo de cada fornecedor" e botão "Exportar CSV". Tabela `min-width:940px`: Produto (nome + SKU), Local, Full, Média/dia, Cobertura (pílula de dias), Sugerido (600 mono), Custo.

### 6. Saídas (`/saidas`)
Abas "Todas as saídas" / "Vendas Mercado Livre". Tabela `min-width:860px`: Data (mono `--muted`), Referência (código 450 13px + detalhe 12px `--faint`), Canal, Itens (dir.), Valor (dir.), Situação (pílula).

Situações e tons: Concluída/Faturada `primary`, Ajuste `warn`, Em trânsito `info`, Cancelada `danger`.

### 7. Pedidos de compra (`/gestao-pedidos`)
Abas Pendentes / Em trânsito / Concluídos. Tabela `min-width:900px`: Pedido (código mono 500), Fornecedor, Itens, Valor, Previsão (mono), Progresso.

Coluna Progresso combina barra 5px + pílula (`min-width:170px`), com etapas: Aguardando envio 20% `warn`, Confirmado 40% `info`, Em trânsito 70% `info`, Recebido parcial 85% `warn`, Recebido 100% `primary`.

### 8. Fornecedores (`/fornecedores`)
Grade de cards `repeat(auto-fit, minmax(300px, 1fr))`, gap 16px. Cada card `padding:20px`:
- Topo: thumb 34px com iniciais, nome (500 15px), CNPJ (mono 12px `--faint`), pílula neutra com o prazo ("21 dias") à direita.
- Divisória 1px `--line2` e três métricas em linha (gap 24px): Produtos, Compras 90 d, Pontualidade — números `600 17px mono`, rótulos 12px `--faint`.
- Rodapé: e-mail de contato 13px `--muted`, truncado com ellipsis.

### 9. Vendas Mercado Livre (`/mercado-livre/vendas`)
Quatro KPIs com chip de variação (Receita, Pedidos, Unidades, Ticket médio — este último com chip `danger` para −1,2%), nota "vs. 30 d anteriores".

**Gráfico de receita por dia**: mesma anatomia do dashboard, altura 210px, legenda "Conta leapstore.oficial · líquido de tarifas do Mercado Livre".

**Mais vendidos** (tabela `min-width:760px`): Anúncio (título + MLB mono), Unid., Pedidos, Ticket, Receita. A coluna Receita combina barra 5px proporcional (`--primary`) + valor em mono, `min-width:180px`.

### 10. Anúncios e vínculos (`/mercado-livre/produtos`)
Três KPIs: Anúncios ativos 412 (`--fg`, "sincronizados hoje às 14:02"), Sem SKU vinculado 6 (`--danger`, "estoque não é atualizado"), Divergência de estoque 11 (`--warn`, "anúncio e estoque local diferem").

Tabela `min-width:940px`: Anúncio (título + MLB), SKU vinculado (mono, "—" quando vazio), Tipo (Full/Local), Preço, Estoque, Vínculo (pílula: Vinculado `primary`, Divergente `warn`, Sem vínculo `danger`) e uma coluna de ação alinhada à direita, sem rótulo no header:
- Sem vínculo → botão primário "Vincular SKU"
- Divergente → botão outline com texto `--warn` "Revisar"
- Vinculado → botão outline "Abrir"

Botões de linha: `padding:7px 12px; border-radius:7px; font:500 12.5px`.

### 11. Integrações (`/configuracoes`)
Dois cards lado a lado (`minmax(320px, 1fr)`):

*Mercado Livre* — ícone em caixa 38px `border-radius:7px; border:1px solid --line; background:--sunken` contendo `ML.png` 26px. Nome (600 16px) + conta "leapstore.oficial" (12px `--faint`), pílula "Conectado" `primary`. Pares chave/valor: Anúncios sincronizados 412, Última sincronização, Token expira em, Webhook de pedidos, Modo de estoque (Local + Full).

*Bling ERP* — mesma caixa 38px com iniciais "BL" (`--info-soft` / `--info`). Conta "Leap Store Comércio LTDA". Pares: Produtos espelhados 1.284, Última sincronização, Notas emitidas (30 d), Fila de erros, Depósito padrão.

Rodapé de cada card: "Sincronizar agora" (primário), "Configurar" (outline) e, empurrado para a direita, "Desconectar" (outline com texto `--danger`, hover `background:--danger-soft`).

**Histórico de sincronização** (tabela `min-width:720px`): Quando (mono), Origem, Escopo, Registros (dir.), Resultado (pílula — Sucesso `primary`, N falhas `warn`, Timeout `danger`).

### 12. Configurações (`/configuracoes-gerais`)
Três cards `minmax(320px, 1fr)`, cada um com título 600 15px, descrição 13px `--muted` e campos empilhados (gap 18px): label 500 13px `--fg2`, input `padding:10px 13px; border-radius:7px; background:--sunken`, e hint 12px `--faint` abaixo.
- **Empresa** (Razão social, CNPJ, Fuso horário)
- **Estoque** (Método de custo, Cobertura mínima, Cobertura crítica)
- **Notificações** (Alerta de ruptura, Falha de sincronização, Resumo semanal)

Nos protótipos os inputs estão `readonly`; na implementação são campos editáveis com salvamento pela ação primária do header.

### 13. Usuários e permissões
Tabela `min-width:820px`: Usuário (avatar 34px com iniciais + nome/e-mail), Papel (pílula — Administrador em `primary`, demais neutras), Acesso a (texto descritivo do escopo), Último acesso (mono), Situação (Ativo `primary`, Convite pendente `warn`).

Inclui um acesso externo somente leitura (contabilidade) para demonstrar o caso de cliente/parceiro externo.

## Interações e comportamento
- **Navegação**: sidebar e links internos trocam a rota; toda navegação faz `window.scrollTo(0, 0)`. No app real, usar `next/link` e `usePathname()` para o estado ativo.
- **Abas**: estado local por tela (produto, saídas, pedidos). Nos protótipos só a aba ativa muda de estilo; na implementação cada aba filtra ou troca o conteúdo.
- **Tema**: alternado por `data-theme="dark"` no `<html>`. O app já tem alternância de tema — mantenha o mecanismo existente e apenas substitua os tokens. Persista a escolha.
- **Hover**: linhas de tabela ganham `--sunken`; botões outline ganham `--surface2`; primários escurecem para `--primary-hi`; itens de navegação inativos ganham `--surface2`.
- **Foco**: `:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px }` global — nunca o anel azul padrão.
- **Barras do gráfico**: `title` com dia e valor. Substitua por tooltip próprio se o codebase já tiver um.
- **Estados de carregamento e vazio**: não desenhados nestes protótipos. Recomendação: skeletons com `--surface2` na mesma geometria das linhas/cards, e estado vazio com título 15px, texto 13px `--muted` e a ação primária da tela.
- **Responsivo**: todos os grids usam `auto-fit` + `minmax`, então reflowam sozinhos. Tabelas rolam horizontalmente com `min-width` fixo. **A sidebar não tem versão mobile nos protótipos** — no app, abaixo de ~1024px ela deve virar drawer sobreposto, acionado por um botão de menu na topbar.
- **Acessibilidade**: os botões só de ícone (tema, notificações, sair) precisam de `aria-label`; as pílulas de status não devem depender só de cor — o texto já carrega o significado, mantenha-o.

## Estado necessário
- `route` / rota atual (vem do router no app real)
- `theme`: `"light" | "dark"`, persistido
- Aba ativa por tela: `prodTab`, `saidaTab`, `pedidoTab`
- Período do gráfico: `7d | 15d | 30d | 90d` (default 30d)
- Filtro ativo da lista de produtos + termo de busca
- Dados: produtos, reposição calculada, saídas, pedidos, fornecedores, métricas ML, anúncios/vínculos, status e log de integrações, configurações, usuários

## Design tokens

### Cores — tema claro
```
--bg            #f6f7f8
--surface       #ffffff
--surface2      #f1f3f4
--sunken        #fafbfb
--fg            #1b1f23
--fg2           #3d454c
--muted         #6d767e
--faint         #98a1a9
--line          #e4e7ea
--line2         #eef0f2
--primary       #22701f
--primary-fg    #ffffff
--primary-hi    #1a5a18
--primary-soft  #eaf3e8
--primary-line  #cfe3cc
--danger        #b8342a
--danger-soft   #fbeceb
--warn          #8a5a10
--warn-soft     #fbf1e2
--info          #1f6a9e
--info-soft     #e9f2f8
```

### Cores — tema escuro (`[data-theme="dark"]`)
```
--bg            #101214
--surface       #191c1f
--surface2      #22262a
--sunken        #15181a
--fg            #e6e9ec
--fg2           #c3cad0
--muted         #8d959d
--faint         #6b737b
--line          #282d32
--line2         #22262a
--primary       #5cc94a
--primary-fg    #0b1a08
--primary-hi    #74d962
--primary-soft  #18240f
--primary-line  #2c3f1f
--danger        #f08b80
--danger-soft   #2b1917
--warn          #e5b055
--warn-soft     #2a2113
--info          #71b8e6
--info-soft     #132630
```

### Sombras
```
--shadow       0 1px 2px rgba(20,26,32,.05), 0 1px 3px rgba(20,26,32,.04)
--shadow-lift  0 1px 2px rgba(20,26,32,.06), 0 8px 24px -8px rgba(20,26,32,.14)
/* escuro */
--shadow       0 1px 2px rgba(0,0,0,.4)
--shadow-lift  0 1px 2px rgba(0,0,0,.4), 0 10px 30px -10px rgba(0,0,0,.6)
```

### Raios
```
--r   10px   /* cards, seções */
--rs  7px    /* botões, inputs, thumbs pequenos */
8px          /* itens de navegação, thumbs de 34px */
5px          /* topo das barras do gráfico */
99px         /* pílulas, chips, avatares, barras de progresso, campo de busca */
```

### Tipografia
`IBM Plex Sans` (400, 450, 500, 600) para texto; `IBM Plex Mono` (400, 500, 600) **exclusivamente** para números, SKUs, códigos MLB, CNPJ, datas e horários — é o que dá firmeza à leitura de dados. Google Fonts.

```
H1 de página        600 27px/1.2, letter-spacing -.015em
H1 do login         600 42px/1.15, letter-spacing -.02em
Título de seção     600 15px/1.3
Título de card      600 16px/1.3   (integrações)
Valor de KPI        600 27px/1.15 mono, letter-spacing -.02em
Valor destacado     600 30px mono  (receita do dashboard)
Número em card      600 17px mono  (fornecedores)
Corpo               400 14px/1.55
Texto de tabela     450 13px/1.35  (primário) · 400 13px (secundário)
Número de tabela    500 13px mono (destaque) · 400 13px mono (apoio)
Label de campo      500 13px/1.2
Nav                 400/500 13.5px/1.35
Legenda / hint      400 12px/1.3–1.45
Rótulo de grupo     500 11px, letter-spacing .08em, uppercase
```

### Espaçamento
Gap entre seções 20px; entre cards de KPI 16px; padding de card 18–20px; células de tabela `13px 18px` (`11px 18px` no header); padding do conteúdo `26px 28px 80px`; `max-width` do conteúdo 1520px.

### Padrões reutilizáveis
- **Pílula de status**: `inline-flex; gap:5px; padding:4px 10px; border-radius:99px; background:--{tone}-soft; color:--{tone}; font:500 12px`. Variante neutra usa `--surface2` / `--muted`.
- **Chip de variação**: `padding:3px 9px; border-radius:99px`, mesmo esquema de tons.
- **Controle segmentado**: track `--surface2`, `border-radius:99px`, `padding:3px`; opção ativa `background:--surface; box-shadow:--shadow; font-weight:500`.
- **Barra de progresso**: trilha `height:5px; border-radius:99px; background:--surface2`; preenchimento na cor do status, `border-radius:99px`.
- **Thumb de iniciais**: 34px, `border-radius:8px`, `background:--{tone}-soft`, `color:--{tone}`, `font:600 12px`. Avatares de pessoa usam `border-radius:99px`.

## Assets
- `brand/leap-mark.svg` — marca (cubo isométrico) vinda de `public/brand/leap-mark.svg` do próprio repositório. Usada na sidebar (26px) e no login (28px).
- `brand/ML.png` — logo do Mercado Livre, de `public/ML.png` do repositório. Usada no card de integração (26px).
- Ícones: SVGs inline nos protótipos (stroke 1.7–2, `currentColor`), equivalentes a Lucide — `layout-dashboard`, `package`, `trending-up`, `upload`, `clipboard-list`, `truck`, `bar-chart-3`, `link-2`, `zap`, `settings`, `users`, `lock`, `search`, `filter`, `bell`, `sun`, `moon`, `log-out`, `chevrons-up-down`. **Use `lucide-react`**, já presente no projeto.
- Imagens de produto: não há nos protótipos — os thumbs são iniciais coloridas. Se houver imagens reais no cadastro, mantenha o mesmo box 34px com `object-fit: cover` e as iniciais como fallback.

## Arquivos deste pacote
- `Leap Store v2.dc.html` — **o design a implementar**. 13 telas, temas claro e escuro. Navegue pela sidebar.
- `Leap Store v1 (anterior).dc.html` — primeira iteração (visual mais duro, réguas de 2px, sem raios). Histórico apenas.
- `support.js` — runtime necessário para abrir os arquivos `.dc.html` no navegador. Não é código de produção.
- `brand/leap-mark.svg`, `brand/ML.png` — assets usados nas telas.

## Mapa para o codebase
| Tela | Arquivos a alterar em `estoque-api` |
| --- | --- |
| Shell (sidebar, topbar) | `src/app/components/layout/Sidebar.tsx`, `src/app/DashboardWrapper.tsx`, `styles/global.css` |
| Visão geral | `src/app/(root)/dashboard/page.tsx`, `src/app/components/dashboard/` |
| Produtos | `src/app/(root)/produtos/page.tsx`, `produtos/components/ProdutoTableRow.tsx` |
| Detalhe do produto | `src/app/(root)/produtos/[id]/page.tsx` |
| Reposição | `src/app/(root)/reposicao/page.tsx` |
| Saídas | `src/app/(root)/saidas/page.tsx` |
| Pedidos de compra | `src/app/(root)/gestao-pedidos/page.tsx` |
| Fornecedores | `src/app/(root)/fornecedores/page.tsx` |
| Vendas Mercado Livre | `src/app/(root)/mercado-livre/vendas/page.tsx` |
| Anúncios e vínculos | `src/app/(root)/mercado-livre/produtos/page.tsx`, `produtos/vincular/page.tsx` |
| Integrações | `src/app/(root)/configuracoes/page.tsx` |
| Configurações | `src/app/(root)/configuracoes-gerais/page.tsx` |
| Login | `src/app/(auth)/` |

Sugestão de ordem de implementação: tokens em `global.css` → shell (sidebar + topbar) → um componente de tabela e um de card reutilizáveis → telas, na ordem do mapa acima.
