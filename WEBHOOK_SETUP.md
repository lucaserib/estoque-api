# 🔗 Configuração de Webhooks do Mercado Livre

## **📋 Visão Geral**

Os webhooks do Mercado Livre permitem receber notificações automáticas em tempo real sobre:

- ✅ Mudanças em produtos (preços, estoque, status)
- ✅ Novos pedidos e mudanças de status
- ✅ Atualizações de pagamentos
- ✅ Mudanças no catálogo

## **🚀 Configuração Rápida**

### **1. URL do Webhook**

```
https://SEU_DOMINIO.com/api/mercadolivre/webhook
```

### **2. Eventos Suportados**

- `items` - Mudanças em produtos
- `orders` - Novos pedidos e mudanças de status
- `payments` - Atualizações de pagamento
- `stock-locations` - Mudanças de estoque

### **3. Configurar no Painel do ML**

1. **Acesse**: https://applications.mercadolibre.com.br/
2. **Selecione** sua aplicação
3. **Vá para** "Webhooks" ou "Notificações"
4. **Configure**:
   - **URL**: `https://SEU_DOMINIO.com/api/mercadolivre/webhook`
   - **Tópicos**: `items`, `orders`, `payments`
   - **Método**: POST
   - **Timeout**: 10 segundos

---

## **🛠️ Configuração Detalhada**

### **Para Desenvolvimento Local (ngrok)**

```bash
# 1. Instalar ngrok
npm install -g ngrok

# 2. Expor porta local
ngrok http 3000

# 3. Usar URL do ngrok no webhook
# Exemplo: https://abc123.ngrok.io/api/mercadolivre/webhook
```

### **Para Produção**

```bash
# 1. Certificar que HTTPS está configurado
# 2. URL deve ser: https://seudominio.com/api/mercadolivre/webhook
# 3. Certificar que a rota está acessível publicamente
```

---

## **📡 Testando Webhooks**

### **1. Verificar Endpoint**

```bash
curl -X GET "https://SEU_DOMINIO.com/api/mercadolivre/webhook"
```

**Resposta Esperada:**

```json
{
  "message": "Endpoint de webhook ML ativo",
  "timestamp": "2025-01-20T10:30:00.000Z"
}
```

### **2. Testar Webhook Challenge**

```bash
curl -X GET "https://6bdcdc2d4453.ngrok-free.app/api/mercadolivre/webhook?challenge=test123"
```

**Resposta Esperada:**

```json
{
  "challenge": "test123"
}
```

---

## **🔍 Monitoramento e Debug**

### **Logs do Sistema**

O sistema automaticamente registra:

- ✅ Webhooks recebidos
- ✅ Processamento de notificações
- ✅ Erros e falhas
- ✅ Tempo de resposta

### **Verificar Logs**

```bash
# Verificar logs da aplicação
npm run logs

# Ou verificar logs no console do servidor
tail -f logs/webhook.log
```

### **Dashboard de Webhooks**

Acesse: `https://SEU_DOMINIO.com/mercado-livre/configuracoes`

- Ver histórico de webhooks
- Status de processamento
- Relatórios de erro

---

## **⚡ Automação Configurada**

### **Sincronização Automática**

Com os webhooks configurados, o sistema automaticamente:

1. **Produtos** (webhook `items`):

   - ✅ Atualiza preços em tempo real
   - ✅ Sincroniza mudanças de estoque
   - ✅ Detecta produtos pausados/ativados
   - ✅ Captura alterações de título/descrição

2. **Pedidos** (webhook `orders`):

   - ✅ Notifica novos pedidos imediatamente
   - ✅ Atualiza status de envio
   - ✅ Invalida cache de vendas
   - ✅ Atualiza métricas de vendas

3. **Pagamentos** (webhook `payments`):
   - ✅ Confirma pagamentos processados
   - ✅ Atualiza status financeiro
   - ✅ Invalida cache de métricas

---

## **📊 Benefícios dos Webhooks**

### **Antes (Sincronização Manual)**

- ❌ 25 segundos para 44 produtos
- ❌ Dados desatualizados
- ❌ Sincronização manual necessária
- ❌ Cache pode estar obsoleto

### **Depois (Webhooks Automáticos)**

- ✅ Atualizações em tempo real (< 1 segundo)
- ✅ Dados sempre atualizados
- ✅ Zero intervenção manual
- ✅ Cache invalidado automaticamente

---

## **🔧 Solução de Problemas**

### **Webhook Não Funciona**

1. **Verificar URL**:

   ```bash
   curl -I https://SEU_DOMINIO.com/api/mercadolivre/webhook
   ```

2. **Verificar HTTPS**:

   - ML só aceita URLs HTTPS
   - Certificado deve ser válido

3. **Verificar Logs**:

   ```bash
   # Logs da aplicação
   docker logs nome_do_container

   # Ou logs do PM2
   pm2 logs
   ```

4. **Verificar Firewall**:
   - Porta deve estar aberta
   - ML precisa acessar a URL

### **Webhook Recebido Mas Não Processado**

1. **Verificar Logs de Erro**:

   ```javascript
   // Logs aparecem no console
   console.log("[WEBHOOK] Erro ao processar:", error);
   ```

2. **Verificar Database**:

   ```sql
   SELECT * FROM MercadoLivreWebhook
   ORDER BY createdAt DESC
   LIMIT 10;
   ```

3. **Verificar Token de Acesso**:
   - Token pode ter expirado
   - Renovação automática deve funcionar

### **Performance dos Webhooks**

1. **Verificar Tempo de Resposta**:

   - Deve ser < 10 segundos
   - ML reinvia se demorar muito

2. **Verificar Rate Limiting**:
   - ML pode limitar webhooks
   - Implementar backoff exponencial

---

## **📈 Métricas e Monitoramento**

### **Dashboard de Performance**

Acessível em: `/mercado-livre/configuracoes`

**Métricas Incluídas:**

- 📊 Webhooks recebidos/hora
- ⏱️ Tempo médio de processamento
- ❌ Taxa de erro
- 🔄 Reenvios automáticos
- 📈 Performance por tipo de evento

### **Alertas Automáticos**

Sistema envia alertas quando:

- ❌ Taxa de erro > 5%
- ⏱️ Tempo de resposta > 5 segundos
- 🔄 Muitos reenvios (> 3)
- 📉 Queda na recepção de webhooks

---

## **🎯 Próximos Passos**

1. **Configurar URL do webhook** no painel ML
2. **Verificar** que está funcionando com curl
3. **Monitorar logs** por 24 horas
4. **Ativar alertas** de performance
5. **Testar** mudanças de produtos/pedidos

## **📞 Suporte**

Se houver problemas:

1. Verificar logs da aplicação
2. Testar URL manualmente
3. Verificar configuração no painel ML
4. Contatar suporte se necessário

**URL de Teste**: `GET /api/mercadolivre/webhook`
**Logs**: Console da aplicação
**Configuração**: Painel Mercado Livre
