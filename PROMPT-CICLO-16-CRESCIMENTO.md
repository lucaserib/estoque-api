# Ciclo 16 — Usuários, cobrança, créditos de IA, indicação, e-mails e admin comercial

> Cole este arquivo inteiro no Claude Code, na raiz do repositório `estoque-api`. Execute do começo ao fim sem perguntas. Quando houver dúvida, escolha a opção mais segura, registre a decisão em `docs/AUDITORIA-CICLO-16.md` e siga.

---

## 0. Papel, objetivo e regras

Você é o engenheiro sênior responsável por deixar o Skubo pronto para vender: fluxo de usuários sem furos, teste grátis de 7 dias seguido de cobrança, IA vendida em pacotes de perguntas, programa de indicação, e-mails transacionais e de marketing, coleta de dados de clientes com consentimento e um painel admin onde o dono controla preços, ofertas, disparos, indicações, pagamentos e usuários sem precisar de deploy.

### Decisões de negócio já tomadas pelo dono (não reabra)
- **Teste grátis de 7 dias, sem cartão.** Depois disso a conta precisa de assinatura ativa para continuar.
- **Preços iniciais** (todos editáveis no admin): mensal R$ 37,90, primeiro mês R$ 19,70, anual R$ 389,70.
- **IA por pacote de perguntas:** 5 perguntas grátis durante o teste; pacote de **25 perguntas por R$ 29,70**. O admin pode criar outros pacotes. Isso **substitui** o add-on mensal do Ciclo 15.
- **Indicação:** cada indicado que se cadastrar **e pagar** dá **+1 semana grátis** para quem indicou. Valores e regras editáveis no admin.
- **Tudo comercial é controlado no admin:** preços, pacotes, dias de teste, perguntas grátis, regras de indicação, cupons, e-mails, campanhas, usuários, contas, pagamentos.

### Leia antes de escrever código (nesta ordem)
1. `CLAUDE.md`, `docs/AUDITORIA-CICLO-15.md`, `docs/GUIA-DE-CONFIGURACAO.md`
2. Usuários e auth: `src/lib/auth.ts`, `src/helpers/verifyUser.ts`, `src/middleware.ts`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx`, `src/app/api/register/route.ts`, `src/app/api/usuarios/route.ts`, `src/app/api/usuarios/[id]/route.ts`, `src/app/api/usuarios/convites/[id]/route.ts`, `src/app/api/convites/[token]/route.ts`, `src/modules/usuarios/convites.ts`, `src/app/(root)/usuarios/page.tsx`, `src/lib/permissoes.ts`
3. Cobrança: `src/app/(root)/layout.tsx`, `src/app/assinatura/page.tsx`, `src/lib/billing.ts`, `src/lib/subscription.ts`, `src/services/mercadoPagoService.ts`, `src/app/api/mercadopago/*`, `src/app/api/assinatura/ia/*`
4. IA: `src/modules/ia/acesso.ts`, `uso.ts`, `config.ts`, `cobranca.ts`, `limite.ts`, `assistente.ts`, `explicacoes.ts`, `resumoSemanal.ts`, `src/app/api/ia/*`, `src/components/ia/*`
5. Admin: `src/app/admin/*`, `src/components/admin/AdminShell.tsx`, `src/modules/admin/metricas.ts`, `src/app/api/admin/*`, `src/lib/adminPlataforma.ts`, `src/helpers/verifyAdminPlataforma.ts`
6. `prisma/schema.prisma` (modelos `User`, `Invitation`, `Subscription`, `Notification`, `UsoIa`, `MercadoLivreAccount`, `BlingAccount`), `vercel.json`, `env.example`, `src/services/notificationService.ts`, `src/modules/onboarding/etapas.ts`

### Regras de engenharia (valem para todo o ciclo)
- **Sem comentários no código.** O porquê vai para `docs/`. Diretivas `eslint-`/`@ts-` são permitidas.
- **Isolamento por conta:** dado de negócio sempre por `user.contaId`. `user.id` só para autoria, notificação, preferências pessoais e rate limit.
- **Dinheiro em centavos** (`Int`) no banco e na lógica; reais só na borda da UI e na chamada ao Mercado Pago.
- **Toda operação de dinheiro ou crédito é idempotente** (chave única no banco) e roda em transação. Webhook repetido nunca concede duas vezes.
- **Nenhum preço fixo no código.** Preço, pacote, dias e recompensa vêm de `obterConfiguracaoComercial()` (Fase 1). `src/lib/billing.ts` deixa de exportar `PRICING`.
- **Toda ação do admin que muda dado grava auditoria** (Fase 7).
- **Português do Brasil** em tudo que o usuário vê; datas no fuso de São Paulo (`modules/financeiro/dominio/periodo.ts`).
- **Layout responsivo** (1440, 1366, 390), claro e escuro, componentes de `src/components/ui/`.
- Ao fim de cada fase: `npx tsc --noEmit`, `npm run lint`, `npm test` verdes. Não avance com teste quebrado.
- **Uma migração por fase** que mexe no banco, com nome `2026110809xxxx_ciclo16_<fase>`. Depois de cada uma, rode `prisma migrate diff` contra um Postgres descartável e garanta diff vazio. Dados existentes preservados.
- Não faça commit nem push. Deixe tudo para revisão com `git diff`.

---

## Fase 0 — Furos no fluxo de usuários e de acesso (obrigatória, primeiro)

Corrija e cubra com teste cada item:

1. **Assinatura por pessoa em vez de por conta.** `src/app/(root)/layout.tsx` chama `getOrCreateSubscription(session.user.id)`. Membro convidado ganha uma assinatura própria em teste, e quando ela vence ele é mandado para `/assinatura` mesmo com o dono pagando. Troque por `session.user.contaId`. Na migração, apague linhas de `Subscription` de usuários com `contaId` preenchido que não tenham `mpPreapprovalId`, `mpPreapprovalIaId` nem pagamento associado (registre a contagem na auditoria).
2. **Fonte única da situação da conta.** Crie `src/modules/conta/situacao.ts` com `obterSituacaoConta(contaId, agora)` → `{ status: "TESTE" | "ATIVA" | "INADIMPLENTE" | "VENCIDA" | "CANCELADA" | "BLOQUEADA", podeUsar, testeTerminaEm, diasRestantesTeste, periodoTerminaEm, diasDeCredito, donoNome, donoEmail }`. Use em: layout `(root)`, `/assinatura`, `/api/mercadopago/status`, acesso da IA e admin. A assinatura passa a ser criada **no cadastro** (não na primeira visita), com `trialEndsAt` = agora + `diasTeste` da configuração.
3. **API sem trava.** Hoje só o layout bloqueia; as APIs continuam respondendo para conta vencida. Crie `verifyUserAtivo(req)` (mesmo retorno de `verifyUser` + situação) que responde **402** `{ codigo: "ASSINATURA_INATIVA" }` quando `!podeUsar`. Aplique em todas as rotas de `src/app/api/**` exceto a lista liberada: `auth`, `register`, `convites`, `mercadopago`, `assinatura`, `planos`, `perfil`, `email`, `descadastro`, `indicacao` (leitura), `ia/creditos`, `cron`, `admin`, `bling/webhook`, `mercadolivre/webhook`, `usuarios` (GET, para o dono ver a equipe) e exportação de dados LGPD. Escreva um teste que percorre os arquivos `route.ts` e falha se algum fora da lista ainda usa `verifyUser` puro. No cliente, um interceptador de `fetch` (no provider já existente) redireciona para `/assinatura` ao receber 402.
4. **Cron gastando API de conta vencida.** Os crons de sincronização (`bling-sync`, `catalogo-diario`, `financeiro-diario`, `ia-resumo-semanal`) pulam contas sem `podeUsar` há mais de 3 dias. O `bling-refresh` continua (para não perder o token).
5. **Membro de conta vencida vê planos que não pode pagar.** Em `/assinatura`, quem não tem `INTEGRACOES_USUARIOS_ASSINATURA` vê "A assinatura da loja {nome} venceu. Só {donoNome} pode renovar." e um botão **Avisar o responsável** (notificação + e-mail para os ADMIN da conta, no máximo 1 por dia).
6. **Assinar durante o teste perde os dias restantes.** Ao assinar com o teste ainda vigente, crie o preapproval com `auto_recurring.start_date` = `trialEndsAt`, para o cartão ser autorizado agora e a primeira cobrança cair no fim do teste. Confirme o comportamento no sandbox do Mercado Pago e registre na auditoria; se o MP não aceitar, use `free_trial` em dias.
7. **Webhook do Mercado Pago aceita qualquer coisa sem segredo.** Em `production`, sem `MP_WEBHOOK_SECRET` o webhook responde 503 e registra erro; em dev continua aberto.
8. **Login revela se o e-mail existe.** `authorize` em `src/lib/auth.ts` lança mensagens diferentes para "usuário não encontrado", "conta Google" e "senha inválida". Unifique para "E-mail ou senha inválidos" (a tela de login mostra o caso "entre com Google" só se o e-mail tiver conta OAuth, via uma dica neutra depois de 2 falhas). Adicione rate limit de login por IP + e-mail (`checkRateLimit("login", …, 10, 900)`).
9. **Não existe "esqueci minha senha".** Crie `/esqueci-senha` e `/redefinir-senha?token=` com `TokenSenha` (hash SHA-256 do token, expira em 1 h, uso único), e-mail transacional (Fase 2), rate limit, e invalidação das sessões antigas (campo `User.sessaoValidaDesde`; o callback `jwt` derruba tokens emitidos antes dele).
10. **E-mail nunca é verificado.** Adicione `User.emailVerificadoEm`. Contas Google nascem verificadas. Contas com senha recebem e-mail de confirmação; até confirmar, um banner discreto no topo pede a confirmação (não bloqueia o uso). Comprar créditos e indicar exigem e-mail verificado.
11. **Equipe sem remoção.** Hoje não dá para tirar ninguém da equipe. Crie `DELETE /api/usuarios/[id]` (só ADMIN; não remove o dono nem a si mesmo) que desvincula o membro (`contaId = null`, `role = ADMIN`, `sessaoValidaDesde = agora`), grava auditoria e avisa o removido por e-mail. Crie "Sair desta equipe" em `/perfil` para membros. Transferência de propriedade **não** entra neste ciclo (os dados de negócio usam o id do dono); documente e ofereça "promover a ADMIN" como alternativa.
12. **Convite só por link.** O convite passa a ser **enviado por e-mail** (Fase 2) além de copiar link e WhatsApp. Adicione "Reenviar" (renova validade e token), mostre convites expirados com "Renovar", limite de 20 convites pendentes por conta, rate limit de 30 convites/hora por usuário, e e-mail para o ADMIN que convidou quando o convite é aceito.
13. **Limite de usuários por conta.** Respeite `limiteUsuariosPorConta` da configuração (padrão `null` = ilimitado). Ao atingir, o convite responde 409 com mensagem clara.
14. **Usuário bloqueado.** `User.bloqueadoEm`: login recusado e sessão derrubada no próximo recheck do `jwt` (o recheck de 5 min já existe).

---

## Fase 1 — Configuração comercial no banco (fonte única de preços)

- Modelo `ConfiguracaoComercial` versionado: `id`, `versao` (Int, crescente), `vigenteDesde`, `criadaPor` (e-mail do admin), `observacao`, e os campos:
  - `diasTeste` (7), `precoMensalCentavos` (3790), `precoPrimeiroMesCentavos` (1970, nulo = sem promoção), `precoAnualCentavos` (38970)
  - `iaPerguntasTeste` (5), `iaValidadeDiasTeste` (14, contados do início do teste), `iaValidadeDiasCompra` (365)
  - `iaPacotes` (Json validado por zod): `[{ id, nome, perguntas, precoCentavos, ativo, destaque }]` → inicial `[{ id: "pacote-25", nome: "25 perguntas", perguntas: 25, precoCentavos: 2970, ativo: true, destaque: true }]`
  - `iaPesoPorRecurso` (Json): `{ CHAT: 1, ANALISE_CONTROLE: 1, EXPLICACAO: 0, RESUMO_SEMANAL: 0 }` e `iaExplicacoesGratisPorDia` (20)
  - `iaResumoSemanalSoAssinantes` (true)
  - `indicacao` (Json): `{ ativo: true, diasRecompensa: 7, carenciaDias: 7, limiteRecompensasPorAno: 52, exigeMlConectado: true, bonusIndicado: { perguntasIa: 5, diasTesteExtra: 0 } }`
  - `limiteUsuariosPorConta` (nulo)
  - `textosOferta` (Json): títulos e benefícios mostrados em `/planos` e `/assinatura`
- `src/modules/comercial/configuracao.ts`: `obterConfiguracaoComercial()` (última versão, cache de 60 s em memória/Upstash), `salvarConfiguracaoComercial(dados, adminEmail)` (cria **nova versão**, nunca edita a anterior; valida com zod: preços > 0, primeiro mês ≤ mensal, anual ≤ 12× mensal, pacotes com id único). Seed da versão 1 com os valores atuais.
- `Subscription` ganha `precoContratadoCentavos` e `configuracaoVersao` (o preço que o cliente aceitou). Mudança de preço vale só para novas assinaturas.
- **Reajuste de assinantes existentes** é uma ação explícita do admin: escolhe novo valor e data (mínimo 30 dias à frente), o sistema manda e-mail de aviso a todos os afetados e um cron aplica `updatePreapprovalAmount` na data. Tudo auditado.
- **Cupons** (`Cupom`: `codigo` único maiúsculo, `tipo` PERCENTUAL|FIXO, `valor`, `alvo` PRIMEIRA_COBRANCA_MENSAL|ANUAL|PACOTE_IA, `usosMaximos`, `usos`, `validoAte`, `ativo`; `UsoCupom` com `contaId` único por cupom). Cupom aplicado no checkout ajusta o valor da primeira cobrança (mesmo padrão já usado para o primeiro mês: cobra o valor com desconto e, no primeiro pagamento aprovado, volta ao preço contratado).
- Rota pública `GET /api/planos` (sem auth, cache 60 s) com preços, pacotes ativos e textos, e página pública `/planos` fora do grupo `(root)` (libere no middleware), com CTA para `/register` preservando UTM e código de indicação.
- Substitua todo uso de `PRICING` (`grep -rn PRICING src`) por leitura da configuração.

---

## Fase 2 — Infraestrutura de e-mail (Resend)

- Dependências: `resend` (SDK) e, se quiser templates em React, `@react-email/components`. Nada além disso.
- `src/modules/email/`:
  - `provedor.ts`: interface `ProvedorEmail` com implementação Resend e implementação `console` (padrão em dev/test, ou `EMAIL_PROVEDOR=console`). Envio em lote usando a API de batch do Resend quando houver mais de um destinatário.
  - `enviar.ts`: `enviarEmail({ para, modelo, dados, categoria, contaId?, userId?, chaveIdempotencia, campanhaId? })`. Categorias: `TRANSACIONAL` (sempre envia, salvo supressão por bounce/reclamação), `CICLO_DE_VIDA` (respeita descadastro do ciclo de vida) e `MARKETING` (exige consentimento de marketing registrado). Grava `EmailEnviado` antes de enviar; `chaveIdempotencia` única impede duplicata em reexecução de cron.
  - `layout.ts`: layout único com a marca (logo `public/brand/skubo`, cores e fontes do app, versão texto puro sempre gerada), largura 600 px, legível no modo escuro dos clientes de e-mail, rodapé com endereço, motivo do recebimento e link de descadastro (exceto transacional).
  - `modelos/`: um arquivo por modelo, com assunto, pré-cabeçalho, HTML e texto. Transacionais: confirmar e-mail, redefinir senha, convite de equipe, convite aceito (para quem convidou), membro removido, boas-vindas, recibo de pagamento de assinatura, recibo de compra de créditos, falha de pagamento, teste terminando (D-2), teste terminou, assinatura cancelada, aviso de reajuste, renovação anual próxima (D-15), indicação: amigo entrou / recompensa liberada, créditos de IA acabando (≤ 3) e esgotados, aviso ao responsável (Fase 0 item 5).
- Cabeçalhos obrigatórios em `CICLO_DE_VIDA` e `MARKETING`: `List-Unsubscribe: <https://…/api/descadastro?t=…>, <mailto:…>` e `List-Unsubscribe-Post: List-Unsubscribe=One-Click`. O POST de um clique descadastra sem login. Página `/descadastro?t=` mostra o que foi desligado e permite escolher categorias.
- Token de descadastro assinado com HMAC (`DESCADASTRO_SEGREDO`), sem expiração, carregando `userId` + categoria.
- Modelos de banco: `EmailEnviado` (`id`, `userId?`, `contaId?`, `para`, `modelo`, `categoria`, `campanhaId?`, `chaveIdempotencia` único, `provedorId?`, `status` ENFILEIRADO|ENVIADO|ENTREGUE|ABERTO|CLICADO|DEVOLVIDO|RECLAMACAO|FALHOU|SUPRIMIDO, `erro?`, `abertoEm?`, `clicadoEm?`, `createdAt`), `SupressaoEmail` (`email` único, `motivo` DEVOLUCAO|RECLAMACAO|DESCADASTRO_TOTAL|MANUAL, `createdAt`).
- Webhook `POST /api/email/webhook`: verifica a assinatura do Resend (cabeçalhos `svix-*`, segredo `RESEND_WEBHOOK_SECRET`; confira o formato na documentação do Resend), atualiza `EmailEnviado` e cria supressão em hard bounce e reclamação.
- Fila: `EmailEnviado` com status `ENFILEIRADO` é processado pelo cron `GET /api/cron/email-fila` (a cada 5 min, lotes de até 100, orçamento de 45 s). Transacionais urgentes (senha, convite, confirmação) enviam na hora, sem esperar a fila.
- Variáveis: `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `EMAIL_REMETENTE` (ex.: `Skubo <ola@skubo.com.br>`), `EMAIL_RESPONDER_PARA`, `EMAIL_PROVEDOR`, `DESCADASTRO_SEGREDO`, `NEXT_PUBLIC_APP_URL`, `EMPRESA_ENDERECO_RODAPE`.

---

## Fase 3 — Dados de clientes, consentimento e atribuição (LGPD)

- **Cadastro coleta** (`/register`): nome, e-mail, senha, **WhatsApp** (opcional, validado e salvo em E.164), **nome da loja**, **pedidos por mês** (faixas: até 30, 31–200, 201–700, 701–1.500, mais de 1.500), **onde vende** (Mercado Livre, Shopee, Amazon, loja própria, outros — múltipla escolha), **como conheceu** (Instagram, YouTube, indicação, Google, grupo de WhatsApp, outro), **código de indicação** (pré-preenchido pelo link) e duas caixas: aceite de **Termos e Política de Privacidade** (obrigatória) e **"Quero receber novidades e ofertas por e-mail e WhatsApp"** (opcional, **desmarcada** por padrão). Formulário em 2 passos no mobile para não assustar.
- Quem entra pelo Google cai em `/boas-vindas` (fora do `(root)`, liberado no middleware) para completar os mesmos campos antes de seguir para `/comecar`.
- Modelos:
  - `PerfilCliente` (1 por conta, `contaId` único): `nomeLoja`, `whatsapp?`, `faixaPedidosMes?`, `canais String[]`, `comoConheceu?`, `utmSource?`, `utmMedium?`, `utmCampaign?`, `utmContent?`, `utmTerm?`, `paginaEntrada?`, `referrer?`, `primeiroToqueEm?`, `codigoIndicacao` (único, gerado na criação, formato legível `SKU-XXXX`), `testeInterno Boolean @default(false)` (exclui da métrica).
  - `ConsentimentoRegistro` (append-only): `userId`, `tipo` TERMOS|PRIVACIDADE|MARKETING_EMAIL|MARKETING_WHATSAPP|CICLO_DE_VIDA, `concedido`, `versaoTexto`, `origem` (cadastro, perfil, descadastro, admin), `ip`, `userAgent`, `createdAt`.
  - `User.preferencias` (Json validado): estado atual de cada consentimento (derivado do último registro).
- **Atribuição de primeiro toque:** um script leve no `(auth)/layout.tsx` e em `/planos` lê `utm_*`, `ref`, `document.referrer` e a página de entrada e grava o cookie primário `skubo_origem` (60 dias, `SameSite=Lax`) só se ainda não existir. O cadastro lê o cookie e grava no `PerfilCliente`. `GET /r/[codigo]` grava o código de indicação no mesmo cookie e redireciona para `/register?ref=codigo`.
- **Eventos de produto** `EventoProduto` (`contaId`, `userId?`, `nome`, `propriedades Json?`, `createdAt`, índice `(contaId, nome)`): `CONTA_CRIADA`, `EMAIL_VERIFICADO`, `ML_CONECTADO`, `BLING_CONECTADO`, `PRIMEIRA_SINCRONIZACAO`, `PRIMEIRA_REPOSICAO_VISTA`, `PRIMEIRA_PERGUNTA_IA`, `CONVITE_ENVIADO`, `ASSINOU`, `PAGAMENTO_FALHOU`, `CANCELOU`, `COMPROU_CREDITOS`, `INDICOU`, `TESTE_TERMINOU`. Função única `registrarEvento()` chamada nos pontos onde essas coisas já acontecem (reaproveite `modules/onboarding/etapas.ts` quando já detectar a etapa). Nunca bloqueia o fluxo principal.
- **Meta Conversions API (opcional, desligada sem env):** `src/modules/marketing/metaCapi.ts` envia `CompleteRegistration` (cadastro), `StartTrial`, `Subscribe` (primeiro pagamento), `Purchase` (créditos de IA) com e-mail/telefone em SHA-256, `event_id` igual ao do Pixel para deduplicação, **somente se o consentimento de marketing estiver concedido**. Variáveis `META_PIXEL_ID`, `META_CAPI_TOKEN`. Pixel no navegador só nas páginas públicas e só depois do aceite no banner de cookies (crie um banner simples com "Aceitar" / "Só essenciais", gravando a escolha).
- **Direitos do titular:** em `/perfil`, "Baixar meus dados" (JSON com perfil, consentimentos, e-mails enviados, eventos) e "Pedir exclusão da conta" (cria solicitação que o admin executa na Fase 7).
- **Páginas legais** públicas: `/termos`, `/privacidade`, `/indique/regulamento`, renderizadas a partir de `docs/juridico/termos.md`, `privacidade.md`, `regulamento-indicacao.md`. Escreva rascunhos completos e claros (incluindo o processamento pela Anthropic no recurso de IA, Mercado Pago como processador de pagamento, Resend como envio de e-mail, Meta quando houver consentimento), com uma linha no topo "Rascunho — revisar com advogado antes de publicar". A `versaoTexto` dos consentimentos é a data do arquivo.

---

## Fase 4 — Créditos de IA (substitui o add-on mensal)

- Modelos:
  - `LoteCreditoIa`: `id`, `contaId`, `origem` TESTE|COMPRA|INDICACAO|BONUS_ADMIN|MIGRACAO, `quantidadeInicial`, `quantidadeRestante`, `validoAte`, `compraId?`, `indicacaoId?`, `createdAt`; índice `(contaId, validoAte)`.
  - `MovimentoCreditoIa` (extrato append-only): `contaId`, `autorId?`, `loteId?`, `tipo` ENTRADA|CONSUMO|ESTORNO|EXPIRACAO|AJUSTE, `quantidade` (+/−), `saldoApos`, `recurso?`, `usoIaId?`, `descricao`, `chaveIdempotencia` único, `createdAt`.
  - `CompraCreditoIa`: `id`, `contaId`, `autorId`, `pacoteId`, `perguntas`, `precoCentavos`, `cupomId?`, `status` PENDENTE|APROVADA|RECUSADA|ESTORNADA|EXPIRADA, `mpPreferenceId?`, `mpPaymentId?` único, `createdAt`, `aprovadaEm?`.
- `src/modules/ia/creditos.ts`:
  - `saldoCreditos(contaId, agora)` = soma de `quantidadeRestante` dos lotes válidos.
  - `debitarCreditos(contaId, quantidade, recurso, chave)` em transação, consumindo primeiro o lote que vence antes, com trava de linha (`SELECT … FOR UPDATE` via `$queryRaw` ou `updateMany` condicional em laço) para duas perguntas simultâneas nunca deixarem saldo negativo.
  - `estornarCreditos(chave)` devolve exatamente o que aquela chave debitou.
  - `concederLote(...)` idempotente.
  - Cron diário `ia-creditos-expiracao`: registra `EXPIRACAO` dos lotes vencidos com sobra.
- **Regras de acesso (reescreva `acesso.ts`):** a IA está liberada quando `obterSituacaoConta().podeUsar` **e** (saldo > 0 **ou** liberação `MANUAL`/`ENV`, que contam como ilimitado). O orçamento de custo do Ciclo 15 (`iaOrcamentoCentavos`, `IA_ORCAMENTO_MENSAL_CENTAVOS`) continua como **trava de segurança contra abuso**, não como produto.
- **Consumo:** antes de cada pergunta do assistente, debite `iaPesoPorRecurso.CHAT`; se o provedor falhar antes de qualquer texto (o Ciclo 15 já descarta a pergunta nesse caso), estorne. Análise da Central debita `ANALISE_CONTROLE`. Explicações rápidas com peso 0 ficam limitadas a `iaExplicacoesGratisPorDia` por conta; acima disso passam a custar 1. Resumo semanal é grátis para assinantes pagantes (`iaResumoSemanalSoAssinantes`).
- **Teste:** na criação da conta, conceda o lote `TESTE` com `iaPerguntasTeste`, validade `iaValidadeDiasTeste`.
- **Compra (Mercado Pago Checkout Pro, pagamento único):** `POST /api/ia/creditos/comprar { pacoteId, cupom? }` (exige e-mail verificado e conta com `podeUsar`) cria `CompraCreditoIa` PENDENTE e uma preferência (`POST /checkout/preferences`) com o item, `external_reference: "credito-ia:<compraId>"`, `notification_url` do webhook existente, `back_urls` para `/ia?compra=<id>`, Pix e cartão liberados, expiração em 24 h. Devolve `init_point`. No webhook `/api/mercadopago/webhook`, pagamento com esse prefixo → `processarPagamentoCreditos`: aprovado → `APROVADA` + lote `COMPRA` + e-mail de recibo + notificação + `EventoProduto`; recusado → `RECUSADA`; estornado/chargeback → `ESTORNADA` e remove o restante daquele lote (nunca saldo negativo). Idempotente por `mpPaymentId`.
- `GET /api/ia/creditos` → saldo, lotes com validade, extrato paginado, pacotes ativos.
- **UI:** saldo no cabeçalho do assistente ("12 perguntas"), estado "sem perguntas" com os pacotes e botão Comprar (abre o checkout em nova aba e volta com confirmação), card do Skubo IA em `/assinatura` e em `/ajustes` com pacotes, saldo, extrato e validade. Ao chegar a 3 perguntas, aviso discreto. Volta do checkout com `?compra=` faz polling de `GET /api/ia/creditos` até a compra aprovar (máx. 60 s) e mostra sucesso.
- **Migração do add-on mensal:** confirme no banco quantas `Subscription` têm `iaStatus = ATIVA` ou `mpPreapprovalIaId` preenchido. Para cada uma: cancele o preapproval no MP, conceda um lote `MIGRACAO` de 25 perguntas com validade de 365 dias e registre na auditoria. Remova as rotas `api/assinatura/ia/assinar`, `cancelar` e `teste` (e o código de `modules/ia/cobranca.ts` que fica sem uso), mantendo os campos no banco para histórico. Atualize o admin (`/admin/contas`) para mostrar saldo de créditos em vez de status de add-on.

---

## Fase 5 — Programa de indicação

- Modelos:
  - `Indicacao`: `id`, `indicadorContaId`, `indicadoContaId` **único**, `codigo`, `status` CADASTRADO|ATIVADO|PAGOU|EM_CARENCIA|RECOMPENSADA|INVALIDADA, `motivoInvalidacao?`, `pagamentoId?`, `diasRecompensa`, `createdAt`, `ativadoEm?`, `pagouEm?`, `recompensadaEm?`.
  - `CreditoDiasAssinatura`: `id`, `contaId`, `dias`, `origem` INDICACAO|ADMIN|CUPOM, `indicacaoId?`, `forma` EXTENSAO_TESTE|DESCONTO_PROXIMA_COBRANCA|CICLO_PAUSADO|EXTENSAO_ANUAL|PENDENTE, `aplicadoEm?`, `detalhe Json?`, `createdAt`.
- **Fluxo:** cadastro com código → `Indicacao` CADASTRADO e o indicado recebe o `bonusIndicado` (padrão: +5 perguntas de IA num lote `INDICACAO`) → ao conectar o Mercado Livre vira ATIVADO (se `exigeMlConectado`) → primeiro pagamento de assinatura aprovado vira PAGOU/EM_CARENCIA → depois de `carenciaDias` sem estorno ou chargeback, o cron `indicacoes` concede a recompensa e marca RECOMPENSADA → e-mail + notificação para quem indicou.
- **Antifraude** (invalida com motivo, nunca em silêncio): autoindicação (mesma conta, mesmo e-mail, mesmo WhatsApp, mesmo e-mail pagador do MP, mesmo `blingCompanyId` de alguma conta do indicador); conta de Mercado Livre do indicado igual a alguma já ligada ao indicador (o `mlUserId` já é único globalmente, use também o histórico); mais de `limiteRecompensasPorAno` recompensas no ano; indicado com `testeInterno`; estorno durante a carência. O admin pode aprovar manualmente uma indicação invalidada.
- **Aplicar a recompensa** (`src/modules/indicacao/recompensa.ts`, uma função por situação, todas com teste):
  - Conta em **teste** → soma os dias em `trialEndsAt` (`EXTENSAO_TESTE`).
  - Conta **mensal ativa no MP** → acumula. Um cron diário lê `next_payment_date` do preapproval (`GET /preapproval/{id}`; confirme o nome do campo na resposta real). Faltando até 3 dias para a cobrança: desconto = `round(precoContratado × dias / 30)`. Se o desconto for menor que o preço, faz `updatePreapprovalAmount(preço − desconto)` e, no webhook do pagamento aprovado daquele ciclo, volta ao `precoContratadoCentavos` (`DESCONTO_PROXIMA_COBRANCA`). Se os dias acumulados cobrirem um ciclo inteiro (≥ 30), **pausa** o preapproval (`status: paused`), estende `currentPeriodEnd` em 30 dias e o cron **reativa** no fim do período (`CICLO_PAUSADO`). Antes de usar, confirme no sandbox o valor mínimo aceito pelo MP numa assinatura e o comportamento de pausar/reativar; se o mínimo impedir o desconto, guarde os dias até completar 30 e use a pausa. Registre o que achou na auditoria.
  - Conta **anual** → estende `currentPeriodEnd` e aplica o desconto proporcional (dias/365) na renovação (`EXTENSAO_ANUAL`).
  - Conta sem assinatura ativa (vencida) → fica `PENDENTE` e é aplicada assim que assinar.
- **Tela `/indique`** (item na Sidebar com selo "Ganhe semanas grátis"): link `https://…/r/<codigo>` com botão copiar, botão WhatsApp com mensagem pronta e editável ("Uso o Skubo pra controlar estoque, Full e lucro do Mercado Livre. Com meu link você ganha 5 perguntas extras pra IA: …"), contador "você já ganhou N semanas", próxima cobrança com o desconto previsto, lista das indicações com nome mascarado ("Lo** St***"), status em linguagem simples e motivo quando invalidada, e link para o regulamento.
- **Momentos de pedir indicação** (um card discreto que some por 30 dias ao fechar): depois da primeira sincronização concluída, depois do primeiro resumo semanal, no 3º login da semana, e na tela de sucesso de pagamento.

---

## Fase 6 — Ciclo de vida automatizado

- Modelo `AutomacaoEmail`: `chave` única, `ativo`, `atrasoHoras`, `assunto`, `preCabecalho`, `corpoMarkdown` (editáveis no admin), `categoria`, `atualizadoPor`, `updatedAt`. Os **gatilhos** ficam no código (`src/modules/email/automacoes.ts`), o **texto** fica no banco (seed com textos prontos, em português, curtos e diretos).
- Cron `GET /api/cron/ciclo-de-vida` (de hora em hora, orçamento de 45 s) avalia as contas elegíveis e enfileira com chave de idempotência `<chave>:<contaId>`:

| Chave | Quando | Para quem |
|---|---|---|
| `boas-vindas` | na criação | dono |
| `conectar-ml` | 24 h sem `ML_CONECTADO` | dono |
| `conectar-bling` | 48 h com ML e sem Bling | dono |
| `primeira-reposicao` | 72 h com sincronização e sem `PRIMEIRA_REPOSICAO_VISTA` | dono |
| `ia-perguntas-gratis` | dia 4 do teste sem `PRIMEIRA_PERGUNTA_IA` | dono |
| `teste-acabando` | 2 dias antes de `trialEndsAt` | dono |
| `teste-terminou` | no dia seguinte ao fim, sem assinatura | dono |
| `volte-3` / `volte-14` | 3 e 14 dias após o fim, sem assinatura (pode carregar cupom configurado no admin) | dono |
| `pagamento-falhou` | no evento e 3 dias depois, se continuar | dono |
| `cancelou` | no cancelamento, com pesquisa de motivo de 1 clique | dono |
| `renovacao-anual` | 15 dias antes | dono |
| `creditos-acabando` / `creditos-esgotados` | saldo ≤ 3 / = 0 | quem perguntou por último + dono |
| `indicacao-entrou` / `indicacao-recompensa` | eventos da Fase 5 | indicador |

- Cada envio também cria a notificação equivalente no app quando fizer sentido.
- A pesquisa de cancelamento grava `MotivoCancelamento` (`contaId`, `motivo` PRECO|FALTOU_RECURSO|DIFICIL|PAROU_DE_VENDER|OUTRA_FERRAMENTA|OUTRO, `comentario?`).

---

## Fase 7 — Admin comercial completo (`/admin`)

Reorganize o `AdminShell` em: **Visão geral · Contas · Usuários · Assinaturas e pagamentos · Créditos de IA · Indicações · E-mails e campanhas · Preços e ofertas · Auditoria · IA** (a página de IA do Ciclo 15 continua). Tudo protegido por `verifyAdminPlataforma`; tudo responsivo.

1. **Visão geral** — funil do mês (cadastros → e-mail verificado → ML conectado → primeira reposição → assinou), conversão teste→pago por coorte semanal, **MRR real** (pagamentos aprovados de assinatura, não estimativa), ARR, churn mensal (logo e receita), ARPA, receita de créditos de IA e margem (receita − custo estimado de `UsoIa`), cadastros e assinaturas por origem (`utmSource`, `comoConheceu`, indicação), fator de indicação (indicações pagas ÷ assinantes). Exclui contas `testeInterno`.
2. **Contas** — lista com busca e filtros (situação, plano, origem, ML/Bling conectado, saldo IA, cadastro entre datas) e **página de detalhe** `/admin/contas/[id]` com: perfil e origem, membros, situação e assinatura, pagamentos, créditos e extrato, indicações feitas/recebidas, e-mails enviados, eventos de produto, consentimentos, motivos de cancelamento. Ações (cada uma com confirmação e motivo obrigatório, todas auditadas): estender teste (dias), conceder dias de assinatura, conceder créditos de IA, liberar IA ilimitada (manual), aplicar cupom, cancelar assinatura no MP, marcar/desmarcar teste interno, bloquear/desbloquear, reenviar e-mail, executar pedido de exclusão (LGPD, exige digitar o e-mail do dono; apaga em cascata e registra só o id na auditoria).
3. **Usuários** — busca global por e-mail/nome, conta a que pertence, papel, verificado, último login (grave `User.ultimoLoginEm` no `jwt`), ações: enviar redefinição de senha, reenviar confirmação, bloquear.
4. **Assinaturas e pagamentos** — novo `PagamentoPlataforma` gravado pelo webhook para **todo** pagamento do MP (`mpPaymentId` único, `contaId`, `tipo` ASSINATURA|CREDITO_IA, `valorCentavos`, `status`, `metodo`, `aprovadoEm`, `bruto Json` sem dados de cartão). Lista com filtros e exportação CSV; estorno de compra de créditos pelo MP (`POST /v1/payments/{id}/refunds`) com confirmação; assinaturas por status com próxima cobrança.
5. **Créditos de IA** — pacotes vendidos, receita, perguntas consumidas, custo estimado por pergunta (de `UsoIa`), margem por pacote, contas com saldo parado.
6. **Indicações** — lista com status e motivos, aprovar/invalidar manualmente, ranking de quem mais indica, dias concedidos, custo do programa em receita adiada.
7. **E-mails e campanhas**
   - **Automações:** lista da Fase 6 com liga/desliga, edição de assunto/pré-cabeçalho/corpo (markdown com variáveis `{{nome}}`, `{{loja}}`, `{{link_indicacao}}`, `{{dias_teste}}`, `{{saldo_ia}}`, `{{link_planos}}`), pré-visualização desktop/mobile e "Enviar teste para mim".
   - **Campanhas:** `Campanha` (`nome`, `assunto`, `preCabecalho`, `corpoMarkdown`, `segmento Json`, `categoria` MARKETING|CICLO_DE_VIDA, `status` RASCUNHO|AGENDADA|ENVIANDO|ENVIADA|CANCELADA, `agendadaPara?`, contadores). Construtor de segmento com filtros (situação da conta, plano, dias desde o cadastro, ML/Bling conectado, comprou créditos, saldo IA, origem/UTM, faixa de pedidos, canais, consentimento) mostrando **o tamanho do público antes de enviar**. Campanha de MARKETING só alcança quem tem consentimento de marketing. Envio pela fila, métricas (enviados, entregues, abertos, cliques, descadastros, devoluções) vindas do webhook.
   - **Gerar com IA:** botão no editor que manda um briefing curto para o núcleo de IA do Ciclo 15 (novo `RecursoIa.MARKETING_ADMIN`, cobrado da plataforma, nunca dos créditos de cliente) e devolve 5 assuntos, 1 pré-cabeçalho e 1 corpo seguindo `docs/marketing/voz-da-marca.md` (crie esse arquivo com tom de voz, público, proibições e exemplos). Revisão humana sempre; nada é enviado sem clique.
   - **Supressões:** lista, busca, remover supressão manual.
   - **Contatos para anúncios:** exportação CSV dos contatos **com consentimento de marketing** (e-mail, telefone, nome, situação) para subir como público personalizado no Meta.
8. **Preços e ofertas** — formulário da `ConfiguracaoComercial` com validação, pré-visualização da página `/planos` e da tela `/assinatura`, histórico de versões com diferença entre elas, gestão de cupons, fluxo de reajuste de assinantes (Fase 1) com contagem de afetados e prévia do e-mail.
9. **Auditoria** — `AuditoriaAdmin` (`adminEmail`, `acao`, `alvoTipo`, `alvoId`, `antes Json?`, `depois Json?`, `motivo?`, `ip`, `createdAt`) com filtros. Escrita por um helper `auditar()` chamado em toda rota `api/admin/**` que muda dado; teste que falha se alguma rota mutável do admin não chamar `auditar`.

---

## Fase 8 — Testes

Unitários (Vitest, em `__tests__/` ao lado do código):
- Fase 0: situação da conta para dono e membro; layout usando `contaId`; trava 402 (e o teste que varre as rotas); remoção de membro; redefinição de senha (token expirado, reuso, sessões antigas derrubadas); login sem enumeração; webhook do MP fechado em produção sem segredo.
- Configuração comercial: validação, versões, leitura com cache, cupom aplicado só uma vez por conta.
- E-mail: idempotência, categorias × consentimento × supressão, token de descadastro, webhook com assinatura válida e inválida, cabeçalhos de descadastro.
- Créditos: débito concorrente (duas perguntas ao mesmo tempo com saldo 1 → só uma passa), FIFO por validade, estorno, expiração, compra aprovada/recusada/estornada/repetida, acesso da IA com saldo zero.
- Indicação: cada regra antifraude, carência, cada forma de recompensa (teste, mensal com desconto, mensal com pausa, anual, pendente), limite anual.
- Ciclo de vida: cada gatilho dispara uma vez e respeita descadastro.
- Admin: auditoria obrigatória, métricas (MRR real, conversão por coorte) com dados fixos.

E2E (Playwright, `e2e/08-crescimento.spec.ts`, com `EMAIL_PROVEDOR=console` e MP simulado por um provedor falso ativado só em teste):
- Cadastro completo com UTM e código de indicação → `/comecar`; o indicador vê a indicação em `/indique`.
- Convite por e-mail (verifica o e-mail no log do provedor console), aceite, remoção do membro.
- Esqueci a senha → redefinir → entrar.
- Conta com teste vencido: dono vê planos; membro vê "Avisar o responsável"; API responde 402.
- Assistente com 0 perguntas mostra pacotes; compra simulada aprovada credita 25.
- Admin: alterar preço do mensal e ver refletido em `/planos`; criar campanha, ver tamanho do público, enviar teste.
- Mobile 390: cadastro em 2 passos, `/indique` e card de créditos.

---

## Fase 9 — Documentação e go-live

1. `CLAUDE.md`: novas fontes da verdade — **situação da conta** (`modules/conta/situacao.ts`), **configuração comercial** (banco, versionada; nenhum preço no código), **créditos de IA** (lotes + extrato), **indicação**, **e-mail** (categorias e consentimento), **eventos de produto**, **auditoria do admin**. Atualize "Ciclo atual" e as variáveis de ambiente.
2. `env.example` com todas as variáveis novas.
3. `vercel.json` com os crons novos: `email-fila` (a cada 5 min), `ciclo-de-vida` (de hora em hora), `indicacoes` (diário), `ia-creditos-expiracao` (diário), `reajustes` (diário), `assinaturas-recompensas` (diário).
4. `docs/MANUAL-DO-USUARIO.md` e `/ajuda/manual`: Equipe (convidar, remover, papéis), Assinatura e teste, Créditos de IA, Indique e ganhe.
5. `docs/GUIA-DE-CONFIGURACAO.md`: Resend (conta, domínio, registros SPF/DKIM/DMARC, webhook), Mercado Pago (credenciais de produção, webhook com segredo, teste no sandbox de assinatura, Checkout Pro e estorno), Meta (Pixel/CAPI opcional), primeiro acesso ao admin para revisar preços, textos dos e-mails e regulamento.
6. `docs/AUDITORIA-CICLO-16.md`: o que foi feito por fase, decisões tomadas sozinho, o que foi confirmado no sandbox do MP (start_date no teste, valor mínimo, pausar/reativar, campo da próxima cobrança), riscos e próximos passos.
7. Bateria final, com os números no relatório: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e` (Postgres descartável, conforme o CLAUDE.md).

### Checklist de go-live (no fim da auditoria, com caixas)
- [ ] Backup do banco de produção e ensaio das migrações numa cópia restaurada antes do deploy.
- [ ] Resend: domínio verificado (SPF, DKIM, DMARC), `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `EMAIL_REMETENTE`, webhook apontando para `/api/email/webhook`.
- [ ] Mercado Pago produção: `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, webhook com eventos de pagamento e assinatura; uma assinatura real de R$ 19,70 feita e cancelada; uma compra real de pacote de IA feita e estornada pelo admin.
- [ ] `DESCADASTRO_SEGREDO`, `NEXT_PUBLIC_APP_URL`, `EMPRESA_ENDERECO_RODAPE` definidos.
- [ ] Textos de `/termos`, `/privacidade` e `/indique/regulamento` revisados por advogado.
- [ ] Preços, pacotes e regras de indicação conferidos no admin (versão 1).
- [ ] Teste de fumaça: cadastro com indicação, convite por e-mail, esqueci a senha, compra de créditos, campanha de teste para o próprio e-mail, descadastro em um clique.

---

## Ordem se o tempo apertar

**0 → 1 → 2 → 4 → 3 → 5 → 7 (itens 1, 2, 4, 8, 9) → 6 → 7 (resto) → 8 → 9.**
Nada pode ir para produção pela metade: o que ficar de fora fica escondido atrás de configuração e registrado na auditoria.

## Relatório final

Responda em português com: o que mudou por área, números da bateria de testes, decisões tomadas sozinho, o que foi confirmado no sandbox do Mercado Pago, o que eu preciso configurar antes do deploy e os riscos conhecidos. Não faça commit.
