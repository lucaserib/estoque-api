# Integração Bling - Sincronização de Estoque

## 📋 Visão Geral

Funcionalidade de sincronização automática do estoque local com os dados do Bling ERP. O sistema busca o saldo físico de cada produto no Bling e atualiza o estoque local correspondente.

## 🎯 Objetivo

Manter o estoque local sincronizado com o Bling, permitindo que o usuário:
1. Gerencie o estoque no Bling (sistema principal)
2. Sincronize com um clique no sistema de gestão
3. Use os dados sincronizados para análises e integrações com Mercado Livre

## 🏗️ Arquitetura

### Componentes Implementados

```
┌─────────────────────────────────────────────────────────┐
│                    Interface (UI)                        │
│  /app/(root)/produtos/page.tsx                          │
│  - Botão "Atualizar Estoque Bling"                     │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ POST /api/produtos/estoque-bling
                 ▼
┌─────────────────────────────────────────────────────────┐
│                  API Route (Backend)                     │
│  /app/api/produtos/estoque-bling/route.ts              │
│  - Valida usuário                                       │
│  - Busca conta Bling ativa                             │
│  - Coordena sincronização                              │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ BlingService.getAllProducts()
                 ▼
┌─────────────────────────────────────────────────────────┐
│                 Bling Service (SDK)                      │
│  /services/blingService.ts                              │
│  - Gerencia autenticação OAuth                          │
│  - Renova tokens automaticamente                        │
│  - Busca produtos com estoque do Bling                  │
│  - Rate limiting (300ms entre requests)                 │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ HTTPS GET
                 ▼
┌─────────────────────────────────────────────────────────┐
│                    API Bling v3                          │
│  https://www.bling.com.br/Api/v3/produtos              │
│  - Retorna produtos com campo estoque                   │
│  - saldoFisicoTotal: estoque disponível                │
└─────────────────────────────────────────────────────────┘
```

### Fluxo de Sincronização

```
1. Usuário clica "Atualizar Estoque Bling"
   ↓
2. POST /api/produtos/estoque-bling
   ↓
3. Valida usuário autenticado
   ↓
4. Busca BlingAccount ativa do usuário
   ↓
5. Obtém token válido (renova se necessário)
   ↓
6. Busca produtos locais do usuário (com SKU)
   ↓
7. Busca TODOS produtos do Bling via API
   ↓
8. Cria mapa SKU → Estoque para busca rápida
   ↓
9. Para cada produto local:
   ├─ Busca estoque no mapa por SKU
   ├─ Se encontrado: Atualiza estoque no armazém padrão
   ├─ Se não encontrado: Registra como "not_found"
   └─ Aguarda 100ms (rate limiting)
   ↓
10. Retorna estatísticas da sincronização
   ↓
11. Frontend atualiza lista de produtos
```

## 📁 Arquivos Modificados/Criados

### Novos Arquivos

1. **`/src/app/api/produtos/estoque-bling/route.ts`** (277 linhas)
   - API route para sincronização
   - Lógica completa de mapeamento SKU → Estoque
   - Tratamento de erros e logging
   - Estatísticas detalhadas

2. **`BLING_INTEGRATION.md`** (este arquivo)
   - Documentação completa da funcionalidade

### Arquivos Modificados

1. **`/src/services/blingService.ts`**
   - ✅ Adicionado método `getProductsStock()`
   - ✅ Adicionados tipos: `BlingStockDeposit`, `BlingStockItem`, `BlingStockResponse`
   - ✅ Suporte ao endpoint `/estoques/saldos`

2. **`/src/app/(root)/produtos/page.tsx`**
   - ✅ Adicionado estado `updatingBlingStock`
   - ✅ Adicionada função `atualizarEstoqueBling()`
   - ✅ Adicionado botão "Atualizar Estoque Bling" no header

## 🔐 Autenticação

### OAuth 2.0 Flow

O Bling utiliza OAuth 2.0 com:
- **Authorization Code Grant** para obtenção inicial
- **Refresh Token** para renovação automática
- **Bearer Token** nas requisições

### Renovação Automática

O `BlingService.getValidToken()` renova automaticamente o token quando:
- Expira em menos de 5 minutos
- Token inválido (erro 401)

```typescript
// Exemplo de renovação
if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
  const tokens = await this.refreshAccessToken(account.refreshToken);
  // Atualiza no banco
  await prisma.blingAccount.update({
    where: { id: accountId },
    data: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });
}
```

## 📊 Dados Sincronizados

### Formato da Resposta Bling

```json
{
  "data": [
    {
      "id": 12345,
      "nome": "Produto Exemplo",
      "codigo": "SKU-001",
      "estoque": {
        "saldoFisicoTotal": 150.00,
        "saldoVirtualTotal": 145.00
      }
    }
  ]
}
```

### Mapeamento para Banco Local

| Campo Bling | Campo Local | Transformação |
|-------------|-------------|---------------|
| `codigo` | `produto.sku` | Chave de vínculo |
| `estoque.saldoFisicoTotal` | `estoque.quantidade` | `Math.round()` |
| - | `estoque.armazemId` | Armazém "Principal" |

## ⚙️ Configuração

### Variáveis de Ambiente

```env
# Credenciais Bling (obrigatório)
BLING_CLIENT_ID=seu_client_id
BLING_CLIENT_SECRET=seu_client_secret
BLING_REDIRECT_URI=https://seudominio.com/api/bling/callback
```

### Banco de Dados

A tabela `BlingAccount` já existe no schema e armazena:
- `accessToken`: Token de acesso atual
- `refreshToken`: Token para renovação
- `expiresAt`: Data de expiração do token
- `isActive`: Se a conta está ativa
- `userId`: Vínculo com usuário

## 🎛️ Rate Limiting

### Limites da API Bling

| Limite | Valor |
|--------|-------|
| Requisições/segundo | 3 req/s |
| Requisições/dia | 120.000 req/dia |
| Timeout em caso de erro | 10 minutos (após 300 erros) |

### Implementação

```typescript
// Delay de 100ms entre atualizações de estoque
await new Promise((resolve) => setTimeout(resolve, 100));

// Delay de 300ms entre páginas de produtos
await new Promise((resolve) => setTimeout(resolve, 300));
```

**Cálculo:** Com 100ms de delay, o sistema processa máximo 10 produtos/segundo, bem abaixo do limite de 3 req/s da API.

## 📈 Resposta da API

### Sucesso (200 OK)

```json
{
  "success": true,
  "message": "Estoque sincronizado com sucesso! 45 produtos atualizados.",
  "stats": {
    "total": 50,
    "updated": 45,
    "notFound": 5,
    "errors": 0
  },
  "armazem": {
    "id": "abc-123",
    "nome": "Armazém Principal"
  },
  "details": [
    {
      "sku": "SKU-001",
      "nome": "Produto 1",
      "estoqueAnterior": 10,
      "estoqueNovo": 15,
      "status": "updated"
    }
  ]
}
```

### Erro (404 Not Found)

```json
{
  "error": "Conta Bling não encontrada. Configure a integração primeiro."
}
```

### Erro (500 Internal Server Error)

```json
{
  "error": "Erro ao sincronizar estoque do Bling",
  "message": "Erro ao buscar produtos: Token inválido"
}
```

## 🧪 Testes

### Teste Manual

1. **Pré-requisitos:**
   - Ter uma conta Bling configurada
   - Ter produtos cadastrados com SKU correspondente
   - Token Bling válido

2. **Passos:**
   ```bash
   # 1. Acessar página de produtos
   http://localhost:3000/produtos

   # 2. Clicar em "Atualizar Estoque Bling"

   # 3. Verificar logs no console
   [BLING_SYNC] Iniciando sincronização de estoque
   [BLING_SYNC] 50 produtos locais para verificar
   [BLING] Buscando produtos - Página 1, Limite 100
   [BLING] 120 produtos encontrados
   [BLING_SYNC] ✅ SKU-001: 10 → 15
   [BLING_SYNC] ⚠️  Produto SKU-999 não encontrado no Bling
   [BLING_SYNC] Sincronização concluída
   [BLING_SYNC] Atualizados: 45/50

   # 4. Verificar toast de sucesso
   "Estoque sincronizado! 45/50 produtos atualizados"
   ```

3. **Validação:**
   - [ ] Toast de sucesso aparece
   - [ ] Coluna "Estoque Local" atualiza com novos valores
   - [ ] Logs mostram produtos processados
   - [ ] Produtos não encontrados são registrados

### Teste com cURL

```bash
# Obter sessionToken do navegador
TOKEN="seu_token_aqui"

# Chamar API
curl -X POST http://localhost:3000/api/produtos/estoque-bling \
  -H "Cookie: next-auth.session-token=$TOKEN" \
  -H "Content-Type: application/json"
```

## 🐛 Troubleshooting

### Erro: "Conta Bling não encontrada"

**Causa:** Usuário não tem conta Bling configurada ou não está ativa.

**Solução:**
1. Ir em Integrações
2. Conectar conta do Bling
3. Autorizar aplicação

### Erro: "Token inválido"

**Causa:** Token expirou e refresh falhou.

**Solução:**
1. Desconectar conta Bling
2. Reconectar e autorizar novamente

### Produtos não são atualizados

**Causa:** SKU local não corresponde ao `codigo` no Bling.

**Solução:**
1. Verificar campo SKU dos produtos
2. Garantir que corresponde ao campo "Código" no Bling
3. Verificar logs: `[BLING_SYNC] ⚠️  Produto XXX não encontrado`

### Rate Limit Exceeded (429)

**Causa:** Muitas requisições em curto período.

**Solução:**
1. Aguardar 10 minutos
2. Verificar se não há outras integrações rodando simultaneamente
3. Sistema já implementa delays, mas pode aumentar de 100ms para 200ms

## 🔄 Melhorias Futuras

### Curto Prazo

- [ ] Adicionar filtro para sincronizar apenas produtos específicos
- [ ] Implementar sincronização automática agendada (cron)
- [ ] Adicionar progresso visual durante sincronização longa
- [ ] Cache de produtos Bling (5 minutos)

### Médio Prazo

- [ ] Webhooks do Bling para sincronização em tempo real
- [ ] Sincronização bidirecional (Local → Bling)
- [ ] Histórico de sincronizações
- [ ] Relatório de divergências

### Longo Prazo

- [ ] Sincronização de preços
- [ ] Sincronização de descrições e imagens
- [ ] Suporte a múltiplos depósitos/armazéns do Bling
- [ ] Dashboard de integrações

## 📚 Referências

- [Documentação Oficial Bling API v3](https://developer.bling.com.br/)
- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- [Rate Limiting Best Practices](https://cloud.google.com/apis/design/design_patterns#rate_limiting)

## 🤝 Boas Práticas Seguidas

✅ **Modularidade:** Lógica separada em service, route e UI
✅ **Type Safety:** TypeScript com interfaces bem definidas
✅ **Error Handling:** Try-catch com logs e mensagens amigáveis
✅ **Rate Limiting:** Delays implementados para respeitar limites da API
✅ **Token Management:** Renovação automática de tokens
✅ **User Experience:** Loading states e feedback visual
✅ **Logging:** Logs detalhados para debugging
✅ **Documentação:** Código comentado e documentação externa
✅ **Performance:** Mapa para busca O(1) ao invés de loop O(n²)
✅ **Idempotência:** Upsert garante que múltiplas execuções são seguras

## 📝 Notas Técnicas

### Por que usar `getAllProducts()` ao invés de `getProductsStock()`?

O endpoint `/produtos` já retorna o campo `estoque` com `saldoFisicoTotal`, eliminando a necessidade de uma segunda chamada ao endpoint `/estoques/saldos`. Isso:
- Reduz requisições à API (mais eficiente)
- Evita atingir rate limits
- Simplifica a lógica de sincronização

### Armazém Padrão

O sistema busca ou cria um armazém "Principal" para centralizar o estoque sincronizado do Bling. Se o usuário tiver múltiplos armazéns, todos serão mapeados para este armazém padrão. Para suporte a múltiplos armazéns, seria necessário:
1. Mapear depósitos Bling → Armazéns locais
2. Sincronizar estoque por depósito
3. Atualizar UI para mostrar estoque por armazém

### Performance

Com 100 produtos:
- Tempo estimado: ~15 segundos
- Requisições: ~2 (paginação de 100 em 100)
- Rate: 0.13 req/s (bem abaixo do limite de 3 req/s)

## ✅ Checklist de Implementação

- [x] Adicionar tipos TypeScript para estoque Bling
- [x] Implementar método `getProductsStock()` no BlingService
- [x] Criar API route `/api/produtos/estoque-bling`
- [x] Adicionar botão na UI
- [x] Implementar rate limiting
- [x] Adicionar logging detalhado
- [x] Tratamento de erros robusto
- [x] Toast feedback para usuário
- [x] Documentação completa
- [x] Seguir boas práticas de desenvolvimento
