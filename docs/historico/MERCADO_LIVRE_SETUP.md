# 📦 Integração com Mercado Livre - Guia de Configuração

Este guia irá te ajudar a configurar a integração do seu sistema de estoque com o Mercado Livre.

## 🚀 Passo a Passo

### 1. Crie uma Aplicação no Mercado Livre

1. Acesse [Developers Mercado Livre](https://developers.mercadolivre.com.br/)
2. Faça login com sua conta do Mercado Livre
3. Clique em **"Criar nova aplicação"**
4. Preencha os dados:
   - **Nome**: Sistema de Estoque
   - **Categoria**: Integração
   - **Descrição**: Sistema para gestão de estoque integrado ao ML

### 2. Configure a URL de Redirecionamento

⚠️ **IMPORTANTE**: O Mercado Livre **só aceita URLs HTTPS**, não aceita HTTP.

**Para desenvolvimento local, você precisa usar ngrok:**

#### Passo 1: Execute sua aplicação

```bash
npm run dev
```

#### Passo 2: Execute o ngrok (em outro terminal)

```bash
ngrok http 3000
```

#### Passo 3: Use a URL HTTPS do ngrok

**Exemplo de URL do ngrok:**

```
https://abc123.ngrok.io/configuracoes
```

**Para produção:**

```
https://seu-dominio.com/configuracoes
```

### 3. Obtenha as Credenciais

Após criar a aplicação, você receberá:

- **APP ID** (Client ID)
- **Secret Key** (Client Secret)

### 4. Configure as Variáveis de Ambiente

Crie ou edite o arquivo `.env` na raiz do projeto:

```env
# Mercado Livre API
ML_CLIENT_ID="seu_app_id_aqui"
ML_CLIENT_SECRET="sua_secret_key_aqui"
ML_REDIRECT_URI="https://abc123.ngrok.io/configuracoes"
```

⚠️ **IMPORTANTE**: Substitua `abc123.ngrok.io` pela URL HTTPS real fornecida pelo ngrok.

### 5. Como Funciona o Fluxo de Autorização

🔄 **Fluxo Automático de Redirecionamento:**

1. **No localhost (qualquer porta)** → Clique em "Conectar Conta"
2. **Redireciona para ML** → Autorize sua conta do Mercado Livre
3. **ML redireciona para ngrok** → O sistema processa automaticamente
4. **Volta para localhost** → Você verá a conta conectada!

✨ **O que acontece automaticamente:**

- **Detecção automática da porta** (3000, 3001, etc.)
- Detecção da URL do ngrok
- Processamento da autorização
- Redirecionamento automático para localhost na porta correta
- Exibição do status de conexão

⚠️ **Nota importante**: Se sua aplicação estiver rodando em uma porta diferente (como 3001), o sistema detectará automaticamente e redirecionará corretamente.

### 6. Reinicie a Aplicação

Após configurar as variáveis de ambiente, reinicie a aplicação:

```bash
# Parar o servidor (Ctrl+C)
# Depois executar novamente:
npm run dev
```

## 🔧 Resolução de Problemas Comuns

### "Não consegue voltar para localhost"

✅ **SOLUCIONADO!** O sistema agora detecta automaticamente quando você está na URL do ngrok e redireciona para localhost após processar a autorização.

### "Credenciais inválidas"

Verifique se:

- `ML_CLIENT_ID` está correto (é o APP ID da aplicação)
- `ML_CLIENT_SECRET` está correto (é a Secret Key da aplicação)
- As variáveis não contêm espaços extras ou quebras de linha

### "URL de redirecionamento incorreta"

Certifique-se de que:

- A URL configurada na aplicação do ML é **exatamente** igual à variável `ML_REDIRECT_URI`
- Usa `https://` (não `http://`)
- Termina com `/configuracoes`

## 📋 Checklist de Configuração

- [ ] Aplicação criada no painel do ML
- [ ] URL de redirecionamento configurada (ngrok)
- [ ] APP ID copiado para ML_CLIENT_ID
- [ ] Secret Key copiada para ML_CLIENT_SECRET
- [ ] URL do ngrok configurada em ML_REDIRECT_URI
- [ ] Arquivo .env criado/atualizado
- [ ] Aplicação reiniciada
- [ ] Teste de conexão realizado

## 🎯 Funcionalidades Disponíveis

Após conectar sua conta, você terá acesso a:

### 📊 Dashboard Analytics

- Estatísticas de vendas
- Taxas do marketplace
- Informações financeiras
- Sincronização por SKU

### 🔄 Sincronização de Produtos

- Sincronização completa
- Sincronização incremental
- Histórico de sincronizações
- Correspondência por SKU

### 🛍️ Gestão de Produtos

- Visualização de produtos ML
- Status de anúncios
- Preços e quantidades
- Filtros e busca

### 🎨 **Interface Melhorada para Contas Conectadas**

- **Dados detalhados do usuário**: Nome completo, email, foto de perfil
- **Estatísticas em tempo real**: Pontos ML, vendas completas, avaliações
- **Status Power Seller**: Badge especial para vendedores premium
- **Banner de boas-vindas**: Confirmação visual da conexão
- **Informações organizadas**: Layout moderno e informativo

### 📊 **Dados Exibidos da Conta ML**

- **👤 Perfil**: Nome, nickname, email, foto
- **⭐ Reputação**: Status Power Seller, nível do vendedor
- **📈 Estatísticas**: Pontos ML, vendas completas, avaliações positivas
- **📅 Histórico**: Data de conexão, tempo de atividade
- **🏷️ Informações**: País, site ML, tipo de usuário

## 🔗 Links Úteis

- [Painel de Desenvolvedor](https://developers.mercadolivre.com.br/)
- [Documentação Oficial](https://developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao)
- [Download ngrok](https://ngrok.com/download)

## 🆘 Suporte

Se ainda estiver enfrentando problemas:

1. Verifique se a URL de redirecionamento está exatamente igual nos dois lugares
2. Certifique-se de que está usando a conta correta do ML (a mesma que criou a aplicação)
3. Verifique os logs no painel de debug da aplicação

## 🔐 Segurança

⚠️ **NUNCA** compartilhe suas credenciais do Mercado Livre:

- Mantenha o arquivo `.env` fora do controle de versão
- Use variáveis de ambiente específicas para produção
- Regenere as credenciais se suspeitar de comprometimento

---

## 🎉 Pronto!

Agora você pode testar o fluxo completo:

1. Acesse `http://localhost:3000/configuracoes`
2. Clique em "Conectar Conta"
3. Autorize no Mercado Livre
4. Seja redirecionado automaticamente de volta para localhost
5. Veja sua conta conectada e explore as funcionalidades!

## 🔄 **Principais Melhorias Implementadas:**

### ✅ **Problema do Redirecionamento Resolvido**

- **Middleware atualizado**: Agora permite callbacks do ML vindos do ngrok
- **Detecção inteligente**: Sistema identifica automaticamente URLs do ngrok
- **Logs detalhados**: Console mostra cada etapa do processo

### 🧠 **Sistema Inteligente de Callback**

- **Verificação prévia**: Checa se já existe conta conectada
- **Processamento seguro**: Evita loops de redirecionamento
- **Cache inteligente**: Usa localStorage para transferir dados entre ngrok/localhost
- **Timeout de segurança**: Dados expiram automaticamente

### 🛠️ **Painel de Debug Avançado**

- **Status em tempo real**: Mostra estado da conexão
- **URLs e logs**: Informações detalhadas sobre o processo
- **Ações de debug**: Botões para recarregar, limpar cache, etc.
- **Detecção de modo**: Identifica se está no ngrok ou localhost

---
