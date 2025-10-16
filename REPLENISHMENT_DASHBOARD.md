# 📊 Dashboard de Reposição de Estoque

## Visão Geral

Tela dedicada para visualizar e gerenciar todos os produtos que precisam de reposição de estoque, com análise automatizada baseada em vendas, estoques e configurações personalizadas.

---

## ✨ Funcionalidades

### 1. **Análise em Lote**
- Analisa todos os produtos do sistema de uma vez
- Retorna apenas produtos com status **Crítico** ou **Atenção**
- Ordena automaticamente por prioridade (crítico → atenção → dias restantes)

### 2. **Cards de Resumo**
- **Produtos Alerta**: Total de produtos que precisam de atenção
- **Críticos**: Produtos em situação crítica + custo total
- **Atenção**: Produtos em atenção + custo total
- **Custo Total**: Investimento necessário para reposição completa

### 3. **Tabela Detalhada**
Colunas:
- **Status**: Badge visual (Crítico/Atenção/OK)
- **Produto**: Nome e SKU
- **Tipo**: Full, Local ou Full + Local
- **Estoque Local**: Quantidade disponível
- **Estoque Full**: Quantidade no Mercado Envios Full
- **Dias Restantes**: Menor valor entre Full e Local
- **Média/Dia**: Vendas médias diárias
- **Repor Full**: Quantidade a transferir + custo
- **Comprar**: Quantidade a comprar + custo
- **Custo Total**: Valor total da reposição
- **Ações**: Botão "Detalhes" para abrir modal completo

### 4. **Cálculo de Custos**
- Usa `custoMedio` do produto (sincronizado do Bling)
- Calcula custo por tipo de ação:
  - **Transferência Full**: quantidade × custoMedio
  - **Compra Local**: quantidade × custoMedio
  - **Custo Total**: soma de ambos

### 5. **Integração com Modal de Reposição**
- Ao clicar em "Detalhes", abre o modal completo
- Modal permite ajustar configurações específicas do produto
- Configurações salvas são usadas na próxima análise

---

## 🏗️ Arquitetura

### Componentes Criados

#### 1. **Página Principal**
**Arquivo**: `/src/app/(root)/reposicao/page.tsx`

```typescript
// Funcionalidades:
- Busca dados via useFetch('/api/replenishment/batch-analysis')
- Botão "Verificar Estoque" para refetch manual
- Exibe cards de resumo
- Renderiza tabela com ReplenishmentTableRow
- Integra com ReposicaoModal para detalhes
```

#### 2. **Cards de Resumo**
**Arquivo**: `/src/app/(root)/reposicao/components/ReplenishmentSummaryCards.tsx`

```typescript
interface Props {
  summary: {
    total: number;
    critico: number;
    atencao: number;
    ok: number;
    custoTotalCritico: number;
    custoTotalAtencao: number;
    custoTotalGeral: number;
  };
}

// 4 cards:
// 1. Produtos Alerta (cinza)
// 2. Críticos (vermelho) + custo
// 3. Atenção (amarelo) + custo
// 4. Custo Total (roxo)
```

#### 3. **Linha da Tabela**
**Arquivo**: `/src/app/(root)/reposicao/components/ReplenishmentTableRow.tsx`

```typescript
// Componente memoizado para performance
// Props: item (dados do produto), onViewDetails (callback)
// Features:
- Badges de status coloridos
- Formatação de moeda brasileira
- Ícones visuais (Truck, ShoppingCart, TrendingUp)
- Cores condicionais baseadas em status
```

---

## 🔌 API

### Endpoint: `GET /api/replenishment/batch-analysis`

**Arquivo**: `/src/app/api/replenishment/batch-analysis/route.ts`

#### Fluxo de Processamento:

1. **Busca produtos**
   ```typescript
   const produtos = await prisma.produto.findMany({
     where: { userId, isKit: false },
     include: { estoques, ProdutoMercadoLivre }
   });
   ```

2. **Para cada produto:**
   - Busca configuração de reposição (ou usa padrão)
   - Calcula estoques (local + Full em tempo real)
   - Calcula vendas do período configurado
   - Calcula média diária
   - Executa lógica de reposição Full
   - Executa lógica de reposição Local
   - Calcula custos totais
   - Adiciona ao resultado se status ≠ "ok"

3. **Ordena resultados:**
   ```typescript
   // Ordem: crítico > atenção > ok
   // Dentro do mesmo status: menor dias restantes primeiro
   ```

4. **Retorna:**
   ```typescript
   {
     success: true,
     results: BatchAnalysisResult[],
     summary: {
       total, critico, atencao, ok,
       custoTotalCritico, custoTotalAtencao, custoTotalGeral
     }
   }
   ```

#### Estrutura de Resposta:

```typescript
interface BatchAnalysisResult {
  produtoId: string;
  produtoNome: string;
  sku: string;
  custoMedio: number; // em centavos
  tipoAnuncio: "full" | "local" | "ambos";
  estoqueLocal: number;
  estoqueFull: number;
  estoqueTotal: number;
  mediaVendasPeriodo: number;
  mediaDiaria: number;
  analysisPeriodDays: number; // 30, 60 ou 90
  statusGeral: "ok" | "atencao" | "critico";

  reposicaoFull: {
    necessaria: boolean;
    quantidadeSugerida: number;
    diasRestantes: number;
    status: "ok" | "atencao" | "critico";
    custoTotal: number; // R$ já calculado
  } | null;

  reposicaoLocal: {
    necessaria: boolean;
    quantidadeSugerida: number;
    diasRestantes: number;
    status: "ok" | "atencao" | "critico";
    custoTotal: number; // R$ já calculado
  };

  custoTotalReposicao: number; // R$ (Full + Local)
}
```

---

## 🎨 UI/UX Design Patterns

### Cores e Estados

#### Status Badges:
- **Crítico**: Vermelho (`bg-red-500`, `text-white`)
- **Atenção**: Amarelo (`bg-yellow-500`, `text-white`)
- **OK**: Verde (`border-green-600`, `text-green-600`)

#### Tipo de Anúncio:
- **Full**: Azul (`border-blue-600`, `text-blue-600`)
- **Local**: Cinza (`border-gray-600`, `text-gray-600`)
- **Full + Local**: Roxo (`border-purple-600`, `text-purple-600`)

#### Background da Linha:
```typescript
// Crítico: bg-red-50 dark:bg-red-950/20
// Atenção: bg-yellow-50 dark:bg-yellow-950/20
// OK: Sem background especial
```

### Formatação de Valores

#### Moeda:
```typescript
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100); // Converte centavos para reais
};
```

#### Dias Restantes:
```typescript
diasRestantes > 999 ? "∞" : `${diasRestantes}d`
```

### Ícones Utilizados:
- `AlertCircle`: Status crítico
- `AlertTriangle`: Status atenção
- `CheckCircle`: Status OK
- `Truck`: Reposição Full (transferência)
- `ShoppingCart`: Compra Local
- `TrendingUp`: Média de vendas
- `TrendingDown`: Produtos em alerta
- `DollarSign`: Custo total
- `Package`: Produtos
- `RefreshCw`: Atualizar análise
- `Search`: Verificar estoque

---

## 🔄 Fluxo Completo do Usuário

### 1. Acesso à Tela
```
Sidebar → Reposição → Carrega análise automática
```

### 2. Visualização Inicial
- Cards mostram resumo geral
- Tabela lista produtos com alerta
- Se nenhum produto: mensagem de sucesso

### 3. Atualização Manual
```
Clica "Verificar Estoque" →
  Faz GET /api/replenishment/batch-analysis →
  Atualiza UI com novos dados →
  Toast de confirmação
```

### 4. Ver Detalhes de um Produto
```
Clica "Detalhes" na linha →
  Abre ReposicaoModal com produtoId →
  Modal busca configurações específicas →
  Usuário pode ajustar parâmetros →
  Salva configuração →
  Fecha modal
```

### 5. Próxima Análise
```
Nova análise usa configurações atualizadas →
Cálculos refletem parâmetros personalizados
```

---

## 📊 Lógica de Negócio

### Critérios para Aparecer na Lista:

Um produto aparece na tela de reposição se:

```typescript
statusGeral === "critico" || statusGeral === "atencao"
```

**Status é determinado por:**

1. **Reposição Full (se aplicável):**
   ```typescript
   diasRestantesFull = estoqueFull / mediaDiaria

   if (diasRestantesFull <= fullReleaseDays * 0.3) → "critico"
   if (diasRestantesFull <= fullReleaseDays * 0.6) → "atencao"
   else → "ok"
   ```

2. **Reposição Local:**
   ```typescript
   diasRestantesLocal = estoqueLocal / mediaDiaria

   if (diasRestantesLocal <= avgDeliveryDays * 0.3) → "critico"
   if (diasRestantesLocal <= avgDeliveryDays * 0.6) → "atencao"
   else → "ok"
   ```

3. **Status Geral:**
   - Pior status entre Full e Local
   - Crítico > Atenção > OK

### Cálculo de Custos:

```typescript
// Custo da Transferência Full
custoFull = quantidadeSugeridaFull * (custoMedio / 100)

// Custo da Compra Local
custoLocal = quantidadeSugeridaLocal * (custoMedio / 100)

// Custo Total
custoTotal = custoFull + custoLocal
```

**Nota**: `custoMedio` está em centavos no banco, por isso divide por 100.

---

## 🔐 Segurança e Validações

### Autenticação:
```typescript
const user = await verifyUser(request);
// Garante que usuário está autenticado
```

### Isolamento de Dados:
```typescript
const produtos = await prisma.produto.findMany({
  where: { userId: user.id }, // Apenas produtos do usuário
});
```

### Tratamento de Erros:
```typescript
// Por produto: captura erro, loga e continua
try {
  // Processamento do produto
} catch (productError) {
  console.error(`Erro ao processar ${sku}:`, productError);
  // Não falha toda análise
}

// Geral: retorna 500 com mensagem
catch (error) {
  return NextResponse.json(
    { error: error.message },
    { status: 500 }
  );
}
```

---

## ⚡ Performance

### Otimizações Implementadas:

1. **Memoização de Componentes:**
   ```typescript
   export const ReplenishmentTableRow = memo<Props>(
     ({ item, onViewDetails }) => { ... },
     (prevProps, nextProps) => {
       return prevProps.item.produtoId === nextProps.item.produtoId;
     }
   );
   ```

2. **Busca Eficiente:**
   - Usa `include` para evitar N+1 queries
   - Busca estoque Full apenas para produtos vinculados
   - Cache de token ML (auto-renova quando expira)

3. **Processamento Assíncrono:**
   - Processa produtos em loop mas continua se um falhar
   - Não bloqueia toda análise por erro em um produto

4. **Loading States:**
   - Skeleton durante carregamento inicial
   - Spinner no botão durante análise
   - Feedback visual imediato

---

## 🧪 Como Testar

### Cenário 1: Produto com Estoque Baixo
1. Produto com 10 unidades, vendendo 5/dia
2. Configuração: 7 dias entrega, 10 segurança
3. **Esperado**: Aparece como CRÍTICO (2 dias restantes)

### Cenário 2: Produto Full + Local
1. Produto com 5 local + 3 Full
2. Vendendo 2/dia, Full release 3 dias
3. **Esperado**:
   - Full crítico (1.5 dias)
   - Sugere transferir do local

### Cenário 3: Custo Total
1. Produto A: 100 unidades a R$ 10 = R$ 1.000
2. Produto B: 50 unidades a R$ 5 = R$ 250
3. **Esperado**: Custo total = R$ 1.250

### Cenário 4: Nenhum Produto
1. Todos produtos com estoque OK
2. **Esperado**: Mensagem "Nenhum produto precisa de reposição"

### Cenário 5: Atualização de Config
1. Abre modal de um produto
2. Muda período de 90 para 30 dias
3. Salva e fecha
4. Clica "Verificar Estoque"
5. **Esperado**: Nova análise usa 30 dias

---

## 📝 Checklist de Implementação

### ✅ Concluído:

- [x] API de análise em lote (`/api/replenishment/batch-analysis`)
- [x] Componente de cards de resumo
- [x] Componente de linha da tabela (memoizado)
- [x] Página principal com states
- [x] Integração com modal de detalhes
- [x] Cálculo de custos por produto
- [x] Cálculo de custos totais (crítico, atenção, geral)
- [x] Ordenação por prioridade
- [x] Rota na sidebar
- [x] Estados de loading e erro
- [x] Formatação de moeda brasileira
- [x] Responsividade mobile
- [x] Dark mode support
- [x] Documentação completa

### 🎯 Melhorias Futuras:

- [ ] Exportar relatório em Excel/PDF
- [ ] Gráfico de evolução de custos
- [ ] Filtros por status/tipo
- [ ] Busca por nome/SKU
- [ ] Ação em lote (marcar todos como vistos)
- [ ] Notificações push para alertas críticos
- [ ] Histórico de análises anteriores
- [ ] Comparação de períodos

---

## 📚 Referências

### Arquivos Relacionados:

1. **API**:
   - `/src/app/api/replenishment/batch-analysis/route.ts`
   - `/src/app/api/replenishment/suggestions/[produtoId]/route.ts`
   - `/src/app/api/replenishment/config/route.ts`

2. **Componentes**:
   - `/src/app/(root)/reposicao/page.tsx`
   - `/src/app/(root)/reposicao/components/ReplenishmentSummaryCards.tsx`
   - `/src/app/(root)/reposicao/components/ReplenishmentTableRow.tsx`

3. **Sidebar**:
   - `/src/app/components/layout/Sidebar.tsx`

4. **Helpers**:
   - `/src/helpers/productCostHelper.ts`
   - `/src/helpers/verifyUser.ts`

5. **Documentação**:
   - `/REPLENISHMENT_ANALYSIS.md` - Análise de período
   - `/REPLENISHMENT_DASHBOARD.md` - Esta documentação

---

**Desenvolvido em:** 2025-01-10
**Status:** ✅ Implementado e Documentado
**Versão:** 1.0
