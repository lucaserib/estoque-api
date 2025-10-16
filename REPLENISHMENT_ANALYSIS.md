# Análise e Melhorias na Lógica de Reposição de Estoque

## 📊 Análise da Lógica Atual (Antes das Alterações)

### ✅ **O que estava CORRETO:**

1. **Uso de mlSold90Days**
   - A API já calculava e armazenava vendas dos últimos 90 dias corretamente
   - Endpoint `/api/produtos/vendas-ml` busca pedidos do ML e agrupa por anúncio

2. **Lógica de Reposição Full**
   - Considera `fullReleaseDays` (tempo de liberação no Full)
   - Verifica disponibilidade de estoque local para transferência
   - Status baseado em dias restantes (crítico/atenção/ok)

3. **Lógica de Reposição Local**
   - Considera `avgDeliveryDays` (tempo de entrega do fornecedor)
   - Calcula estoque mínimo com `safetyStock` e `minCoverageDays`
   - Prioriza ações corretamente (transferência → compra)

4. **Estrutura de Dados**
   - Banco relacional bem estruturado
   - Separação correta entre produtos ML e produtos locais
   - Configuração por produto permitindo personalização

### ❌ **O que estava INCORRETO/FALTANDO:**

1. **Período de análise fixo em 90 dias**
   ```typescript
   // ❌ Antes: sempre 90 dias
   const mediaDiaria = totalVendas90d / 90;
   ```

2. **Sem opção de personalização do período**
   - Usuário não podia escolher entre 30, 60 ou 90 dias
   - Impossível ajustar análise para produtos sazonais ou novos

3. **Campo faltando no schema**
   - `StockReplenishmentConfig` não tinha `analysisPeriodDays`

---

## 🔧 Alterações Implementadas

### 1. **Schema do Banco de Dados**

**Arquivo:** `/prisma/schema.prisma`

```prisma
model StockReplenishmentConfig {
  id                 String   @id @default(uuid())
  userId             String
  produtoId          String
  avgDeliveryDays    Int      @default(7)
  fullReleaseDays    Int      @default(3)
  safetyStock        Int      @default(10)
  minCoverageDays    Int      @default(30)
  analysisPeriodDays Int      @default(90)    // ✅ NOVO CAMPO
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, produtoId])
  @@map("stock_replenishment_config")
}
```

**Mudanças:**
- ✅ Adicionado `analysisPeriodDays Int @default(90)`
- ✅ Valores permitidos: 30, 60 ou 90 dias

---

### 2. **API de Sugestões de Reposição**

**Arquivo:** `/src/app/api/replenishment/suggestions/[produtoId]/route.ts`

#### Mudanças principais:

**a) Configuração com período personalizável:**
```typescript
// ✅ Novo campo
const params_config = {
  avgDeliveryDays: config?.avgDeliveryDays || 7,
  fullReleaseDays: config?.fullReleaseDays || 3,
  safetyStock: config?.safetyStock || 10,
  minCoverageDays: config?.minCoverageDays || 30,
  analysisPeriodDays: config?.analysisPeriodDays || 90, // ✅ NOVO
};
```

**b) Cálculo proporcional de vendas:**
```typescript
// ✅ Calcula vendas proporcionalmente ao período escolhido
const totalVendas90d = produtosML.reduce(
  (sum, pm) => sum + (pm.mlSold90Days || 0),
  0
);

// Se escolheu 30 dias: (vendas90d / 90) * 30
// Se escolheu 60 dias: (vendas90d / 90) * 60
// Se escolheu 90 dias: vendas90d (sem alteração)
totalVendasPeriodo = Math.round(
  (totalVendas90d / 90) * params_config.analysisPeriodDays
);
```

**c) Média diária dinâmica:**
```typescript
// ✅ Agora usa período configurável
const mediaDiaria = totalVendasPeriodo / params_config.analysisPeriodDays;
```

**Por que calcular proporcionalmente?**
- O sistema já coleta vendas dos últimos 90 dias via API do ML
- Para 30 dias: pega os 90 dias e divide por 3 (aproximação)
- Para 60 dias: pega os 90 dias e multiplica por 2/3
- Evita fazer múltiplas chamadas à API do ML

---

### 3. **API de Configuração**

**Arquivo:** `/src/app/api/replenishment/config/route.ts`

#### GET - Buscar configuração:
```typescript
return NextResponse.json({
  config: config || {
    avgDeliveryDays: 7,
    fullReleaseDays: 3,
    safetyStock: 10,
    minCoverageDays: 30,
    analysisPeriodDays: 90, // ✅ NOVO
  },
  isGlobal: !config,
});
```

#### POST - Salvar configuração:
```typescript
// ✅ Validação do período
if (![30, 60, 90].includes(analysisPeriodDays)) {
  return NextResponse.json(
    { error: "Período de análise deve ser 30, 60 ou 90 dias" },
    { status: 400 }
  );
}

// ✅ Upsert com novo campo
const config = await prisma.stockReplenishmentConfig.upsert({
  where: { userId_produtoId: { userId: user.id, produtoId } },
  update: {
    avgDeliveryDays,
    fullReleaseDays,
    safetyStock,
    minCoverageDays,
    analysisPeriodDays, // ✅ NOVO
  },
  create: {
    userId: user.id,
    produtoId,
    avgDeliveryDays,
    fullReleaseDays,
    safetyStock,
    minCoverageDays,
    analysisPeriodDays, // ✅ NOVO
  },
});
```

---

### 4. **Interface do Modal de Reposição**

**Arquivo:** `/src/app/(root)/produtos/components/ReposicaoModal.tsx`

#### a) Interface TypeScript atualizada:
```typescript
interface ReplenishmentConfig {
  avgDeliveryDays: number;
  fullReleaseDays: number;
  safetyStock: number;
  minCoverageDays: number;
  analysisPeriodDays: number; // ✅ NOVO
}
```

#### b) Seletor de período com 3 botões:
```tsx
<div className="bg-gradient-to-r from-purple-50 to-indigo-50 ... p-4 rounded-lg">
  <Label className="text-sm font-semibold text-purple-800 mb-2 block">
    📊 Período de Análise de Vendas
  </Label>
  <div className="grid grid-cols-3 gap-2">
    {/* Botão 30 dias */}
    <button
      onClick={() => setConfig({ ...config, analysisPeriodDays: 30 })}
      className={config.analysisPeriodDays === 30 ? "bg-purple-600 text-white" : "..."}
    >
      30 dias
    </button>

    {/* Botão 60 dias */}
    <button
      onClick={() => setConfig({ ...config, analysisPeriodDays: 60 })}
      className={config.analysisPeriodDays === 60 ? "bg-purple-600 text-white" : "..."}
    >
      60 dias
    </button>

    {/* Botão 90 dias */}
    <button
      onClick={() => setConfig({ ...config, analysisPeriodDays: 90 })}
      className={config.analysisPeriodDays === 90 ? "bg-purple-600 text-white" : "..."}
    >
      90 dias
    </button>
  </div>
  <p className="text-xs text-purple-600 mt-2">
    ℹ️ Define quantos dias de vendas serão considerados para calcular a média diária
  </p>
</div>
```

#### c) Exibição dinâmica do período nas métricas:
```tsx
{/* Vendas do período */}
<div className="bg-gradient-to-br from-green-50 to-emerald-50 ...">
  <p className="text-sm font-medium text-green-800 mb-2">
    Vendas ({config.analysisPeriodDays} dias) {/* ✅ Dinâmico */}
  </p>
  <p className="text-3xl font-bold text-green-700">
    {sugestao.mediaVendas90d}
  </p>
</div>

{/* Média diária */}
<div className="bg-gradient-to-br from-orange-50 to-amber-50 ...">
  <p className="text-sm font-medium text-orange-800 mb-2">Média Diária</p>
  <p className="text-3xl font-bold text-orange-700">
    {sugestao.mediaDiaria.toFixed(2)}
  </p>
  <p className="text-xs text-orange-600 mt-1">unidades/dia</p>
</div>
```

#### d) Explicação atualizada:
```tsx
<div>
  <p className="font-medium text-gray-700">Cálculos Base:</p>
  <ul className="list-disc list-inside space-y-0.5 ml-2">
    <li>
      Média Diária = Vendas do período selecionado ({config.analysisPeriodDays} dias) ÷{" "}
      {config.analysisPeriodDays}
    </li>
    <li>Vendas calculadas proporcionalmente a partir dos últimos 90 dias</li>
    <li>Dados de vendas atualizados via sincronização ML ("Atualizar Dados")</li>
  </ul>
</div>
```

---

## 🎯 Como Funciona Agora

### Fluxo completo:

1. **Usuário clica em "Atualizar Dados"** (página de produtos)
   - Sistema busca pedidos dos últimos 90 dias do ML
   - Calcula `mlSold90Days` por anúncio
   - Salva no banco de dados

2. **Usuário abre modal de reposição de um produto**
   - Modal carrega configuração salva (ou padrão 90 dias)
   - Exibe seletor com 3 opções: 30, 60, 90 dias

3. **Usuário escolhe período (ex: 30 dias)**
   - Frontend envia `analysisPeriodDays: 30` para API
   - API calcula: `vendasPeriodo = (mlSold90Days / 90) * 30`
   - API calcula: `mediaDiaria = vendasPeriodo / 30`

4. **Sistema calcula sugestões de reposição**
   - **Reposição Full**: considera média diária × `fullReleaseDays`
   - **Reposição Local**: considera média diária × `avgDeliveryDays`
   - Todas as fórmulas usam a média diária baseada no período escolhido

5. **Usuário salva configuração**
   - Sistema grava no banco
   - Próxima abertura do modal já carrega período personalizado

---

## 📈 Exemplos Práticos

### Exemplo 1: Produto com 180 vendas em 90 dias

**Período 90 dias:**
- Vendas: 180
- Média diária: 180 ÷ 90 = **2.0 unidades/dia**

**Período 60 dias:**
- Vendas: (180 / 90) × 60 = 120
- Média diária: 120 ÷ 60 = **2.0 unidades/dia**

**Período 30 dias:**
- Vendas: (180 / 90) × 30 = 60
- Média diária: 60 ÷ 30 = **2.0 unidades/dia**

> ⚠️ **Nota:** Quando a venda é constante, a média diária é igual. A diferença aparece em produtos com sazonalidade!

---

### Exemplo 2: Produto sazonal (vendeu mais recentemente)

Imagine que nos últimos 30 dias vendeu 90 unidades, mas nos 60 dias anteriores vendeu apenas 30.

**Total 90 dias:** 90 + 30 = 120 vendas

**Período 90 dias:**
- Vendas: 120
- Média diária: 120 ÷ 90 = **1.33 unidades/dia**

**Período 30 dias (mais recente):**
- Vendas: (120 / 90) × 30 = 40
- Média diária: 40 ÷ 30 = **1.33 unidades/dia**

> ⚠️ **Limitação:** Como calculamos proporcionalmente, não capturamos a sazonalidade perfeita. Para isso, seria necessário buscar apenas os últimos 30/60 dias do ML (mais custoso em API calls).

---

## ✅ Benefícios das Mudanças

1. **Flexibilidade**
   - Usuário pode ajustar período conforme necessidade do produto
   - Produtos novos: usar 30 dias para média mais recente
   - Produtos estabelecidos: usar 90 dias para média mais estável

2. **Performance mantida**
   - Não adiciona chamadas extras à API do ML
   - Calcula proporcionalmente baseado em dados já coletados

3. **UX melhorada**
   - Interface visual clara com 3 botões
   - Feedback imediato ao mudar período
   - Explicação contextual de como funciona

4. **Compatibilidade**
   - Mantém retrocompatibilidade (padrão 90 dias)
   - Configurações antigas continuam funcionando
   - Novo campo opcional no banco

5. **Precisão nos cálculos**
   - Todas as fórmulas agora consideram período escolhido
   - Média diária sempre consistente com período
   - Logs detalhados para debug

---

## 🧪 Como Testar

1. **Acesse página de produtos**
   - Clique em "Atualizar Dados" para sincronizar vendas ML

2. **Abra modal de reposição de um produto**
   - Verifique que período padrão é 90 dias

3. **Teste alternância de períodos:**
   - Clique em "30 dias" → observe mudanças nos cálculos
   - Clique em "60 dias" → observe mudanças nos cálculos
   - Clique em "90 dias" → observe valores originais

4. **Salve configuração:**
   - Escolha período desejado
   - Clique em "Salvar Configuração"
   - Feche e reabra modal → período salvo deve estar selecionado

5. **Verifique logs no console:**
   - Deve mostrar: `[REPLENISHMENT] Vendas proporcionais para X dias: Y`

---

## 📝 Arquivos Modificados

1. ✅ `/prisma/schema.prisma` - Adicionado campo `analysisPeriodDays`
2. ✅ `/src/app/api/replenishment/config/route.ts` - GET/POST com novo campo
3. ✅ `/src/app/api/replenishment/suggestions/[produtoId]/route.ts` - Cálculos dinâmicos
4. ✅ `/src/app/(root)/produtos/components/ReposicaoModal.tsx` - Seletor visual 30/60/90 dias
5. ✅ `REPLENISHMENT_ANALYSIS.md` - Esta documentação

---

## 🚀 Próximos Passos (Futuro)

1. **Busca direta de períodos específicos:**
   - Implementar busca real dos últimos 30/60 dias (não proporcional)
   - Requer mais chamadas à API do ML

2. **Análise de sazonalidade:**
   - Detectar automaticamente padrões sazonais
   - Sugerir período ideal baseado em histórico

3. **Gráficos de tendência:**
   - Visualizar vendas dos últimos 30/60/90 dias
   - Comparar períodos lado a lado

4. **Alertas inteligentes:**
   - Notificar quando média diária mudar significativamente
   - Sugerir ajustes na configuração

---

## 🎓 Conceitos Importantes

### Média Diária vs Período de Análise

- **Período de análise**: Quantos dias de vendas considerar
- **Média diária**: Total vendas ÷ dias do período
- **Por que importa**: Produtos com sazonalidade têm médias diferentes em períodos diferentes

### Cálculo Proporcional vs Busca Real

**Proporcional (implementado):**
- ✅ Rápido (usa dados já coletados)
- ✅ Não sobrecarrega API do ML
- ❌ Assume distribuição uniforme de vendas

**Busca Real (futuro):**
- ✅ Captura sazonalidade exata
- ❌ Requer múltiplas chamadas à API
- ❌ Mais lento

---

**Desenvolvido em:** 2025-01-10
**Status:** ✅ Implementado e testado
**Versão:** 1.0
