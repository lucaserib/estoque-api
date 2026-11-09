# Skubo — guia de configuração ponta a ponta

Este guia cobre tudo o que precisa estar ligado para o Skubo funcionar inteiro em produção: servidor, integrações, painel admin, cobrança, e-mails, anúncios, IA e o que cada loja configura dentro do app. A ordem importa — siga de cima para baixo.

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
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Cache e limite de tentativas compartilhados entre instâncias. Sem isso o cache é por instância e o limite de tentativas (login, cadastro, senha, convites) usa um contador no banco. |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Erros em produção com contexto |
| `MP_ACCESS_TOKEN` / `MP_WEBHOOK_SECRET` | Cobrança das assinaturas e venda de perguntas da IA pelo Mercado Pago (seção 5). Sem o token o app não bloqueia ninguém por assinatura. |
| `RESEND_API_KEY` / `RESEND_WEBHOOK_SECRET` / `EMAIL_REMETENTE` / `EMAIL_RESPONDER_PARA` / `EMPRESA_ENDERECO_RODAPE` | E-mails do Skubo (seção 6). Sem a chave, os e-mails só vão para o log. |
| `DESCADASTRO_SEGREDO` | Assina os links de descadastro e da pesquisa de cancelamento (`openssl rand -hex 32`). Sem ela, a assinatura deriva do `NEXTAUTH_SECRET` — trocar o `NEXTAUTH_SECRET` depois invalidaria os links já enviados. |
| `NEXT_PUBLIC_META_PIXEL_ID` / `META_PIXEL_ID` / `META_CAPI_TOKEN` | Pixel e API de conversões da Meta (seção 7). Opcional. |
| `COBRANCA_OBRIGATORIA` | `1` bloqueia contas vencidas mesmo sem Mercado Pago, `0` nunca bloqueia; vazio = bloqueia só quando o Mercado Pago está configurado. |
| `RATE_LIMIT_BANCO` | `0` desliga o contador de tentativas no banco (só faz sentido com Upstash configurado). |
| `BLING_REDIRECT_URI` | Só se o domínio do callback for diferente do `NEXTAUTH_URL`. Na dúvida, deixe vazio. |

### Banco

`npm run build` roda `prisma migrate deploy` antes do build. O Ciclo 16 traz oito migrações (`20261108090100` a `20261108090800`), todas aditivas. Além das tabelas novas, elas preparam os dados de quem já usa o Skubo:

- cada dono de conta sem linha em `subscriptions` ganha a assinatura de teste (as contas antigas não tinham nenhuma);
- cada conta ganha um perfil com o código de indicação (`SKU-` + 6 caracteres);
- quem entra pelo Google fica com o e-mail marcado como confirmado;
- cada conta ganha **5 perguntas grátis da IA válidas por 14 dias**; quem tinha o add-on mensal da IA ganha **25 perguntas válidas por 1 ano** (na cópia de produção usada no ensaio, nenhuma conta tinha o add-on);
- a configuração comercial nasce na versão 1 com os preços de hoje.

Antes do deploy, faça um backup do banco (Neon → Branches → criar um branch de cópia é suficiente).

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
| 09:30 | `ia-limpeza` | Apaga conversas do Skubo IA paradas há mais de 90 dias, tokens vencidos e contadores de tentativas antigos |
| segunda 11:00–12:50 (a cada 10 min) | `ia-resumo-semanal` | Resumo semanal do Skubo IA (ver seção 8) |
| a cada 5 min | `email-fila` | Envia a fila de e-mails em lote e as campanhas agendadas |
| de hora em hora (:15) | `ciclo-de-vida` | E-mails automáticos por tempo: conectar ML/Bling, primeira reposição, teste acabando/terminou, "volte" em 3 e 14 dias |
| 10:00 | `indicacoes` | Libera as recompensas de indicação que passaram da carência |
| 03:10 | `ia-creditos-expiracao` | Expira lotes de perguntas vencidos e compras de perguntas não pagas |
| 10:30 | `reajustes` | Aplica reajustes de preço agendados (o aviso sai 30 dias antes) |
| 11:00 | `assinaturas-recompensas` | Aplica os dias de indicação na próxima cobrança (desconto ou ciclo pulado) e reativa assinaturas pausadas |
| 11:00 | `tarefas-diario` | Resumo das 8h (São Paulo) para quem tem tarefa atrasada ou vencendo hoje: notificação e, se a pessoa deixou ligado, e-mail |

Crons a cada 5 minutos e de hora em hora exigem o plano Pro da Vercel (o Hobby só aceita cron diário e recusa o deploy).

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
5. Marcou ou mudou um escopo depois de conectar? Clique em **Reconectar** em Integrações — o token antigo continua sem a permissão nova. O botão **Verificar permissões** no cartão do Bling mostra na hora o que ainda falta (testa os 6 escopos) e grava o ID da empresa usado pelos webhooks.

O que mudou no Ciclo 14: a conexão não depende mais do cookie de sessão voltar do Bling (o `state` é assinado e carrega o usuário), as credenciais são lidas sem espaços sobrando e, logo depois de conectar, o Skubo testa as permissões e mostra na tela de Integrações exatamente quais faltam. Se tudo estiver certo, já abre a sincronização de produtos e estoque.

---

## 4. Painel admin da plataforma

Área só sua para acompanhar e operar o negócio Skubo. Toda ação que muda alguma coisa pede um **motivo** e fica em **Auditoria** (quem, quando, IP, antes e depois).

| Página | O que tem |
|---|---|
| Visão geral | MRR real (pelos pagamentos) e estimado, contas por situação, funil cadastro → ativação → pagamento, coortes semanais, cancelamentos e motivos, receita de perguntas da IA, custo da IA e saúde da plataforma (integrações, webhooks, filas) |
| Contas | Busca e filtros; a ficha da conta tem assinatura, pagamentos, créditos, indicações, e-mails, eventos e as ações: estender teste, conceder dias, conceder perguntas, liberar a IA, aplicar cupom, cancelar assinatura, marcar como teste interno, bloquear/desbloquear, reenviar e-mail e executar a exclusão (LGPD) |
| Usuários | Busca por e-mail; enviar redefinição de senha, reenviar confirmação, bloquear/desbloquear |
| Assinaturas e pagamentos | Todos os pagamentos (assinatura e perguntas), exportação CSV e estorno de compra de perguntas |
| Créditos de IA | Vendas, consumo, saldo em aberto e perguntas a vencer |
| Indicações | Indicações por status, fila de revisão e decisão manual |
| E-mails e campanhas | Automações (texto, liga/desliga, envio de teste), campanhas com público, prévia, teste, agendamento e métricas, supressões |
| Preços e ofertas | Configuração comercial com histórico de versões, cupons e reajustes agendados |
| IA | Testar conexão e respostas marcadas com 👎 |

### Primeiro acesso

1. Coloque o seu e-mail em `PLATFORM_ADMIN_EMAILS` e faça o deploy.
2. Entre no app com esse e-mail e abra `/admin`.
3. Em **Preços e ofertas**, confira a versão 1 (preços, dias de teste, pacotes da IA, regras de indicação, textos da página `/planos`). Mudou alguma coisa? Salvar cria a versão 2.
4. Em **Contas**, marque como **teste interno** as suas contas e as de quem testa — elas saem das métricas e não contam indicação.
5. Em **E-mails e campanhas**, abra cada automação e use **Enviar teste para mim** para ver como chega.

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

## 5. Cobrança (Mercado Pago)

```
MP_ACCESS_TOKEN=APP_USR-...
MP_WEBHOOK_SECRET=...
```

1. Mercado Pago → Suas integrações → crie uma aplicação (produto **Assinaturas** e **Checkout Pro**).
2. Em **Credenciais de produção**, copie o Access Token para `MP_ACCESS_TOKEN`.
3. Em **Webhooks**, cadastre `https://app.skubo.com.br/api/mercadopago/webhook` com os eventos **Pagamentos** e **Planos e assinaturas**, copie a assinatura secreta para `MP_WEBHOOK_SECRET`. Em produção, sem esse segredo o webhook responde 503 e nada é processado.
4. Faça o deploy. A partir daí, quem passou do teste sem assinar é levado para `/assinatura` (e as APIs respondem 402).

O que passa pelo Mercado Pago:

- **Assinatura** (mensal ou anual) por preapproval, no preço da configuração comercial em vigor. Quem assina durante o teste autoriza agora e a primeira cobrança cai no fim do teste. O preço fica gravado na assinatura (`precoContratadoCentavos`) e só muda por um reajuste agendado no admin.
- **Perguntas da IA** por Checkout Pro (pagamento único, Pix ou cartão), com referência `credito-ia:<compra>`. O webhook credita as perguntas uma vez só, mesmo que o aviso chegue repetido.
- **Dias de indicação**: no mensal, viram desconto na próxima cobrança (ou o ciclo é pulado, com a assinatura pausada, quando os dias cobrem o mês inteiro); no anual, estendem o período.

**Antes de ligar a cobrança, teste no sandbox** (credenciais de teste + usuários de teste do Mercado Pago): assinar durante o teste, assinar depois do teste, comprar perguntas com Pix e com cartão, cancelar, pagamento recusado. Os pontos ainda não confirmados contra a API real estão em `docs/AUDITORIA-CICLO-16.md` → "Mercado Pago".

Para desenvolvimento e e2e existe um Mercado Pago simulado (`MP_PROVEDOR_FALSO=1`, rotas `/api/teste/mercadopago/*`). Ele é ignorado em produção (`VERCEL_ENV=production`), mas **não defina essa variável em nenhum ambiente público**.

---

## 6. E-mails (Resend)

```
RESEND_API_KEY=re_...
RESEND_WEBHOOK_SECRET=whsec_...
EMAIL_REMETENTE=Skubo <ola@skubo.com.br>
EMAIL_RESPONDER_PARA=suporte@skubo.com.br
EMPRESA_ENDERECO_RODAPE=Skubo · CNPJ 00.000.000/0001-00 · Cidade/UF
DESCADASTRO_SEGREDO=...
```

1. resend.com → **Domains** → adicione `skubo.com.br` (ou um subdomínio só para envio, como `mail.skubo.com.br`, que protege a reputação do domínio principal).
2. No DNS, crie os registros que o Resend mostrar: **SPF** (TXT `v=spf1 include:amazonses.com ~all` no subdomínio de envio), **DKIM** (TXT `resend._domainkey`) e o **MX** de retorno. Espere ficar **Verified**.
3. Crie o **DMARC** no domínio raiz: TXT `_dmarc` com `v=DMARC1; p=none; rua=mailto:dmarc@skubo.com.br`. Depois de algumas semanas sem falhas, suba para `p=quarantine`.
4. **API Keys** → crie uma chave com permissão de envio só para esse domínio → `RESEND_API_KEY`.
5. **Webhooks** → endpoint `https://app.skubo.com.br/api/email/webhook` com os eventos `email.sent`, `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`, `email.failed` e `email.suppressed` → copie o segredo para `RESEND_WEBHOOK_SECRET`. Devolução permanente e marcação de spam colocam o endereço em supressão sozinhos.
6. `EMAIL_REMETENTE` tem que ser de um domínio verificado. `EMPRESA_ENDERECO_RODAPE` vai no rodapé de todo e-mail (pede-se endereço físico ou CNPJ em e-mail de marketing).
7. Depois do deploy: **Admin → E-mails e campanhas → qualquer automação → Enviar teste para mim**. Confira a chegada na caixa de entrada (não no spam) no Gmail e no Outlook.

Como funciona: e-mails urgentes (senha, confirmação, convite) saem na hora; o resto entra numa fila que o cron `email-fila` envia em lote a cada 5 minutos. Todo e-mail é registrado em `EmailEnviado`, é idempotente (o mesmo aviso não sai duas vezes) e respeita o consentimento: marketing só para quem aceitou, ciclo de vida para quem não se descadastrou, transacional sempre. Todo e-mail que não é transacional leva o link de descadastro e o cabeçalho de descadastro em um clique.

Sem `RESEND_API_KEY` (ou com `EMAIL_PROVEDOR=console`) nada é enviado: os e-mails aparecem no log do servidor.

---

## 7. Meta (pixel e API de conversões)

```
NEXT_PUBLIC_META_PIXEL_ID=1234567890
META_PIXEL_ID=1234567890
META_CAPI_TOKEN=EAAG...
META_CAPI_TESTE=TEST12345
```

1. Meta Business → Gerenciador de Eventos → crie (ou use) o pixel do Skubo → copie o ID para as duas variáveis de pixel.
2. No mesmo pixel → Configurações → **API de conversões** → gerar token de acesso → `META_CAPI_TOKEN`.
3. Para testar, copie o código da aba **Testar eventos** para `META_CAPI_TESTE`, faça um cadastro e confira os eventos chegando. **Apague `META_CAPI_TESTE` depois** — com ele, os eventos não contam nas campanhas.

Eventos enviados: `CompleteRegistration` (cadastro), `StartTrial` (assinatura autorizada), `Subscribe` (primeiro pagamento) e `Purchase` (compra de perguntas). O pixel no navegador só carrega para quem clica em **Aceitar** no aviso de cookies; o envio pelo servidor só acontece para quem aceitou receber novidades no cadastro ou no perfil. E-mail e telefone vão com hash SHA-256, e o mesmo id de evento no navegador e no servidor evita contar duas vezes.

---

## 8. Skubo IA (perguntas pagas)

O Skubo IA é o assistente "Pergunte ao Skubo" (botão de brilho no canto da tela, `Ctrl/Cmd + J` ou `/ia`), as explicações dentro das telas ("Por que essa sugestão?" na Reposição, "Resumo do produto", "Explicar variação" na Visão geral e no Financeiro, "Plano de ação" na Saúde dos anúncios), a análise da Central de controle e o resumo semanal de segunda-feira.

### 8.1 Chave e modelos

```
ANTHROPIC_API_KEY=sk-ant-api03-...
IA_MODELO=claude-sonnet-5-5
IA_MODELO_RAPIDO=claude-haiku-5-5
```

- Crie a chave em console.anthropic.com dentro de um **workspace** (chave `sk-ant-api03-…`). Se usar uma chave de usuário (`sk-ant-usr-…`), defina também `ANTHROPIC_WORKSPACE_ID=wrkspc_…` — sem isso a Anthropic recusa toda chamada com "This API key is not scoped to a workspace".
- No console da Anthropic, defina um **teto de gasto mensal** da organização. É a última trava, além do orçamento por conta do Skubo.
- Depois do deploy, confira em **Admin → Visão geral → Skubo IA → Testar conexão com a IA**: mostra se a chave, o workspace e os preços estão certos e testa os dois modelos.

### 8.2 Custo estimado e teto de segurança

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
```

- Preços em **dólar por milhão de tokens**. Os valores acima são os de tabela em outubro de 2026 — **confira na página oficial de preços da Anthropic antes do deploy**. Cada chamada grava o custo estimado em `UsoIa`.
- Se faltar qualquer um dos quatro preços principais, o custo estimado fica vazio (nunca inventado) e o limite passa a valer por **quantidade de mensagens** (`IA_MENSAGENS_MENSAIS`).
- Teto de segurança por conta: R$ 10,00 de custo estimado por mês (`IA_ORCAMENTO_MENSAL_CENTAVOS`), mesmo com perguntas compradas. É só para impedir abuso; o que a loja paga é por pergunta (8.3). Para uma conta específica, `Subscription.iaOrcamentoCentavos` sobrescreve (rota `PATCH /api/admin/contas/[id]/ia`).
- `IA_TESTE_ORCAMENTO_CENTAVOS` não é mais usada: o teste agora é por quantidade de perguntas.

### 8.3 Perguntas (créditos)

A IA não tem mais mensalidade. Cada conta tem um saldo de **perguntas**:

- Toda conta nova ganha as perguntas do teste (padrão: 5, válidas por 14 dias). Quem entra por indicação ganha mais (padrão: +5, válidas por 30 dias).
- A loja compra **pacotes** (padrão: 25 perguntas por R$ 29,70, válidas por 1 ano) no assistente, em **Ajustes → Skubo IA** ou em `/assinatura`. Pagamento único pelo Mercado Pago (seção 5); as perguntas entram assim que o pagamento é aprovado.
- Cada pergunta no assistente e cada análise da Central de controle gastam 1. As explicações dentro das telas são grátis até 20 por dia por conta; o resumo semanal é grátis para quem assina. Tudo isso (pesos, pacotes, validade, perguntas do teste) se muda em **Admin → Preços e ofertas**, sem deploy.
- O saldo é gasto do lote que vence primeiro. Se a resposta falhar, a pergunta volta. Cada entrada e saída fica em `movimentos_credito_ia` (extrato da conta no admin).
- Saldo em 3 ou menos: aviso no assistente e e-mail; saldo zerado: e-mail com o link de compra.

Quem tinha o add-on mensal antigo recebeu 25 perguntas pela migração. A assinatura antiga do add-on no Mercado Pago precisa ser **cancelada à mão** no painel do Mercado Pago (o webhook passa a ignorá-la). As rotas `/api/assinatura/ia/*` foram removidas.

### 8.4 Liberar uma conta à mão

- **Admin → Contas → (conta) → Liberar a IA**: uso sem gastar perguntas (piloto, parceiro). Ou **Conceder perguntas** para dar um lote.
- Ou por variável: `IA_CONTAS_LIBERADAS=email@loja.com,outra@loja.com` (aceita e-mail do dono ou id da conta).

### 8.5 Desligar tudo (kill switch)

`IA_DESLIGADA=1` e um redeploy das variáveis (sem mudar código): o assistente mostra "temporariamente desligado", os botões das telas param de chamar a IA e o resumo semanal não roda. **`IA_PROVEDOR_FALSO` nunca deve existir em produção** — ele troca a IA real por respostas de teste.

### 8.6 Crons da IA

| Horário (UTC) | Rota | Faz |
|---|---|---|
| 09:30 todo dia | `ia-limpeza` | Apaga conversas paradas há mais de `IA_RETENCAO_DIAS` (90) |
| segunda, a cada 10 min das 11:00 às 12:50 | `ia-resumo-semanal` | Resumo da semana anterior (3 prioridades e riscos) para contas com assinatura ou liberação manual, salvo na Central de controle, com notificação para os ADMINs que não desligaram em Perfil. Cada execução para antes de 50 s e a próxima continua de onde parou; contas já resumidas na semana são puladas |

### 8.7 Onde acompanhar

**Admin → Créditos de IA**: perguntas vendidas, receita, consumo por dia, saldo em aberto e a vencer. **Admin → Visão geral**: custo estimado do mês (total e por conta), margem da IA, taxa de 👍 e erros do provedor nas últimas 24 h. **Admin → Feedback da IA** lista as respostas marcadas com 👎 (pergunta e resposta, sem os dados internos) para ajustar o prompt.

## 9. O que cada loja configura dentro do app

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

### Operação (tarefas e ideias)
Nada a configurar no servidor além do cron `tarefas-diario`. No primeiro acesso a `/operacao`, a loja ganha o quadro "Operação da loja" (A fazer, Fazendo, Aguardando, Feito) e as etiquetas de e-commerce (Compras, Estoque, Full, Anúncios, Financeiro, Atendimento, Marketing, Fiscal). Sugestão para o lojista: em **Meu dia → Ver rotinas sugeridas**, criar as rotinas da semana; o administrador ajusta quadros, colunas e etiquetas no ícone de engrenagem do quadro.

### Equipe
Usuários → Convidar → escolher papel. O convite vai por e-mail (e dá para copiar o link ou mandar pelo WhatsApp), vale 7 dias e pode ser reenviado ou renovado. O limite de pessoas por conta vem da configuração comercial (padrão: sem limite). Quem já tem login no Skubo (sem loja própria) só precisa entrar com o mesmo e-mail. O administrador remove pessoas na mesma tela; quem quiser sair usa **Perfil → Sair desta equipe**.

---

## 10. Rotina recomendada para o lojista

| Quando | Onde | O quê |
|---|---|---|
| Todo dia | Visão geral | Faturamento de hoje com frete, margem, o que vendeu |
| Todo dia | Central de controle | Itens "Resolver agora" (estoque zerado vendendo, margem negativa, anúncio sem vínculo) |
| 2× por semana | Reposição | Gerar pedidos de compra e envio para o Full |
| Toda semana | Saúde dos anúncios | Pausados, sem estoque, Full baixo |
| Fim do mês | Financeiro → Conferência | Confere com o ML e corrige o que faltar |
| Fim do mês | DRE | Lucro líquido com despesas lançadas |
| Todo dia | Operação → Meu dia | O que está atrasado e o que vence hoje; anotar o que surgir na captura rápida |
| Toda segunda (plano IA) | Central de controle | Ler o resumo semanal e seguir as 3 prioridades |
| Quando bater a dúvida (plano IA) | Assistente (`Ctrl/Cmd + J`) | Perguntar "o que preciso comprar esta semana?", "por que minha margem caiu?" |

---

## 11. O que o Skubo já tem e vale destacar na venda

- **Lucro real por venda**: tarifa e frete vindos do pagamento do Mercado Pago, não estimados; imposto pela alíquota da conta; CMV pelo custo médio de cada item, kits explodidos nos componentes.
- **Conferência com o Mercado Livre**: prova, mês a mês, que os números batem com o painel do ML.
- **Faturamento com frete e em nota fiscal**: igual ao que o lojista vê no Bling/Mercado Turbo, com a tabela por dia.
- **Reposição local + Full**: demanda real, estoque em trânsito, pedidos em aberto e ponto de pedido por fornecedor; gera os pedidos de compra.
- **Central de controle com nota de saúde** e o **Skubo IA**: assistente que responde com os números da loja, explicações em cada tela e resumo semanal, pago por pergunta, sem mensalidade.
- **Indique e ganhe**: cada loja indicada que assina vale dias grátis para quem indicou.
- **Equipe com papéis** (compras, estoque, vendas, leitura) e custo escondido para quem não pode ver.
- **Funciona no celular** como app instalado, com leitor de código de barras para saídas e conferência.

---

## 12. Checklist de ida ao ar

- [ ] Variáveis da seção 1 preenchidas no ambiente de produção
- [ ] App do ML com redirect e webhook do domínio de produção
- [ ] App do Bling com link de redirecionamento e **todos** os escopos da seção 3 (inclusive Notas fiscais)
- [ ] `PLATFORM_ADMIN_EMAILS` com o seu e-mail
- [ ] Deploy feito (migrações aplicadas pelo build)
- [ ] Conectar a própria loja: ML, Bling, ver a Central de controle sem item de integração
- [ ] Abrir `/admin` e conferir os números
- [ ] (Opcional) `admin.` no DNS + `ADMIN_HOST` + `AUTH_COOKIE_DOMAIN`
- [ ] `ANTHROPIC_API_KEY`, preços `IA_PRECO_*` conferidos e teto de gasto no console da Anthropic (seção 8)
- [ ] `IA_PROVEDOR_FALSO`, `MP_PROVEDOR_FALSO` e `EMAIL_PROVEDOR` **ausentes** em produção
- [ ] Backup do banco antes do deploy do Ciclo 16
- [ ] Resend: domínio verificado (SPF, DKIM), DMARC criado, webhook cadastrado, e-mail de teste chegando na caixa de entrada (seção 6)
- [ ] `DESCADASTRO_SEGREDO` gerado
- [ ] Mercado Pago testado no sandbox (seção 5) e só então `MP_ACCESS_TOKEN` + `MP_WEBHOOK_SECRET` de produção
- [ ] Assinatura antiga do add-on da IA cancelada no painel do Mercado Pago, se existir
- [ ] Admin → Preços e ofertas conferido; contas internas marcadas como teste interno
- [ ] (Opcional) Meta: pixel + token da API de conversões, `META_CAPI_TESTE` removido depois do teste (seção 7)
- [ ] Plano da Vercel aceita crons de 5 em 5 minutos
