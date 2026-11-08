# Skubo — guia de configuração ponta a ponta

Este guia cobre tudo o que precisa estar ligado para o Skubo funcionar inteiro em produção: servidor, integrações, painel admin, IA paga e o que cada loja configura dentro do app. A ordem importa — siga de cima para baixo.

---

## 1. Servidor (Vercel)

### Variáveis obrigatórias

| Variável | O que é | Como gerar |
|---|---|---|
| `DATABASE_URL` | Postgres de produção | String do provedor (Neon, Supabase, RDS…) |
| `NEXTAUTH_URL` | Endereço público do app | `https://app.skubo.com.br` |
| `NEXTAUTH_SECRET` | Assina a sessão e o `state` do Bling | `openssl rand -base64 32` |
| `TOKEN_ENCRYPTION_KEY` | Criptografa tokens do ML/Bling no banco | `openssl rand -base64 32` — **nunca troque depois de ir ao ar** |
| `CRON_SECRET` | Protege as rotas `/api/cron/*` | `openssl rand -hex 24` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Login com Google | Google Cloud → Credenciais → OAuth |
| `ML_CLIENT_ID` / `ML_CLIENT_SECRET` / `ML_REDIRECT_URI` | App do Mercado Livre | Ver seção 2 |
| `BLING_CLIENT_ID` / `BLING_CLIENT_SECRET` | App do Bling | Ver seção 3 |

### Recomendadas

| Variável | Para quê |
|---|---|
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Cache e limite de requisições compartilhados entre instâncias. Sem isso cada instância tem o seu. |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Erros em produção com contexto |
| `MP_ACCESS_TOKEN` / `MP_WEBHOOK_SECRET` | Cobrança das assinaturas pelo Mercado Pago. Sem isso o app não bloqueia ninguém por assinatura. |
| `BLING_REDIRECT_URI` | Só se o domínio do callback for diferente do `NEXTAUTH_URL`. Na dúvida, deixe vazio. |

### Banco

`npm run build` roda `prisma migrate deploy` antes do build. O Ciclo 14 traz três migrações novas (notas fiscais, análise com IA e o tipo de notificação de pedido de plataforma) — elas sobem sozinhas no próximo deploy.

### Crons (`vercel.json`)

Já configurados, todos com `Authorization: Bearer $CRON_SECRET`:

| Horário (UTC) | Rota | Faz |
|---|---|---|
| 06:00 | `bling-refresh` | Renova tokens do Bling antes de expirar |
| 06:30 | `bling-sync` | Estoque e custos do Bling |
| 06:45 | `catalogo-diario` | Produtos + anúncios do ML |
| 07:00 | `ml-webhook-retry` | Reprocessa webhooks do ML que falharam |
| 08:00 | `cadastro-incompleto` | Avisa pendências de cadastro |
| 09:00 | `financeiro-diario` | Vendas, conferência do mês, cobranças, saldo do Mercado Pago, recorrências, alertas e **notas fiscais dos últimos 3 dias** |
| 09:30 | `ia-limpeza` | Apaga conversas do Skubo IA paradas há mais de 90 dias |
| segunda 11:00–12:50 (a cada 10 min) | `ia-resumo-semanal` | Resumo semanal do Skubo IA (ver seção 5) |

---

## 2. Mercado Livre

1. developers.mercadolivre.com.br → Minhas aplicações → criar.
2. **URI de redirect**: `https://app.skubo.com.br/configuracoes` (o mesmo valor em `ML_REDIRECT_URI`).
3. **Notificações (webhook)**: `https://app.skubo.com.br/api/mercadolivre/webhook`, tópicos `orders_v2`, `items`, `payments`, `shipments`, `fbm_stock_operations`.
4. Permissões: leitura e escrita de anúncios, vendas, métricas, publicidade (para ads no DRE).

---

## 3. Bling

1. Bling → Central de extensões → Área do integrador → criar aplicativo.
2. **Link de redirecionamento**: `https://app.skubo.com.br/api/bling/auth/callback`.
3. **Escopos** — marque todos estes, senão a conexão sobe incompleta:
   - Produtos (leitura) e Produtos — fornecedores (leitura)
   - Estoques e depósitos (leitura)
   - Pedidos de venda (leitura)
   - Contatos (leitura)
   - Financeiro — contas a pagar/receber (leitura)
   - **Notas fiscais (leitura)** — novo, é o que alimenta "Em nota fiscal"
   - Dados básicos da empresa
4. **Webhooks**: `https://app.skubo.com.br/api/bling/webhook` para produtos e estoque.

O que mudou no Ciclo 14: a conexão não depende mais do cookie de sessão voltar do Bling (o `state` é assinado e carrega o usuário), as credenciais são lidas sem espaços sobrando e, logo depois de conectar, o Skubo testa as permissões e mostra na tela de Integrações exatamente quais faltam. Se tudo estiver certo, já abre a sincronização de produtos e estoque.

---

## 4. Painel admin da plataforma

Área só sua para acompanhar o negócio Skubo: MRR, lojas ativas, testes vencendo, inadimplência, GMV processado, integrações caídas, webhooks com erro e fila de sincronização. Em **Contas** você vê cada loja (plano, ML/Bling, produtos, pedidos e GMV em 30 dias) e liga/desliga a IA.

### Só no domínio principal

```
PLATFORM_ADMIN_EMAILS=voce@skubo.com.br,socio@skubo.com.br
```

Acesse `https://app.skubo.com.br/admin`. Qualquer outra pessoa recebe 404.

### Em subdomínio (`admin.skubo.com.br`)

1. Vercel → Domains → adicione `admin.skubo.com.br` ao mesmo projeto.
2. DNS: `CNAME admin → cname.vercel-dns.com`.
3. Variáveis:
   ```
   ADMIN_HOST=admin.skubo.com.br
   AUTH_COOKIE_DOMAIN=.skubo.com.br
   NEXT_PUBLIC_APP_URL=https://app.skubo.com.br
   ```
4. Faça logout e login uma vez (o cookie passa a valer para os dois subdomínios).

No subdomínio, toda página é servida a partir de `/admin` — `admin.skubo.com.br/contas` abre a lista de contas.

---

## 5. Skubo IA (recurso pago)

O Skubo IA é o assistente "Pergunte ao Skubo" (botão de brilho no canto da tela, `Ctrl/Cmd + J` ou `/ia`), as explicações dentro das telas ("Por que essa sugestão?" na Reposição, "Resumo do produto", "Explicar variação" na Visão geral e no Financeiro, "Plano de ação" na Saúde dos anúncios), a análise da Central de controle e o resumo semanal de segunda-feira.

### 5.1 Chave e modelos

```
ANTHROPIC_API_KEY=sk-ant-api03-...
IA_MODELO=claude-sonnet-5-5
IA_MODELO_RAPIDO=claude-haiku-5-5
```

- Crie a chave em console.anthropic.com dentro de um **workspace** (chave `sk-ant-api03-…`). Se usar uma chave de usuário (`sk-ant-usr-…`), defina também `ANTHROPIC_WORKSPACE_ID=wrkspc_…` — sem isso a Anthropic recusa toda chamada com "This API key is not scoped to a workspace".
- No console da Anthropic, defina um **teto de gasto mensal** da organização. É a última trava, além do orçamento por conta do Skubo.
- Depois do deploy, confira em **Admin → Visão geral → Skubo IA → Testar conexão com a IA**: mostra se a chave, o workspace e os preços estão certos e testa os dois modelos.

### 5.2 Preços e orçamento por conta

```
IA_PRECO_ENTRADA_MTOK=2
IA_PRECO_SAIDA_MTOK=10
IA_PRECO_CACHE_LEITURA_MTOK=0.2
IA_PRECO_CACHE_ESCRITA_MTOK=2.5
IA_PRECO_RAPIDO_ENTRADA_MTOK=0.1
IA_PRECO_RAPIDO_SAIDA_MTOK=0.5
IA_PRECO_RAPIDO_CACHE_LEITURA_MTOK=0.01
IA_PRECO_RAPIDO_CACHE_ESCRITA_MTOK=0.125
IA_COTACAO_DOLAR=5.5
IA_ORCAMENTO_MENSAL_CENTAVOS=1000
IA_MENSAGENS_MENSAIS=300
IA_TESTE_ORCAMENTO_CENTAVOS=200
```

- Preços em **dólar por milhão de tokens**. Os valores acima são os de tabela em outubro de 2026 — **confira na página oficial de preços da Anthropic antes do deploy**. Cada chamada grava o custo estimado em `UsoIa`.
- Se faltar qualquer um dos quatro preços principais, o custo estimado fica vazio (nunca inventado) e o limite passa a valer por **quantidade de mensagens** (`IA_MENSAGENS_MENSAIS`).
- Orçamento padrão por conta: R$ 10,00 de custo estimado por mês. Para uma conta específica, ajuste em **Admin → Contas → Orçamento R$**.
- Teste grátis: 7 dias, até R$ 2,00 de custo estimado.

### 5.3 Cobrança pelo Mercado Pago

Não precisa configurar nada novo: o Skubo IA usa o mesmo `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` e o **mesmo webhook** (`/api/mercadopago/webhook`) da assinatura principal. O checkout cria uma assinatura separada de `R$ 29,90/mês` (valor em `src/lib/billing.ts`, `PRICING.IA_MENSAL`) com referência `ia:<conta>`, e o webhook ativa, mantém, deixa pendente ou cancela o add-on sozinho. Cancelar a assinatura principal cancela também a da IA.

Sem Mercado Pago configurado, o botão "Assinar" vira um pedido de ativação que chega como notificação para quem está em `PLATFORM_ADMIN_EMAILS`.

### 5.4 Liberar uma conta à mão

- **Admin → Contas**: interruptor "Liberação manual (sem cobrança)" na coluna Skubo IA.
- Ou por variável: `IA_CONTAS_LIBERADAS=email@loja.com,outra@loja.com` (aceita e-mail do dono ou id da conta).

### 5.5 Desligar tudo (kill switch)

`IA_DESLIGADA=1` e um redeploy das variáveis (sem mudar código): o assistente mostra "temporariamente desligado", os botões das telas param de chamar a IA e o resumo semanal não roda. **`IA_PROVEDOR_FALSO` nunca deve existir em produção** — ele troca a IA real por respostas de teste.

### 5.6 Crons novos

| Horário (UTC) | Rota | Faz |
|---|---|---|
| 09:30 todo dia | `ia-limpeza` | Apaga conversas paradas há mais de `IA_RETENCAO_DIAS` (90) |
| segunda, a cada 10 min das 11:00 às 12:50 | `ia-resumo-semanal` | Resumo da semana anterior (3 prioridades e riscos) para contas com assinatura ou liberação manual, salvo na Central de controle, com notificação para os ADMINs que não desligaram em Perfil. Cada execução para antes de 50 s e a próxima continua de onde parou; contas já resumidas na semana são puladas |

### 5.7 Onde acompanhar

**Admin → Visão geral → Skubo IA**: assinantes, contas em teste, conversão teste → assinatura, custo estimado do mês (total e por conta), receita e margem do add-on, perguntas por dia, taxa de 👍 e erros do provedor nas últimas 24 h. **Admin → Feedback da IA** lista as respostas marcadas com 👎 (pergunta e resposta, sem os dados internos) para ajustar o prompt.

## 6. O que cada loja configura dentro do app

A tela **Configurar minha loja** (`/comecar`) guia isso em 4 fases. Depois de criar a conta, o lojista já cai nela.

### Fase 1 — Conectar
1. **Mercado Livre** (Integrações → Conectar).
2. **Bling** — ao voltar, a sincronização de produtos e estoque abre sozinha.
3. **Notificações** — confirma que os webhooks estão chegando.

### Fase 2 — Catálogo e estoque
4. **Trazer o catálogo** — produtos, custo, EAN, kits e estoque do Bling; anúncios e Full do ML.
5. **Vincular anúncios** — Anúncios e vínculos → aplicar sugestões. As sugestões agora acham kits do Bling pelo SKU e incluem anúncios pausados.
6. **Custos** — produtos sem custo aparecem em Produtos → filtro "Sem custo" (ou importe planilha).
7. **Fornecedores e prazos** — necessários para a Reposição montar pedidos.

### Fase 3 — Financeiro
8. **Impostos e modo de faturamento** (Financeiro → Configurações). Sem alíquota o DRE ignora imposto.
9. **Despesas fixas** (Lançamentos, com recorrência).
10. **Meta do mês**.
11. **Saldo do Mercado Pago**.

### Fase 4 — No dia a dia
12. **Instalar no celular** (PWA).

### Equipe
Usuários → Convidar → escolher papel → enviar por WhatsApp. Não há limite de pessoas. Quem já tem login no Skubo (sem loja própria) só precisa entrar com o mesmo e-mail.

---

## 7. Rotina recomendada para o lojista

| Quando | Onde | O quê |
|---|---|---|
| Todo dia | Visão geral | Faturamento de hoje com frete, margem, o que vendeu |
| Todo dia | Central de controle | Itens "Resolver agora" (estoque zerado vendendo, margem negativa, anúncio sem vínculo) |
| 2× por semana | Reposição | Gerar pedidos de compra e envio para o Full |
| Toda semana | Saúde dos anúncios | Pausados, sem estoque, Full baixo |
| Fim do mês | Financeiro → Conferência | Confere com o ML e corrige o que faltar |
| Fim do mês | DRE | Lucro líquido com despesas lançadas |
| Toda segunda (plano IA) | Central de controle | Ler o resumo semanal e seguir as 3 prioridades |
| Quando bater a dúvida (plano IA) | Assistente (`Ctrl/Cmd + J`) | Perguntar "o que preciso comprar esta semana?", "por que minha margem caiu?" |

---

## 8. O que o Skubo já tem e vale destacar na venda

- **Lucro real por venda**: tarifa e frete vindos do pagamento do Mercado Pago, não estimados; imposto pela alíquota da conta; CMV pelo custo médio de cada item, kits explodidos nos componentes.
- **Conferência com o Mercado Livre**: prova, mês a mês, que os números batem com o painel do ML.
- **Faturamento com frete e em nota fiscal**: igual ao que o lojista vê no Bling/Mercado Turbo, com a tabela por dia.
- **Reposição local + Full**: demanda real, estoque em trânsito, pedidos em aberto e ponto de pedido por fornecedor; gera os pedidos de compra.
- **Central de controle com nota de saúde** e, no plano pago, o **Skubo IA**: assistente que responde com os números da loja, explicações em cada tela e resumo semanal.
- **Equipe com papéis** (compras, estoque, vendas, leitura) e custo escondido para quem não pode ver.
- **Funciona no celular** como app instalado, com leitor de código de barras para saídas e conferência.

---

## 9. Checklist de ida ao ar

- [ ] Variáveis da seção 1 preenchidas no ambiente de produção
- [ ] App do ML com redirect e webhook do domínio de produção
- [ ] App do Bling com link de redirecionamento e **todos** os escopos da seção 3 (inclusive Notas fiscais)
- [ ] `PLATFORM_ADMIN_EMAILS` com o seu e-mail
- [ ] Deploy feito (migrações aplicadas pelo build)
- [ ] Conectar a própria loja: ML, Bling, ver a Central de controle sem item de integração
- [ ] Abrir `/admin` e conferir os números
- [ ] (Opcional) `admin.` no DNS + `ADMIN_HOST` + `AUTH_COOKIE_DOMAIN`
- [ ] `ANTHROPIC_API_KEY`, preços `IA_PRECO_*` conferidos e teto de gasto no console da Anthropic (seção 5)
- [ ] `IA_PROVEDOR_FALSO` **ausente** em produção
