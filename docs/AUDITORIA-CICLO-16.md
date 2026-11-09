# Auditoria — Ciclo 16 (usuários, cobrança, créditos de IA, indicação, e-mails e admin comercial)

Plano: `PROMPT-CICLO-16-CRESCIMENTO.md`. Nada foi commitado; tudo fica para revisão com `git diff`.

**Resumo.** As Fases 0 a 9 estão implementadas. Oito migrações aditivas (`20261108090100` a `20261108090800`), conferidas com `prisma migrate diff` (vazio) e aplicadas numa cópia do banco de produção. Bateria final: `tsc` sem erros, `npm run lint` limpo, Vitest **178 arquivos / 1062 testes** passando (com `TESTE_BANCO_URL` apontado para um Postgres descartável, o teste de concorrência dos créditos roda contra banco real), `npm run build` ok e Playwright **29 passando, 0 falhando** (31 pulados de propósito por viewport) nas três resoluções.

## Decisões tomadas sozinho

| Decisão | Por quê |
|---|---|
| **Cobrança só bloqueia quando o Mercado Pago está configurado** (`cobrancaObrigatoria()` em `modules/conta/situacao.ts`; `COBRANCA_OBRIGATORIA=1` força, `=0` desliga) | Produção ainda não tem `MP_ACCESS_TOKEN`. Bloquear sem ter como pagar trancaria todas as lojas do lado de fora. A situação (TESTE, VENCIDA…) é calculada sempre; só o `podeUsar` ignora o vencimento enquanto não há cobrança. Conta **bloqueada pelo admin** é bloqueada sempre. |
| Inadimplente tem **5 dias de tolerância** depois do fim do período pago | O Mercado Pago tenta cobrar de novo nesses dias; cortar no primeiro recusado derruba a operação de quem só teve o cartão recusado uma vez. |
| Cancelada continua usando **até o fim do período pago** | Era o que a tela prometia ("você perde o acesso ao final do período"), mas o código bloqueava na hora. |
| Dica de login depois de 2 falhas é **neutra** (aparece para qualquer e-mail) | O plano pedia mostrar "entre com Google" só se o e-mail tivesse conta OAuth, mas isso revelaria que o e-mail existe. Mostrar sempre não vaza nada. |
| Rate limit cai para um **contador no banco** (`ContadorLimite`) quando não há Upstash, em produção | Sem Redis o `checkRateLimit` liberava tudo — login, cadastro, senha e convites ficavam sem limite. Janela fixa, `INSERT … ON CONFLICT`, falha aberta se o banco falhar. Desligável com `RATE_LIMIT_BANCO=0`. Limpeza no cron `ia-limpeza`. |
| `verifyUserAtivo` faz **cache de 30 s** da situação por conta (por instância) | Evita uma consulta extra em toda chamada de API. Webhook do MP, assinatura e redefinição invalidam o cache da conta. |
| A trava 402 entrou em **130 rotas** por um codemod sobre a árvore sintática do TypeScript (não por busca de texto): troca `verifyUser` → `verifyUserAtivo` e garante `permissaoErrorResponse(erro)` no `catch` que envolve a chamada | As rotas tinham 4 estilos de tratamento de erro; 66 devolviam 500 para qualquer erro. `permissaoErrorResponse` agora responde 403 (papel), **402** (`codigo: "ASSINATURA_INATIVA"`) e 401 (usuário bloqueado). |
| Callback OAuth do Bling (`bling/auth/callback`) ficou na lista liberada | É um redirecionamento do OAuth, não uma API JSON; a página de destino já é barrada pelo layout. |
| Testes de rota continuam simulando `verifyUser`: um **setup global do Vitest** (`src/test/setup.ts`) faz `verifyUserAtivo` delegar ao `verifyUser` simulado com a conta liberada | Evita reescrever ~110 arquivos de teste; o teste do próprio `verifyUserAtivo` usa a implementação real (`vi.unmock`). |
| Sessão derrubada usa um carimbo próprio `token.emitidoEm` (gravado no login), não o `iat` do JWT | O NextAuth reemite o JWT (com `iat` novo) a cada leitura de sessão, então o `iat` não diz quando a pessoa entrou. Tokens antigos sem `emitidoEm` caem se a pessoa tiver um `sessaoValidaDesde`. |
| Membro removido (ou que sai) vira **dono de uma conta nova vazia**, com teste grátis | É o que acontece com quem se cadastra; o login dele continua valendo. Transferência de propriedade não entra neste ciclo (os dados de negócio usam o id do dono); a alternativa documentada é promover alguém a ADMIN. |
| Confirmação de e-mail vale **72 h**; redefinição de senha **1 h**; ambos de uso único, só o hash SHA-256 no banco, e o link de um pedido novo invalida o anterior | O plano fixou 1 h para senha; para confirmação não havia prazo. |
| E-mails urgentes (senha, confirmação, convite) **não guardam os dados** do modelo em `EmailEnviado.dados` | O link com token de senha ficaria em texto puro no banco, anulando o hash. Só os e-mails que vão para a fila guardam os dados (e são apagados quando saem). |
| `SupressaoEmail` com motivo `DESCADASTRO_TOTAL` bloqueia só o que não é transacional; `DEVOLUCAO`, `RECLAMACAO` e `MANUAL` bloqueiam tudo | Recibo e redefinição de senha precisam chegar para quem só saiu da lista; endereço que devolve ou marca spam não deve receber nada. |
| Descadastro: o `GET` do link **não descadastra** (só redireciona para a página); a página aplica o pedido ao abrir e o `POST` de um clique (RFC 8058) descadastra sem login | Leitores de link dos provedores (Outlook Safe Links, antivírus) abrem URLs sozinhos; descadastrar no `GET` tiraria pessoas da lista sem querer. |
| Logo do e-mail é o PNG `brand/skubo/icon-192.png` + o nome em texto | O Gmail não mostra SVG. |
| `resend` fixado em **6.34.1** | A versão mais nova (6.37.0) tinha menos de duas semanas. O SDK traz `webhooks.verify` (padrão Standard Webhooks/Svix), então não foi preciso instalar `svix`. |
| Códigos de indicação `SKU-XXXX` com alfabeto sem letras ambíguas (sem 0/O/1/I), 4 caracteres e 6 se colidir 5 vezes; os perfis criados pela migração usam 6 caracteres do MD5 do id | O alfabeto evita erro ao digitar; a migração é SQL puro e precisa de algo determinístico e único. |
| Cookie `skubo_origem` (UTM, `ref`, página de entrada, referrer; 60 dias, primeiro toque) é gravado **sem** esperar o aviso de cookies; o pixel da Meta só carrega com **Aceitar** | É um cookie próprio, sem dado pessoal, necessário para honrar o código de indicação e a origem do cadastro que a própria pessoa preenche. O que é de terceiro (pixel) depende do consentimento. |
| Aviso de cookies reserva espaço no fim da página enquanto está aberto | No celular ele cobria o botão "Entrar" e o "Continuar" do cadastro (o e2e pegou). |
| Meta CAPI só envia evento de quem aceitou receber novidades (e-mail ou WhatsApp) | O consentimento do cadastro é o único que temos no servidor; sem ele, nenhum dado vai para a Meta. |
| Toda conta existente ganhou **5 perguntas de teste (14 dias)** na migração, inclusive quem já assinava o Skubo | Sem isso o assistente apareceria trancado para todo mundo no dia do deploy. Quem tinha o add-on ganhou 25 perguntas por 1 ano (nenhuma conta na cópia de produção). |
| A pergunta é **debitada antes** da chamada à Anthropic e **estornada** se a chamada falhar | Debitar depois deixaria duas abas gastarem a mesma última pergunta. O estorno usa a mesma chave de idempotência. |
| Explicações nas telas grátis até 20/dia por conta; resumo semanal grátis só para quem assina; análise da Central custa 1 | Explicação é curta e no modelo rápido; cobrar cada clique afastaria o uso que mais vende a IA. Tudo configurável em `iaPesoPorRecurso`/`iaExplicacoesGratisPorDia`. |
| Teto de custo mensal por conta (`IA_ORCAMENTO_MENSAL_CENTAVOS`) **continua valendo** além das perguntas | É a trava contra abuso (uma pergunta gigante custa mais que o preço dela). Perguntas compradas não contam como "orçamento". `IA_TESTE_ORCAMENTO_CENTAVOS` deixou de ser usada. |
| Compra de perguntas: Checkout Pro com **Pix e cartão**, sem boleto, 1 parcela, preferência expira em 24 h | Boleto leva até 3 dias para compensar e a pessoa compra para usar agora. Compra pendente expira no cron `ia-creditos-expiracao`. |
| Compra de perguntas exige **e-mail confirmado**, mas qualquer papel pode comprar | O saldo é da loja; quem usa a IA é quem sente falta. A confirmação evita compra de conta descartável para testar cartão. |
| Estorno de compra (admin) tira só o que **sobra** do lote | Perguntas já usadas não voltam; o admin vê quanto sai antes de confirmar. |
| Recompensa de indicação só depois de: indicado pagou + **7 dias de carência** + ML conectado (configurável) + antifraude | Evita recompensa por assinatura cancelada no primeiro dia e por autoindicação. |
| Antifraude: mesma conta, mesmo e-mail (normalizado, sem `+tag` e pontos do Gmail), mesmo WhatsApp, mesmo pagador, mesmo ML, mesma empresa do Bling, conta de teste interno, limite de 52 por ano | Os sinais que temos sem coletar nada novo. Caso duvidoso fica em revisão manual no admin. |
| Dias ganhos no mensal viram **desconto** na próxima cobrança (3 dias antes, valor proporcional, nunca abaixo de R$ 1,00); com 30 dias ou mais, a cobrança é **pulada** (preapproval pausado e reativado depois) | O Mercado Pago não aceita "crédito de dias" numa assinatura; desconto pontual e pausa são o que a API oferece. |
| Indicado ganha **+5 perguntas** (30 dias) e 0 dia extra de teste | Benefício barato, imediato e fácil de entender; dias extras ficam configuráveis. |
| E-mails de ciclo de vida por tempo só consideram contas que entraram na condição nos **últimos 3 dias** | No primeiro deploy, contas antigas não recebem de uma vez toda a sequência de boas-vindas. |
| Pesquisa de cancelamento por link assinado (HMAC, sem login) com 6 motivos fixos e texto livre | Quem cancela raramente entra de novo no app para responder. |
| Toda ação do admin exige motivo; exclusão de conta exige digitar o e-mail do dono | Auditoria útil e proteção contra clique errado na ação irreversível. |
| Campanhas enfileiram em lotes de 500 por execução do cron | Mantém cada execução abaixo do tempo da função; o Resend envia em lote. |
| Config comercial em cache **compartilhado entre rotas** (`globalThis`) e invalidado ao salvar | Com o cache por módulo, o `/planos` continuava com o preço antigo depois de salvar (o e2e pegou). Entre instâncias da Vercel, vale até 60 s. |
| No e2e, `RATE_LIMIT_BANCO=0` | O limite de login (10/15 min por IP+e-mail, contando acertos) barra a suíte, que entra muitas vezes com a mesma conta. Em produção continua ligado. |

## Fase 0 — Furos no fluxo de usuários e de acesso

Migração `20261108090100_ciclo16_fase0_usuarios`: `User.emailVerificadoEm`, `sessaoValidaDesde`, `bloqueadoEm`, `motivoBloqueio`; `TokenSenha`; `ContadorLimite`; `AuditoriaConta`; notificações `ASSINATURA` e `EQUIPE`. Dados: apaga assinaturas de membros sem MP (**0 na cópia de produção**), cria a assinatura de teste dos donos que não tinham (**11 na cópia de produção** — nenhuma conta tinha linha em `subscriptions`), marca como verificado o e-mail de quem entra pelo Google (7 de 11).

| Item | O que foi feito |
|---|---|
| 1. Assinatura por conta | Layout `(root)` usa `obterSituacaoConta(session.user.contaId)`. A assinatura nasce no cadastro (`aoCriarConta`) e no login Google de conta nova; membro convidado nunca ganha assinatura própria. |
| 2. Fonte única | `src/modules/conta/situacao.ts` (`calcularSituacao` puro + `obterSituacaoConta`). Usada no layout, `/assinatura`, `/api/mercadopago/status`, assinar e crons. IA e admin entram nas Fases 4 e 7. |
| 3. API sem trava | `verifyUserAtivo` + `permissaoErrorResponse` 402; teste `src/app/api/__tests__/travaAssinatura.test.ts` varre os `route.ts` e falha se algum fora da lista liberada usa `verifyUser`, ou usa `verifyUserAtivo` sem tratador. Interceptador de `fetch` (`src/app/InterceptadorAssinatura.tsx`) leva para `/assinatura` ao receber 402 com `ASSINATURA_INATIVA` (a IA também usa 402 para "não contratado"; o código distingue). |
| 4. Crons | `bling-sync`, `catalogo-diario`, `financeiro-diario` e o resumo semanal pulam contas paradas há mais de 3 dias (`contasSuspensasHaMaisDe`); `bling-refresh` continua para todas. |
| 5. Membro de conta vencida | `/assinatura` mostra "A assinatura da loja X venceu. Só Y pode renovar." e **Avisar o responsável** (notificação + e-mail para os ADMIN, 1 por dia via chave de idempotência). |
| 6. Assinar durante o teste | Preapproval com `auto_recurring.start_date = trialEndsAt`; webhook usa o `start_date` como início do período. **Não confirmado no sandbox** (sem credenciais do MP aqui) — ver "Mercado Pago". |
| 7. Webhook do MP | Em produção sem `MP_WEBHOOK_SECRET` responde 503 e registra erro. Comparação de assinatura não quebra mais com tamanhos diferentes. Cada pagamento aprovado agora renova `currentPeriodStart/End` (antes só a autorização gravava o período). |
| 8. Login | Mensagem única "E-mail ou senha inválidos" (com bcrypt num hash falso quando não há senha, para o tempo de resposta não denunciar), rate limit `login` por IP+e-mail (10/15 min), dica neutra depois de 2 falhas, conta bloqueada recusada (senha e Google). |
| 9. Esqueci a senha | `/esqueci-senha`, `/redefinir-senha?token=`, `POST /api/auth/senha/esqueci` (resposta sempre igual; limite 10/h por IP e 3/h por e-mail) e `/redefinir` (troca, `sessaoValidaDesde = agora`, marca o e-mail verificado). |
| 10. E-mail verificado | Banner discreto no topo (`BannerConfirmarEmail`) com "Reenviar link" (3/h); `/confirmar-email?token=`; a sessão carrega `emailVerificado` e é recarregada ao confirmar. |
| 11. Equipe | `DELETE /api/usuarios/[id]` (só ADMIN; não remove dono nem a si mesmo), "Sair desta equipe" em `/perfil`, auditoria em `AuditoriaConta`, e-mail para quem saiu, notificação para os ADMIN. Papel alterado também é auditado. |
| 12. Convites | Enviados por e-mail (além de link e WhatsApp), "Reenviar" e "Renovar" (expirados aparecem por 30 dias), máximo 20 pendentes por conta, 30 por hora por usuário, e-mail + notificação para quem convidou quando é aceito. |
| 13. Limite de usuários | `limiteUsuariosPorConta` da configuração comercial (padrão nulo); conta membros + convites pendentes; 409 com mensagem clara. |
| 14. Usuário bloqueado | `User.bloqueadoEm`: login recusado; `verifyUser` recusa na hora; o recheck do `jwt` derruba a sessão. |

## Fase 1 — Configuração comercial

Migração `20261108090200_ciclo16_fase1_comercial`: `ConfiguracaoComercial` (versão 1 com os preços atuais), `Cupom`, `UsoCupom`, `ReajusteAssinatura`, `Subscription.precoContratadoCentavos/configuracaoVersao/cupomPrimeiraCobrancaId`.

- `modules/comercial/configuracao.ts`: validação zod com as regras do plano, uma versão nova a cada salvamento (nunca edita a anterior), cache de 60 s. Nenhum preço ficou no código (`src/lib/billing.ts` foi removido).
- `modules/comercial/cupons.ts`: percentual ou valor fixo, alvo (mensal, anual, perguntas), usos máximos, validade; uma vez por conta; o preço final nunca fica abaixo de R$ 1,00.
- `modules/comercial/reajuste.ts`: reajuste agendado por plano, com aviso por e-mail 30 dias antes e aplicação no preapproval pelo cron `reajustes`; quem assinou com preço antigo mantém até lá.
- `GET /api/planos` e a página pública `/planos` (força dinâmica, textos da oferta da configuração, repassa UTM e `ref` para o cadastro). `/assinatura` lê os mesmos preços.
- Assinar grava o preço contratado; o webhook volta a esse preço depois de uma primeira cobrança com desconto (primeiro mês ou cupom).

## Fase 2 — E-mail (Resend)

Migração `20261108090300_ciclo16_fase2_email`: `EmailEnviado`, `SupressaoEmail`.

- `modules/email/`: provedor Resend ou console (com `EMAIL_CONSOLE_ARQUIVO` em JSONL para o e2e), layout da marca com versão texto, Markdown seguro para modelos e textos do admin, 10 modelos fixos (senha, confirmação, convite, convite aceito, membro removido, aviso ao responsável, recibos de assinatura e de perguntas, aviso de reajuste, campanha) + o modelo genérico das automações editáveis (Fase 6).
- `enviarEmail` idempotente por chave, categorias (transacional, ciclo de vida, marketing) × consentimento × supressão; urgentes saem na hora, o resto vai para a fila (`email/fila.ts`, lote do Resend, cron `email-fila`).
- `POST /api/email/webhook`: assinatura Svix verificada pelo SDK; atualiza o status do envio; devolução permanente e spam viram supressão.
- Descadastro: `List-Unsubscribe` + `List-Unsubscribe-Post` (um clique, RFC 8058) em todo e-mail não transacional, `POST /api/descadastro` e página `/descadastro`, token HMAC por pessoa e categoria.

## Fase 3 — Dados de clientes, consentimento e atribuição

Migração `20261108090400_ciclo16_fase3_clientes`: `PerfilCliente` (com código de indicação, criado para os donos existentes), `ConsentimentoRegistro`, `User.preferencias`, `EventoProduto`, `SolicitacaoExclusao`.

- Cadastro em 2 passos no celular (acesso → loja), com nome da loja, pedidos por mês, canais, como conheceu, código de indicação (preenchido pelo `ref`/cookie), WhatsApp opcional, aceite dos termos (obrigatório) e de novidades (opcional, desmarcado). Login com Google de conta nova passa por `/boas-vindas` para completar o mesmo perfil e aceitar os termos.
- Consentimento append-only com versão do documento, IP e origem (`clientes/consentimento.ts`); `/termos`, `/privacidade` e `/indique/regulamento` renderizam `docs/juridico/*.md` (versão no topo do arquivo).
- Atribuição: cookie de primeiro toque `skubo_origem` (`CapturaOrigem` nas páginas públicas e de autenticação), gravado no `PerfilCliente` no cadastro.
- Aviso de cookies (`skubo_cookies`) e pixel da Meta só com aceite; Meta CAPI no servidor (`marketing/metaCapi.ts`) com hash SHA-256 e o mesmo id de evento do navegador: `CompleteRegistration`, `StartTrial`, `Subscribe`, `Purchase`.
- Eventos de produto (`registrarEvento`, nunca derruba o fluxo): cadastro, e-mail confirmado, ML/Bling conectados, primeira reposição, primeira pergunta, assinou, cancelou etc. — alimentam o funil do admin e as automações.
- Titular (LGPD): exportação em JSON (`/api/perfil/meus-dados`), pedido de exclusão (`/api/perfil/exclusao`, executado pelo admin), preferências de comunicação em `/perfil`.

## Fase 4 — Perguntas da IA no lugar do add-on mensal

Migração `20261108090500_ciclo16_fase4_creditos_ia`: `LoteCreditoIa`, `MovimentoCreditoIa`, `CompraCreditoIa`, notificação `CREDITOS_IA`; dados: lote `TESTE` (5, 14 dias) para cada dono e `MIGRACAO` (25, 1 ano) para quem tinha o add-on, com o movimento de entrada de cada lote. Na cópia de produção: 11 lotes de teste, 0 de migração.

- `ia/creditos.ts`: saldo, conceder lote (idempotente), débito com `SELECT … FOR UPDATE` do lote que vence primeiro, estorno pela chave, expiração e extrato. Teste com banco real (`creditos.banco.test.ts`): duas perguntas ao mesmo tempo com saldo 1 (só uma passa), ordem por vencimento com extrato por lote, mesma chave sem débito duplo e estorno exato, expiração única e concessão idempotente.
- `ia/consumo.ts`: custo por recurso pela configuração, explicações grátis por dia, aviso de saldo baixo (≤ 3) e de saldo zerado (e-mail + notificação, uma vez por lote).
- `ia/acesso.ts`: conta ativa **e** (`IA_CONTAS_LIBERADAS` > liberação manual > saldo). O assistente, as explicações, a análise da Central e o resumo semanal debitam e estornam.
- `ia/compraCreditos.ts` + `POST /api/ia/creditos/comprar` + `GET /api/ia/creditos/compras/[id]`: Checkout Pro com `credito-ia:<compraId>`, cupom, crédito único no webhook, recibo por e-mail. A tela acompanha a aba de pagamento e atualiza o saldo sozinha (`useComprarCreditos`).
- Telas: cartão de venda no assistente quando o saldo zera (`CartaoVendaIa`), pacotes (`PacotesIa`), cartão de saldo e extrato em **Ajustes → Skubo IA** e em `/assinatura` (`CartaoCreditosIa`), retorno do checkout em `/ia?compra=`.
- Removido: rotas `/api/assinatura/ia/*`, teste grátis de 7 dias do add-on e `src/modules/ia/cobranca.ts`. O webhook ignora avisos do add-on antigo (`IGNORADO_ADDON_LEGADO`).

## Fase 5 — Indique e ganhe

Migração `20261108090600_ciclo16_fase5_indicacao`: `Indicacao`, `CreditoDiasAssinatura`, `Subscription.descontoAplicadoCentavos/pausadaAte/proximaCobrancaEm`, notificação `INDICACAO`.

- Link `/r/<código>` (grava o cookie e leva ao cadastro) e campo de código no cadastro; `indicacao/cadastro.ts` cria a indicação e dá o bônus ao indicado.
- `indicacao/fluxo.ts`: ML conectado, pagamento aprovado, estorno (invalida), carência e recompensa (cron `indicacoes`); `antifraude.ts` com os sinais da tabela de decisões; caso duvidoso vai para revisão no admin.
- `indicacao/recompensa.ts`: aplica os dias (teste estendido, anual estendido, desconto ou ciclo pulado no mensal) e reativa assinaturas pausadas (cron `assinaturas-recompensas`).
- Tela `/indique` (link, mensagem do WhatsApp, código, regras, lista com nome mascarado e status, semanas ganhas), cartão "Pedir indicação" no dashboard depois de um marco positivo, regulamento público.

## Fase 6 — E-mails automáticos de ciclo de vida

Migração `20261108090700_ciclo16_fase6_ciclo_de_vida`: `AutomacaoEmail` (texto editável por automação), `MotivoCancelamento`.

- 15 automações padrão (`email/automacoes.ts`): boas-vindas, conectar ML, conectar Bling, primeira reposição, perguntas grátis da IA, teste acabando, teste terminou, volte em 3 e 14 dias, pagamento falhou, cancelou, renovação anual, perguntas acabando, perguntas esgotadas, indicação entrou, recompensa de indicação. Cada uma com variáveis (`{{nome}}`, `{{loja}}`, `{{diasRestantes}}`, `{{link}}`…), liga/desliga e envio de teste no admin.
- Por evento (cadastro, pagamento, cancelamento, créditos, indicação) disparam na hora; por tempo, o cron `ciclo-de-vida` (de hora em hora) — `email/cicloDeVida.ts`, com janela de 3 dias e idempotência por conta.
- Pesquisa de cancelamento: link assinado no e-mail de cancelamento (`/pesquisa/cancelamento`), motivos gravados em `MotivoCancelamento` e mostrados no admin.

## Fase 7 — Admin comercial

Migração `20261108090800_ciclo16_fase7_admin`: `AuditoriaAdmin`, `PagamentoPlataforma`, `Campanha`, `User.ultimoLoginEm`, `TipoNotificacao.MARKETING_ADMIN`.

- Páginas novas: Visão geral comercial (`PainelComercial`: MRR real e estimado, funil, coortes semanais, churn e motivos, receita de perguntas, contas por situação), ficha da conta com ações, Usuários, Assinaturas e pagamentos (CSV, estorno de compra de perguntas), Créditos de IA, Indicações (revisão), E-mails e campanhas (automações, campanhas com público, prévia, teste, IA para rascunho com a voz da marca, agendamento e métricas), Preços e ofertas (configuração com histórico de versões, cupons, reajustes), Auditoria.
- Toda rota que muda algo exige `motivo` e grava `AuditoriaAdmin` com antes/depois e IP; `auditoriaObrigatoria.test.ts` varre as rotas e falha se alguma mutável não chamar `auditar()`.
- Contas de **teste interno** saem das métricas, das campanhas e das indicações.

## Fase 8 — Testes

- 22 arquivos de teste novos e 11 atualizados: situação da conta, trava 402 (varre as rotas), login, senha, equipe e convites, configuração comercial e cupons, envio de e-mail, webhook do Resend, descadastro, automações e ciclo de vida, créditos (com banco real), consumo, compra de perguntas, indicação (cadastro, fluxo, antifraude, recompensa), assinatura no MP, auditoria obrigatória.
- E2E `e2e/08-crescimento.spec.ts` com `EMAIL_PROVEDOR=console` (lendo o JSONL) e Mercado Pago simulado: cadastro com UTM + código → `/comecar` e o indicador vê a indicação; convite por e-mail, aceite e remoção; esqueci a senha → nova senha → link usado recusado → entrar; teste vencido (dono vê planos, membro vê "Avisar o responsável", API 402); assistente sem perguntas mostra o pacote e a compra aprovada credita 25; admin muda o preço e vê em `/planos`, cria campanha, vê o público e envia teste; celular com cadastro em 2 passos, `/indique` sem rolagem horizontal e cartão de créditos.
- O e2e pegou e o ciclo corrigiu: aviso de cookies cobrindo botões no celular, cache da configuração comercial não invalidado entre rotas, tour de introdução abrindo para as contas novas do seed.

## Fase 9 — Documentação

`CLAUDE.md` (fontes da verdade novas, variáveis, e2e, ciclo atual), `env.example`, `docs/GUIA-DE-CONFIGURACAO.md` (Mercado Pago, Resend com SPF/DKIM/DMARC e webhook, Meta, admin e primeiro acesso, crons novos, checklist), `docs/MANUAL-DO-USUARIO.md` e `/ajuda/manual` (Perguntas da IA, Equipe, Assinatura e teste, Indique e ganhe, Sua conta e seus dados).

## Ensaio da migração na cópia de produção

Banco `ensaio_prod` (restaurado do backup de produção num Postgres local): as 8 migrações aplicaram sem erro, `prisma migrate diff` do schema contra o banco ficou vazio e os dados existentes foram preservados. Resultado: 11 assinaturas de teste criadas (nenhuma conta tinha), 11 perfis com código, 7 e-mails marcados como confirmados (Google), 11 lotes de 5 perguntas, 0 contas com add-on, configuração comercial versão 1.

## Mercado Pago — o que precisa de confirmação no sandbox

Sem credenciais do Mercado Pago neste ambiente, **nada foi confirmado contra a API real**; o fluxo inteiro roda contra o Mercado Pago simulado (`MP_PROVEDOR_FALSO`) e contra os testes unitários. Antes de ligar a cobrança, conferir no sandbox:

1. `auto_recurring.start_date` futuro aceito na criação do preapproval, com o cartão autorizado agora e a primeira cobrança na data. Se recusar, trocar por `free_trial` (frequência em dias).
2. Valor mínimo de uma cobrança de assinatura (o código não deixa ficar abaixo de R$ 1,00).
3. Pausar e reativar (`PUT /preapproval/{id}` com `status: paused` / `authorized`) e se a cobrança pulada realmente não acontece.
4. Nome e formato do campo da próxima cobrança (`next_payment_date`) — usado para aplicar o desconto 3 dias antes.
5. Alterar `auto_recurring.transaction_amount` de um preapproval ativo (desconto pontual, volta ao preço contratado, reajuste) sem nova autorização do pagador.
6. Checkout Pro: `back_urls` + `auto_return: approved` voltando para `/ia?compra=`, `excluded_payment_types` sem boleto e `expiration_date_to` respeitado.
7. Webhook: formato do `x-signature` nos avisos de `payment` e `subscription_preapproval` com o segredo do painel.

## Riscos e pontos de atenção

- **Contas antigas ganharam 7 dias de teste a partir do deploy.** Enquanto `MP_ACCESS_TOKEN` não estiver em produção ninguém é bloqueado; ao ligar a cobrança, toda conta sem assinatura e com o teste vencido vai para `/assinatura`. Antes de ligar, use **Admin → Contas → Conceder dias / Estender teste** nas lojas que não devem ser cobradas (a sua, pilotos, parceiros) ou marque como teste interno e conceda os dias.
- **Mercado Pago não validado** (seção acima). O primeiro ciclo real deve ser acompanhado em **Admin → Assinaturas e pagamentos**.
- **Textos jurídicos** (`docs/juridico/`) são um rascunho completo, mas precisam de revisão de um advogado e do CNPJ/endereço reais antes de divulgar.
- **Entregabilidade**: sem SPF/DKIM/DMARC configurados, os e-mails caem no spam. Começar o DMARC em `p=none`.
- **Plano da Vercel**: os crons de 5 em 5 minutos e de hora em hora exigem o plano Pro.
- **Limite de login conta acertos também** (10 por 15 min por IP + e-mail). Uma pessoa que entra e sai muitas vezes seguidas pode ser barrada por alguns minutos.
- **Cache de configuração por instância**: depois de salvar preços no admin, outras instâncias da Vercel levam até 60 s para ver a versão nova.
- O add-on mensal antigo da IA, se alguém tiver, precisa ser cancelado à mão no painel do Mercado Pago (o Skubo só ignora os avisos dele).

## Checklist de ida ao ar

- [ ] Revisar o `git diff` e fazer o commit/push (não feito neste ciclo, por instrução)
- [ ] Backup do banco de produção antes do deploy (branch do Neon)
- [ ] Deploy (o build aplica as 8 migrações); conferir `/planos`, cadastro, `/indique` e o admin
- [ ] `DESCADASTRO_SEGREDO` gerado e configurado
- [ ] Resend: domínio verificado (SPF, DKIM), DMARC `p=none`, webhook `/api/email/webhook` com `RESEND_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_REMETENTE`, `EMPRESA_ENDERECO_RODAPE`; e-mail de teste chegando na caixa de entrada
- [ ] Admin → Preços e ofertas: conferir a versão 1 (preços, teste, pacotes, indicação, textos)
- [ ] Admin → Contas: marcar contas internas como teste interno e conceder dias às lojas que não devem ser cobradas
- [ ] Mercado Pago: testar os 7 itens no sandbox; depois `MP_ACCESS_TOKEN` + `MP_WEBHOOK_SECRET` de produção e webhook com Pagamentos + Planos e assinaturas
- [ ] Cancelar no painel do Mercado Pago qualquer assinatura do add-on antigo da IA
- [ ] Revisão jurídica de termos, privacidade e regulamento; CNPJ e endereço reais
- [ ] (Opcional) Meta: pixel + `META_CAPI_TOKEN`, testar com `META_CAPI_TESTE` e remover
- [ ] `IA_PROVEDOR_FALSO`, `MP_PROVEDOR_FALSO` e `EMAIL_PROVEDOR` ausentes em produção
- [ ] Primeira semana: acompanhar Admin → Visão geral (funil), E-mails (devoluções/spam) e Auditoria
