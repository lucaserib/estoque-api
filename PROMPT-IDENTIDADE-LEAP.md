# Leap Store — Refatoração de Identidade Visual e Interface

Documento autocontido de execução. Objetivo: substituir a aparência genérica de template por uma identidade própria derivada do logo da Leap Store (cubo isométrico metálico com verde vibrante), tornando a interface mais limpa, hierárquica e fácil de usar.

**Regra inegociável: não quebrar nada que funciona.** Esta refatoração é de camada visual e de composição de tela. Não altere rotas de API, contratos de dados, cálculos, queries Prisma, lógica de sincronização ML/Bling nem nomes de campos. Se um ajuste visual exigir mudar dados, pare e reporte em vez de mudar.

Execute as fases na ordem. Ao final de cada fase: `npx tsc --noEmit` e `npx next lint` sem erros, e um commit descritivo em português.

## Diretrizes de código
1. Sem comentários em código; nomes explicam a intenção. Remova comentários dos arquivos que editar.
2. TypeScript estrito, sem `any` novos, retornos explícitos.
3. Cor apenas via token semântico. Proibido `bg-white`, `bg-gray-*`, `bg-emerald-*`, hex hardcoded em componente e emoji em texto de interface.
4. Componentes de UI vivem em `src/components/ui`; primitivos de marca em `src/components/brand`.
5. Skeleton em carregamento, empty state com ação, erro com mensagem humana.

---

## Diagnóstico do estado atual (o que faz parecer genérico)

Verificado nas telas Dashboard, Análise de Vendas, Produtos e Reposição:

1. **Paleta é o default do shadcn** (slate + emerald `#059669`). É a combinação mais comum em projetos gerados por IA e não tem relação com a marca.
2. **Excesso de KPI cards idênticos**: Análise de Vendas tem 8 cards no mesmo formato em duas fileiras de 4; Dashboard tem 4. Todos com label pequeno, número grande, delta e um ícone decorativo no canto. Nada indica o que é mais importante.
3. **Ausência de hierarquia**: todo bloco é um `Card` com a mesma borda, mesmo radius e mesmo peso. O número mais relevante da tela compete visualmente com o menos relevante.
4. **Ícones decorativos**: o ícone no canto de cada KPI não informa nada e polui.
5. **Tipografia sem contraste**: Sora aparece só em títulos pequenos; números grandes não têm presença própria.
6. **Reposição usa cards pastel** (verde/vermelho/amarelo/roxo) — visual de template, e o roxo não significa nada no domínio.
7. **Sidebar sem identidade**: lista de links cinza, sem marca, sem agrupamento visual forte.
8. **Nada da marca aparece**: não há traço do cubo, do verde vibrante nem do caráter industrial do logo.

---

## FASE 1 — Fundação da identidade

### 1.1 Paleta derivada do logo

O logo combina verde vibrante, grafite metálico, metal claro e vidro azulado. A interface passa a ser **dark-first** (é onde o metálico do logo se sustenta), mantendo o tema claro funcional.

Substituir os blocos de token em `styles/global.css`:

```css
:root {
  --background: 210 20% 97%;
  --foreground: 210 15% 12%;
  --card: 0 0% 100%;
  --card-foreground: 210 15% 12%;
  --popover: 0 0% 100%;
  --popover-foreground: 210 15% 12%;
  --border: 210 16% 88%;
  --input: 210 16% 88%;
  --primary: 100 80% 33%;
  --primary-foreground: 0 0% 100%;
  --secondary: 210 20% 94%;
  --secondary-foreground: 210 15% 12%;
  --muted: 210 20% 94%;
  --muted-foreground: 210 8% 45%;
  --accent: 100 60% 94%;
  --accent-foreground: 103 80% 22%;
  --success: 100 80% 33%;
  --success-foreground: 0 0% 100%;
  --warning: 35 92% 42%;
  --warning-foreground: 0 0% 100%;
  --destructive: 4 74% 48%;
  --destructive-foreground: 0 0% 100%;
  --info: 205 70% 42%;
  --info-foreground: 0 0% 100%;
  --ring: 100 80% 33%;
  --radius: 0.375rem;
  --chart-1: 100 77% 40%;
  --chart-2: 205 60% 50%;
  --chart-3: 35 92% 50%;
  --chart-4: 210 10% 55%;
  --chart-5: 103 80% 27%;
}

.dark {
  --background: 210 9% 8%;
  --foreground: 210 14% 88%;
  --card: 210 9% 12%;
  --card-foreground: 210 14% 88%;
  --popover: 210 9% 12%;
  --popover-foreground: 210 14% 88%;
  --border: 210 8% 19%;
  --input: 210 8% 19%;
  --primary: 100 77% 47%;
  --primary-foreground: 103 90% 8%;
  --secondary: 210 8% 16%;
  --secondary-foreground: 210 14% 88%;
  --muted: 210 8% 16%;
  --muted-foreground: 210 8% 57%;
  --accent: 210 8% 20%;
  --accent-foreground: 100 77% 47%;
  --success: 100 77% 47%;
  --success-foreground: 103 90% 8%;
  --warning: 38 95% 58%;
  --warning-foreground: 30 85% 10%;
  --destructive: 4 85% 65%;
  --destructive-foreground: 0 60% 12%;
  --info: 200 75% 60%;
  --info-foreground: 205 60% 10%;
  --ring: 100 77% 47%;
  --chart-1: 100 77% 47%;
  --chart-2: 200 65% 58%;
  --chart-3: 38 95% 58%;
  --chart-4: 210 10% 60%;
  --chart-5: 103 60% 33%;
}
```

Regra de uso da cor, para o verde não virar ruído: **o verde é acento, não preenchimento**. Aplicar em ação primária, item ativo da navegação, série principal de gráfico e indicador positivo. Nunca em fundo de card inteiro.

Adicionar dois tokens de marca para as superfícies metálicas:

```css
:root {
  --metal-edge: 210 16% 82%;
  --metal-sheen: linear-gradient(160deg, hsl(210 20% 99%), hsl(210 16% 94%));
}
.dark {
  --metal-edge: 210 8% 24%;
  --metal-sheen: linear-gradient(160deg, hsl(210 9% 14%), hsl(210 9% 10%));
}
```

Mapear `metal-edge` no `tailwind.config.ts` como `borderColor.metal` e criar a utilitária `.surface-metal` (aplica `--metal-sheen` como `background-image`) para uso apenas em cabeçalhos de seção e no bloco de destaque.

### 1.2 Tipografia

O lettering do logo é condensado, caixa alta e com tracking largo. Introduzir esse contraste:

- **Display** (`--font-display`): `Barlow_Condensed` via `next/font/google`, pesos 600 e 700. Uso: logo, título de página, número-herói e rótulos de seção em caixa alta.
- **Interface** (`--font-sans`): manter `Inter` 400/500/600.
- Remover `Sora` do projeto (substituído por Barlow Condensed).
- Números de tabela e KPI continuam em Inter com `tabular-nums`; apenas o número-herói usa Display.

Classes utilitárias a criar:
- `.text-display` → família display, `tracking-tight`, `font-semibold`
- `.text-eyebrow` → 11px, uppercase, `tracking-[0.14em]`, `text-muted-foreground`, `font-medium`

### 1.3 Logo e marca

1. Salvar o arquivo enviado pelo dono em `public/brand/leap-logo.png` e criar `public/brand/leap-mark.svg` com uma reconstrução vetorial simplificada do cubo isométrico: três faces (topo em `--primary`, lateral esquerda em tom escuro do verde, lateral direita em cinza-metal), traçadas com `currentColor` onde possível para herdar tema.
2. `src/components/brand/Logo.tsx` com props `variant: "full" | "mark"` e `size`. Versão `full`: marca + wordmark "LEAP STORE" em Display 700, caixa alta, `tracking-[0.18em]`. Versão `mark`: apenas o cubo (favicon, sidebar recolhida, avatar).
3. Renomear o produto de "Estoca" para **"Leap Store"** em: `layout.tsx` (title, description, openGraph), sidebar, telas de login e registro, rodapé, e-mails. Gerar `favicon.ico` e `apple-icon.png` a partir do cubo.
4. Rodapé: `Leap Store © {ano}` — ano dinâmico.

### Aceite da Fase 1
`grep -rn "Estoca" src` retorna vazio; nenhuma referência a Sora; tema claro e escuro íntegros em todas as telas; logo aparece na sidebar e no login.

---

## FASE 2 — Sistema de composição (matar o "muro de cards")

Criar em `src/components/ui` e usar em todas as telas:

### 2.1 `PageHeader`
Título em Display, caixa alta, com um filete vertical de 3px em `--primary` à esquerda (eco da aresta do cubo). Subtítulo em `muted-foreground`. Ações à direita. Substitui os títulos soltos de hoje.

### 2.2 `HeroMetric`
Bloco de destaque para **um único número por tela**, sem card ao redor: rótulo em `.text-eyebrow`, valor em Display 700 tamanho 44–56px, delta ao lado com seta e cor semântica, e uma linha de contexto em `muted-foreground`. Fundo `surface-metal` sutil e borda apenas inferior.

### 2.3 `StatStrip`
Faixa horizontal para métricas secundárias: itens separados por divisores verticais de 1px, **sem borda de card, sem fundo, sem ícone**. Cada item: rótulo `.text-eyebrow` + valor `tabular-nums` 20px + delta opcional. Em telas estreitas vira grade de 2 colunas.

Esta é a peça que remove a aparência genérica: métricas de apoio deixam de ser oito caixas iguais.

### 2.4 `SectionCard`
Card usado **apenas** para agrupar conteúdo real (gráfico, tabela, lista). Cabeçalho com `.text-eyebrow`, sem ícone decorativo, borda `metal`, radius 6px, sem sombra no tema escuro.

### 2.5 `DataTable`
Padronizar tabelas: cabeçalho `.text-eyebrow`, linhas de 44px, divisores em `--border`, números à direita com `tabular-nums`, hover sutil em `--accent`, primeira coluna com peso 500. Sem zebra.

### 2.6 `StatusPill`
Um único componente para status (Crítico, Atenção, Saudável, Pago, Pausado): texto 12px, peso 600, fundo `color-mix` a 12% da cor semântica, sem borda. Substitui todas as variações atuais.

### Aceite da Fase 2
Componentes criados, tipados e usados; nenhuma tela usa `Card` para exibir um número isolado.

---

## FASE 3 — Recomposição das telas

Sem alterar dados nem chamadas de API — apenas a organização visual.

### 3.1 Dashboard (`/dashboard`)
- `PageHeader` "VISÃO GERAL" + nome da conta.
- `HeroMetric`: **Receita ML no período** (é o número que o seller quer ver primeiro), com delta vs período anterior.
- `StatStrip` com: Vendas hoje · Itens vendidos · SKUs a repor · Valor do estoque local. Os quatro cards atuais somem.
- `SectionCard` com o gráfico de evolução, ocupando largura maior.
- `SectionCard` "REPOSIÇÃO URGENTE" com lista compacta (SKU, dias restantes, quantidade sugerida) e link "ver todos".

### 3.2 Análise de Vendas (`/mercado-livre/vendas`)
Hoje são 8 cards iguais. Passa a ser:
- `HeroMetric`: Receita total do período.
- `StatStrip` primária: Receita líquida · Itens · Pedidos · Ticket médio.
- `StatStrip` secundária, menor e discreta: Projeção do mês · Taxa de cancelamento · SKUs sem venda.
- `SectionCard` do gráfico com as abas Receita/Itens/Pedidos no cabeçalho.
- `SectionCard` "TOP PRODUTOS" com barras horizontais (nome, valor, participação) — manter comportamento atual.
- Barra de filtros compacta alinhada ao `PageHeader`.

### 3.3 Reposição (`/reposicao`)
- Remover os quatro cards pastel.
- `HeroMetric`: Custo total para reposição completa.
- `StatStrip`: Produtos em alerta · Críticos · Atenção.
- Tabela com `DataTable` e `StatusPill`; coluna de status como faixa de 3px na borda esquerda da linha, em vez de fundo colorido na linha inteira.

### 3.4 Produtos (`/produtos`)
- `PageHeader` "PRODUTOS" com ações à direita.
- Barra de filtros: busca, fornecedor, situação de estoque, vínculo ML.
- `DataTable` com miniatura 40×40 (fallback: cubo da marca em `muted`), nome + SKU em duas linhas na mesma célula, fornecedor e prazo, estoque, Full, vendas, custo e ações.
- Contadores de Produtos/Kits viram abas de texto, não cards.

### 3.5 Navegação
- Sidebar com fundo `--card` e borda direita `metal`; logo `full` no topo, `mark` quando recolhida.
- Item ativo: fundo `--accent`, texto `--primary` e barra de 3px em `--primary` à esquerda.
- Seções em `.text-eyebrow` ("PRINCIPAL", "CANAIS").
- Header: 56px, busca com placeholder em português, sino de notificações, seletor de conta, tema e configurações.

### Aceite da Fase 3
Cada tela tem exatamente um `HeroMetric`; nenhuma tela exibe mais de 4 métricas em cards; comportamento, filtros, ordenações e dados idênticos aos de antes.

---

## FASE 4 — Acabamento

1. **Gráficos**: série principal em `--chart-1`, área com `fillOpacity` 0.10, grade horizontal tracejada em `--border`, sem eixo desenhado, tooltip com fundo `--popover` e borda `metal`. Remover legenda quando houver uma série só.
2. **Densidade**: espaçamento vertical de 32px entre seções e 16px dentro de blocos; container `max-w-[1400px]`.
3. **Skeletons** no formato do conteúdo final (linhas de tabela, faixa de stats, bloco de gráfico) — não retângulos genéricos.
4. **Estados vazios** com o cubo da marca em `muted`, uma frase objetiva e um botão de ação.
5. **Foco visível** com `ring` em `--primary` em todos os interativos; contraste mínimo AA verificado nos dois temas.
6. **Responsivo**: validar 375px, 768px e 1440px; `StatStrip` colapsa para 2 colunas; tabelas com rolagem horizontal e primeira coluna fixa.
7. **Movimento discreto**: transições de 150–200ms em hover e troca de tema; sem animação de entrada em números.

### Aceite da Fase 4
Lighthouse ≥ 90 em performance e acessibilidade nas rotas principais; nenhuma regressão funcional; visual consistente entre todas as telas nos dois temas.

---

## Verificação final
1. Todas as telas testadas logado com conta real: dados idênticos aos de antes da refatoração.
2. Integrações ML e Bling inalteradas e funcionando.
3. `grep -rn "bg-white\|bg-gray-\|bg-emerald-\|#0" src --include=*.tsx` sem resultados de cor hardcoded.
4. Tema claro e escuro sem áreas órfãs.
5. `npx tsc --noEmit` e `npx next lint` limpos.
