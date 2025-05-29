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

**Para desenvolvimento local, você precisa usar uma das opções abaixo:**

#### Opção 1: ngrok (Recomendado)

```bash
# 1. Execute sua aplicação
npm run dev

# 2. Em outro terminal, execute o ngrok
ngrok http 3000

# 3. Use a URL HTTPS fornecida pelo ngrok
```

**Exemplo de URL do ngrok:**

```
https://abc123.ngrok.io/configuracoes
```

#### Opção 2: HTTPS Local com certificado

Configure um certificado SSL local (mais complexo).

#### Opção 3: URL de produção temporária

Use uma URL de produção existente para testes iniciais.

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

**Em produção:**

```env
ML_REDIRECT_URI="https://seu-dominio.com/configuracoes"
```

### 5. Teste a Configuração

Execute o script de teste:

```bash
npm run test:ml
```

**Ou use o helper de HTTPS:**

```bash
node scripts/setup-https.js
```

### 6. Reinicie a Aplicação

Após configurar as variáveis de ambiente, reinicie a aplicação:

```bash
npm run dev
```

## 🔧 Resolução de Problemas Comuns

### "Não existe o site"

Este erro geralmente ocorre quando:

1. **URL de redirecionamento incorreta**: A URL configurada na aplicação do ML deve ser **exatamente** igual à variável `ML_REDIRECT_URI`
2. **Protocolo incorreto**: Certifique-se de usar `http://` para desenvolvimento local e `https://` para produção
3. **Porta diferente**: Se sua aplicação roda em uma porta diferente de 3000, atualize a URL

### "Credenciais inválidas"

Verifique se:

- `ML_CLIENT_ID` está correto (é o APP ID da aplicação)
- `ML_CLIENT_SECRET` está correto (é a Secret Key da aplicação)
- As variáveis não contêm espaços extras ou quebras de linha

### "Erro de configuração"

Certifique-se de que:

- O arquivo `.env` está na raiz do projeto
- Todas as três variáveis estão configuradas
- A aplicação foi reiniciada após configurar as variáveis

## 📋 Checklist de Configuração

- [ ] Aplicação criada no painel do ML
- [ ] URL de redirecionamento configurada
- [ ] APP ID copiado para ML_CLIENT_ID
- [ ] Secret Key copiada para ML_CLIENT_SECRET
- [ ] URL de callback configurada em ML_REDIRECT_URI
- [ ] Arquivo .env criado/atualizado
- [ ] Aplicação reiniciada
- [ ] Teste de configuração executado

## 🔗 Links Úteis

- [Painel de Desenvolvedor](https://developers.mercadolivre.com.br/)
- [Documentação Oficial](https://developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao)
- [Guia de Autenticação](https://developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao)

## 🆘 Suporte

Se ainda estiver enfrentando problemas:

1. Execute `node scripts/test-ml-config.js` e compartilhe o resultado
2. Verifique se a URL de redirecionamento está exatamente igual nos dois lugares
3. Certifique-se de que está usando a conta correta do ML (a mesma que criou a aplicação)

## 🔐 Segurança

⚠️ **NUNCA** compartilhe suas credenciais do Mercado Livre:

- Mantenha o arquivo `.env` fora do controle de versão
- Use variáveis de ambiente específicas para produção
- Regenere as credenciais se suspeitar de comprometimento
