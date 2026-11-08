# Auditoria — Ciclo 15 (Skubo IA completo + go-live)

Plano executado: `PROMPT-CICLO-15-IA.md`. Uma seção por fase com o que foi feito, decisões tomadas sem consulta e o que ficou pendente.

---

## Fase 0 — Pendências do ciclo 14

- Removidos os 10 arquivos legados (`produtos/importar`, `saude-dados`, `bling/produtos/importar`, `produtos/estoque-bling`, `produtos/matching`, fontes Geist, `pollBlingSyncHistory`, `productMatchingService` + teste). Nenhum import órfão: só sobraram os redirects de `next.config.mjs` (`/produtos/importar → /comecar`, `/saude-dados → /controle`), que continuam úteis para links antigos.
- Migrações do ciclo 14 validadas num Postgres descartável (`initdb` local, porta TCP 55432, sem socket): `prisma migrate deploy` aplicou tudo e `prisma migrate diff --from-migrations … --to-schema-datamodel …` saiu **vazio**.
- Notas fiscais: `mapearNotaFiscal` agora registra `console.warn("[BLING_NOTAS] Nota fora do formato esperado, ignorada", { notaId, camposInvalidos, chavesRecebidas })` e pula a nota quando `valorNota`/`dataEmissao` faltam ou não são lidos, ou quando `numeroPedidoLoja` vem num tipo inesperado (objeto, lista). Só as **chaves** vão para o log, nunca os valores (sem nome/documento do destinatário). Nota sem pedido da loja (`numeroPedidoLoja` ausente) continua válida — é venda de balcão/outro canal e entra em "Em nota". Dois testes novos.
- `npm run build` passou.
- Achado no caminho: o client do Prisma local estava gerado a partir do schema anterior ao ciclo 14 (tsc acusava `notaFiscalVenda`/`analiseIa` inexistentes) e `.next/types` guardava tipos de páginas apagadas. Bastou `prisma generate` e limpar `.next/types` (artefato de build, ignorado pelo git).

## Fase 1 — Núcleo de IA (`src/modules/ia/`)

- `@anthropic-ai/sdk` 1.6.0. Toda chamada passa por `cliente.ts` (`ProvedorIa` com `criarMensagem`/`transmitirMensagem`); nenhuma rota fala com a API direto.
- `config.ts`: `IA_MODELO` (padrão `claude-sonnet-5-5`), `IA_MODELO_RAPIDO` (`claude-haiku-5-5`), `IA_DESLIGADA`, `IA_PROVEDOR_FALSO`, preços `IA_PRECO_*`, `IA_COTACAO_DOLAR` (5,5), `IA_ORCAMENTO_MENSAL_CENTAVOS` (1000), `IA_MENSAGENS_MENSAIS` (300), `IA_TESTE_ORCAMENTO_CENTAVOS` (200), `IA_RETENCAO_DIAS` (90), `ANTHROPIC_WORKSPACE_ID`.
- `cliente.ts`: cliente único (`timeout` 60 s, `maxRetries` 2). Cache de prompt com três marcas: bloco fixo do sistema, última ferramenta e cache automático no fim da conversa (máximo da API é 4). A parte variável do sistema (data de hoje, nome da conta, tela atual) vai num segundo bloco **depois** da marca, para não invalidar o prefixo. Erros 429/5xx (inclui 529)/timeout/conexão/credencial viram `IaIndisponivelError("FALHA_PROVEDOR")` com mensagem "A IA está instável agora, tente em alguns minutos." e um `detalhe` técnico (`HTTP_529`, `TIMEOUT`…) que vai só para `UsoIa.codigoErro`. Cancelamento vira `IaCanceladaError`.
- `uso.ts`: `UsoIa` gravado a cada chamada (tokens de entrada/saída/cache, custo estimado, duração, sucesso, código de erro). `obterConsumoDoMes` mede por **custo** quando os quatro preços estão definidos e por **quantidade de mensagens** quando falta algum. Mensagem = pergunta no assistente + análise/explicação/resumo gerados (títulos e resumos internos não contam).
- `acesso.ts`: `obterAcessoIa` com origens `ENV` > `MANUAL` > `ASSINATURA` > `TESTE`. Assinatura cancelada ou com pagamento pendente continua liberada até `iaPeriodoFim`. Teste grátis: 7 dias desde o início, orçamento próprio (R$ 2) contado desde o início do teste.
- `seguranca.ts`: `removerDadosPessoais`, `removerCustos`, `limitarTamanho` (busca binária no tamanho da lista, devolve `{ itens, totalItens, cortado: true }`) e `embrulharDadosExternos` (`<dados_da_loja>`; `<` e `>` viram `<`/`>` no JSON, então um título de anúncio não consegue fechar a tag).
- `analiseIa.ts` (Central de controle) refeito sobre o núcleo com **saída estruturada**.

### Decisões tomadas sem consulta

1. **`output_config.format` (json_schema) no lugar de `tool_choice: { type: "tool" }`.** O plano pedia ferramenta forçada, mas no `claude-sonnet-5-5` (e Opus 5.5/Fable 5.1) `tool_choice` `tool`/`any` devolve **400**. Saída estruturada dá a mesma garantia de JSON válido no schema de `ConteudoAnaliseIa`. Conteúdo antigo continua legível por `normalizarConteudoAnalise`/`interpretarRespostaIa`.
2. **Preço separado para o modelo rápido** (`IA_PRECO_RAPIDO_*`, opcional). Com um único conjunto de preços o Haiku seria estimado com o preço do Sonnet (~20× mais caro). Sem `IA_PRECO_RAPIDO_*`, usa os preços principais — superestima, nunca subestima.
3. **Fallback de recusa no servidor** (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`) ligado só para modelos que aceitam (`claude-sonnet-5-5`, `claude-opus-5-5`, `claude-opus-5`, `claude-fable-5-1`); por isso as chamadas usam `client.beta.messages`. Para o Haiku (modelo rápido) não é enviado.
4. **Esforço**: chat em `low`, análises em `medium`, modelo rápido em `low`. O pensamento adaptativo fica no padrão do modelo (não dá para desligar no Sonnet 5.5).
5. **`ANTHROPIC_WORKSPACE_ID`** (opcional): chaves de usuário (`sk-ant-usr…`) exigem o cabeçalho `anthropic-workspace-id`. A chave enviada neste ciclo é desse tipo; ver "Teste com a chave real" na Fase 10.
6. `garantirOrcamento` ficou em `acesso.ts` (e não em `uso.ts`) para não criar import circular entre os dois arquivos; `uso.ts` tem a verificação pura (`verificarOrcamento`).
7. `iaAtiva` (ciclo 14, nunca publicado) foi substituído por `iaLiberadaManual` + `iaStatus`; a migração copia `iaAtiva = true → iaLiberadaManual = true` antes de remover a coluna (validado no Postgres descartável com uma linha real).

### Banco (`20261108090000_ciclo15_skubo_ia`)

`ConversaIa`, `MensagemIa`, `UsoIa` (+ índice por `createdAt` para as métricas de 24h do admin), `AnaliseIa.tipo/periodoInicio/periodoFim` (+ índice `(userId, tipo, periodoInicio)` usado como marcador do resumo semanal), `Subscription.iaStatus/mpPreapprovalIaId/iaPeriodoFim/iaTesteIniciadoEm/iaLiberadaManual/iaOrcamentoCentavos`, `User.receberResumoIa`, `NotificationType.RESUMO_IA`. `prisma migrate diff` contra o schema: **vazio**.

### Adiantado da Fase 7

Para o projeto voltar a compilar sem `iaAtiva`, o backend do admin já foi feito aqui: métricas de IA (`calcularMetricasIa`), `PATCH /api/admin/contas/[id]/ia` com `{ liberadaManual?, orcamentoCentavos? }`, tela de contas com status/consumo/orçamento, `/admin/ia/feedback`. Detalhes na seção da Fase 7.

## Fase 2 — Ferramentas de dados (`src/modules/ia/ferramentas/`)

12 ferramentas somente leitura, cada uma com zod (validação) + JSON Schema gerado por um conversor próprio (`esquema.ts`, sem dependência nova), permissão e `executar(contexto, entrada)`. O `contexto` (`contaId`, `userId`, `papel`, `podeVerCusto`, `agora`) é montado no servidor; o zod descarta qualquer `contaId` que o modelo tente mandar (teste cobre as 12).

| Ferramenta | Fonte reaproveitada | Permissão |
|---|---|---|
| `diagnostico_loja` | `gerarDiagnostico` | qualquer papel |
| `resumo_financeiro` | `calcularIndicadores` (que usa `totalizarVendas`) | `FINANCEIRO_VER` |
| `comparar_periodos` | `calcularIndicadores` ×2 + `gerarLucroPorProduto` ×2 (produtos que mais mudaram) | `FINANCEIRO_VER` |
| `vendas_por_produto` | `gerarLucroPorProduto` | `FINANCEIRO_VER` |
| `vendas_por_dia` | `buscarVendasParaCalculo` + `agruparVendas` (dia SP) | `FINANCEIRO_VER` |
| `faturamento_com_frete` | `calcularFaturamentoComFrete` | `FINANCEIRO_VER` |
| `sugestao_reposicao` | `calcularReposicaoConta` | `PEDIDOS_COMPRA_VER` |
| `capital_parado` | `calcularCapitalParadoConta` | `VER_CUSTO` |
| `pendencias_cadastro` | `calcularTodasPendencias` | qualquer papel |
| `saude_anuncios` | `calcularSaudeAnuncios` + faturamento 30d por anúncio (`VendaCanalItem.anuncioExternoId`) | `VENDAS_ML_VER` |
| `buscar_produtos` | `listarProdutos` | qualquer papel |
| `detalhe_produto` | produto + estoque por armazém + Full do snapshot + vínculos + `gerarLucroPorProduto` 30/90d + `calcularReposicaoConta` + pendências | qualquer papel |

Pipeline de saída: `removerDadosPessoais` → `removerCustos` (sem `VER_CUSTO`) → `limitarTamanho(12000)` → `<dados_da_loja>`. Valores em reais com 2 casas, datas `AAAA-MM-DD` no fuso de SP, campo `fonte` com a tela. Erro de entrada, `ErroFerramenta` ou exceção viram `is_error: true` com mensagem curta (a exceção nunca vaza o texto original nem para o modelo nem para o log).

Decisões:
- `vendas_por_produto` usa `gerarLucroPorProduto` (a fonte da tela Financeiro → Produtos) em vez de `agruparVendas`: `agruparVendas` agrupa **vendas**, não itens; o rateio por item (com kit explodido) já existe em `lucroPorProduto.ts`, e recalcular seria uma segunda fonte da verdade.
- `urgencia: "todos"` em `sugestao_reposicao` = crítico + atenção (o que pede ação), com o total de "ok" no resumo.
- `detalhe_produto` para quem não tem `FINANCEIRO_VER` mantém só as unidades vendidas (que a tela Produtos já mostra a todos) e tira os valores em reais.
- O ranking por margem cai para faturamento quando o papel não vê custo.

## Fase 3 — Assistente "Pergunte ao Skubo"

Backend:
- `assistente.ts`: garante acesso e orçamento → carrega as últimas 20 mensagens (resumo das antigas com o modelo rápido quando passam de ~40 mil tokens estimados, mantendo as 6 mais recentes) → streaming com sistema + ferramentas do papel → executa as ferramentas do turno **em paralelo** e devolve todos os `tool_result` numa única mensagem → até **6 rodadas** de ferramenta; na 6ª o resultado vai junto com o aviso "responda com o que já tem" e a 7ª chamada sai com `tool_choice: none`. Respeita `request.signal` (Parar). Grava pergunta, resposta e as chamadas de ferramenta (nome, entrada validada, duração, erro — nunca a saída). `UsoIa` por chamada.
- Só o **texto final** de cada turno anterior volta para o modelo nas perguntas seguintes; blocos de pensamento ficam só dentro do turno em que nasceram (append-only), o que mantém a conversa compatível com a checagem de histórico dos modelos 5.5.
- Falha antes de qualquer texto: a pergunta (e a conversa, se era nova) é descartada e o cliente recebe `conversaDescartada`, para o "Tentar de novo" não duplicar mensagens. Falha ou cancelamento depois de algum texto: grava o parcial com a marca "(resposta interrompida)".
- Recusa do modelo (`stop_reason: refusal`) vira uma frase gentil.
- Título: provisório (primeiros 60 caracteres) na hora, e o definitivo com o modelo rápido depois do evento `fim`, enviado num evento extra `titulo` (o cliente já terminou de renderizar a resposta).
- Rotas: `POST /api/ia/chat` (SSE: `conversa`, `texto`, `ferramenta`, `fim`, `titulo`, `erro`; `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`; zod com até 2000 caracteres; `checkRateLimit("ia-chat", user.id, 20, 600)`), `GET /api/ia/conversas`, `GET|PATCH|DELETE /api/ia/conversas/[id]`, `POST /api/ia/mensagens/[id]/feedback`, `GET /api/ia/sugestoes?pagina=` (por regra a partir do diagnóstico, sem gastar IA) e `GET /api/ia/acesso` (estado para a interface).
- Prompt do sistema em `prompts/assistente.ts`: bloco fixo cacheável + bloco do dia (data/hora SP, nome da loja, papel e limites, tela aberta).

Frontend (`src/components/ia/`):
- `AssistenteIa.tsx`: botão flutuante (desktop: canto inferior direito; celular: acima da barra inferior, ao lado do botão "+" nas telas que já têm um) abrindo um painel lateral Radix Dialog (440 px no desktop, tela cheia no celular). Atalho **Ctrl/Cmd + J** — o Ctrl/Cmd + K já abre a paleta de comandos.
- `PainelAssistente.tsx` (usado no painel e na página `/ia`): histórico recolhível com apagar em dois cliques, chips de ferramenta ("Consultando a reposição…"), sugestões da tela atual, Enter envia/Shift+Enter quebra linha, Parar, Copiar, 👍/👎, Nova conversa, barra de consumo ("62% do uso do mês"). Estados: sem acesso → `CartaoVendaIa`; IA não configurada → mensagem técnica só para admin da plataforma (para os demais o botão nem aparece); desligada; limite atingido (data de renovação + "Falar com o suporte", `NEXT_PUBLIC_SUPORTE_URL`); erro do provedor com "Tentar de novo".
- `MarkdownSeguro.tsx` + `markdown.ts`: negrito, itálico, código, listas, tabelas, títulos e links **só internos** (`/…`); gera elementos React, nunca `dangerouslySetInnerHTML`.
- `src/lib/sse.ts`: `LeitorSse` (eventos quebrados entre pedaços, vários por pedaço, CRLF, comentários) + `lerEventosSse` sobre `fetch`.
- Item "Assistente IA" no grupo Início da Sidebar; página `/ia` em tela cheia.

## Fase 6 — Cobrança do Skubo IA (Mercado Pago)

- `Subscription`: `iaStatus` (`INATIVA`, `TESTE`, `ATIVA`, `PENDENTE`, `CANCELADA`), `mpPreapprovalIaId @unique`, `iaPeriodoFim`, `iaTesteIniciadoEm`, `iaLiberadaManual`, `iaOrcamentoCentavos`.
- `src/modules/ia/cobranca.ts` + rotas `POST /api/assinatura/ia/assinar` (preapproval mensal de `PRICING.IA_MENSAL`, `reason: "Skubo IA — mensal"`, `external_reference: "ia:<contaId>"`, exige assinatura principal `ACTIVE`/`TRIALING`), `/cancelar` (cancela no MP, acesso até `iaPeriodoFim`) e `/teste` (uma vez por conta). Todas exigem `INTEGRACOES_USUARIOS_ASSINATURA`.
- Webhook: evento da IA reconhecido pelo prefixo `ia:` ou pelo `mpPreapprovalIaId`. `authorized` → `ATIVA` + `iaAtivadaEm` + `iaPeriodoFim = max(atual, agora + 1 mês)`; pagamento aprovado → mantém `ATIVA` e estende `iaPeriodoFim` a partir de `date_approved`; `rejected`/`cancelled` (pagamento) → `PENDENTE`; preapproval `cancelled` → `CANCELADA`; `paused` → `PENDENTE`. Idempotência por construção: reprocessar o mesmo evento não muda nada (testado).
- Se o cliente concluir o checkout de um preapproval antigo (gerado antes de clicar de novo em Assinar), o webhook acha a conta pela referência e passa a usar aquele id.
- Cancelar a assinatura principal (rota ou webhook) cancela também a da IA.
- `/assinatura`: `CartaoSkuboIaAssinatura` com status, consumo, Testar/Assinar/Cancelar e o que está incluso.
- `POST /api/assinatura/ia` (pedir ativação) ficou **só como alternativa quando o Mercado Pago não está configurado** (com MP configurado responde 409 `USE_CHECKOUT`); a interface só cai nele quando `assinar` devolve 503.

## Fase 8 — Privacidade, segurança e operação

- Retenção: novo cron `GET /api/cron/ia-limpeza` (diário 09:30 UTC) apaga conversas sem atividade há mais de `IA_RETENCAO_DIAS` (90). `UsoIa` fica (não tem conteúdo).
- Apagar: cada usuário apaga as suas; o **dono da conta** apaga todas as da conta (`DELETE /api/ia/conversas?escopo=conta`, botão em **Ajustes → Skubo IA**). Decisão: o plano falava em `/configuracoes`, mas desde o Ciclo 13 essa rota é só o retorno do OAuth do Mercado Livre; as configurações vivem em `/ajustes`.
- Logs: nenhum log tem conteúdo de mensagem ou saída de ferramenta. `registrarUsoIa` emite `[IA_USO]` com conta, autor, recurso, modelo, tokens, duração, sucesso e código de erro.
- Não existe página de Política de Privacidade/Termos no app; o texto sobre o processamento pela Anthropic ficou em Ajustes → Skubo IA e no manual. **Pendente fora do código:** incluir o parágrafo na política publicada no site, se houver.
- Cabeçalhos SSE conferidos em teste.

## Fase 4 — IA embutida nas telas

`src/modules/ia/explicacoes.ts` + `POST /api/ia/explicar` (`{ tipo: "reposicao" | "produto" | "variacao" | "anuncios", … }`, limite `ia-explicar` 30/10 min por usuário) + `BotaoExplicarIa` (popover; quem não tem acesso abre o cartão de venda; "Continuar no assistente" leva a pergunta para o chat).

| Tela | Botão | Como responde |
|---|---|---|
| Central de controle | "Perguntar sobre isto" em cada item | Abre o assistente com a pergunta pronta e envia |
| Central de controle | Análise | Saída estruturada da Fase 1; resumo semanal aparece no mesmo card com o rótulo "resumo semanal" |
| Reposição | "Por que essa sugestão?" em cada linha | Modelo rápido, a partir da linha de `calcularReposicaoConta` (demanda, cobertura, local + Full + trânsito + pedidos, prazo, kit) |
| Ficha do produto | "Resumo do produto" | Modelo rápido sobre `detalhe_produto` (vendas 30/90 d, estoque, margem se `VER_CUSTO`, anúncios, o que fazer) |
| Visão geral e Financeiro | "Explicar variação" | Modelo principal sobre `comparar_periodos`, saída estruturada com 3 motivos com números |
| Saúde dos anúncios | "Plano de ação" | Modelo principal sobre `saude_anuncios` (com faturamento 30 d em jogo), até 5 ações com impacto |

Cache (`withUserCache`, novo tipo `ia` com 24 h): por conta + item + **dia** (reposição, produto, anúncios) ou + **hora** (variação), e sempre também por **perfil** (papel + vê custo ou não) — um usuário sem `VER_CUSTO` nunca recebe um texto que foi gerado com custo para o dono. O cache em memória vale por instância; com Upstash configurado é compartilhado.

Decisões: "Explicar variação" aparece na Visão geral ao lado do faturamento líquido (só para quem tem `FINANCEIRO_VER` e quando há delta) e no Financeiro no cabeçalho, junto do seletor de período (períodos "personalizado" não têm botão, porque a comparação automática precisa de um período padrão). Foi incluído o período `90d` nas ferramentas para cobrir a opção "Últimos 90 dias" da Visão geral.

## Fase 5 — Resumo semanal automático

- `src/modules/ia/resumoSemanal.ts` + `GET /api/cron/ia-resumo-semanal` (Bearer `CRON_SECRET`, `maxDuration` 60).
- Elegíveis: assinatura do add-on vigente, liberação manual ou `IA_CONTAS_LIBERADAS`; **teste grátis não entra**. Contas com o orçamento do mês esgotado são puladas.
- Semana anterior (segunda a domingo, fuso SP) vs. a semana antes dela, + diagnóstico, com a mesma saída estruturada da análise e **3 prioridades**. Grava `AnaliseIa` `tipo = SEMANAL` com `periodoInicio/periodoFim` — esse registro é o marcador: contas já resumidas na semana são puladas (idempotente).
- Lotes de 4 contas em paralelo; para antes de 45 s e devolve `pendentes`. Falha de uma conta não interrompe as outras.
- Notificação `RESUMO_IA` (novo tipo) com link para `/controle` para os usuários `ADMIN` da conta com `receberResumoIa = true` (interruptor em **Perfil → Notificações**, só para ADMIN).

Decisão: o plano pedia o cron `"0 11 * * 1"`, mas com o orçamento de 50 s por execução uma única execução semanal resume ~10–12 contas e o "continua na próxima execução" só aconteceria uma semana depois. O `vercel.json` ficou com **`*/10 11-12 * * 1`** (12 execuções entre 8:00 e 9:50 de SP); como o marcador torna tudo idempotente, as execuções sem trabalho terminam em milissegundos.

## Fase 7 — Admin da plataforma

(Backend feito na Fase 1; interface aqui.)

- `/admin`: bloco **Skubo IA** com receita do add-on, custo estimado do mês (com aviso de chamadas sem preço configurado), **margem do add-on** (receita − custo), conversão teste → assinatura, perguntas por dia (gráfico 30 d), taxa de 👍 (30 d), chamadas e erros do provedor nas últimas 24 h, análises da Central e pedidos de ativação, e a tabela de custo estimado por conta (top 10). O MRR passou a somar o add-on pelo `iaStatus = ATIVA`.
- `/admin/contas`: status da IA (Assinante / Em teste / Pagamento pendente / Cancelada + "Manual"), custo e chamadas do mês, campo de orçamento mensal em R$ (vazio = padrão) e interruptor de liberação manual. `PATCH /api/admin/contas/[id]/ia` com `{ liberadaManual?, orcamentoCentavos? }` (zod).
- `/admin/ia/feedback`: lista paginada das respostas com 👎, com a pergunta que as gerou, o comentário e o nome das ferramentas usadas — nunca a saída das ferramentas.
- Tudo atrás de `verifyAdminPlataforma`.

## Fase 9 — Testes

Unitários novos (Vitest, em `__tests__/` ao lado do código):

- `ia/__tests__/uso.test.ts` — custo com e sem preços, preço do modelo rápido, falha do banco não derruba a chamada, consumo por custo/mensagens, sobrescrita do admin, janela e orçamento do teste.
- `ia/__tests__/acesso.test.ts` — todas as origens (assinatura, cancelada dentro do período pago, teste vigente/expirado, manual, env por e-mail e por id), prioridade, `IA_DESLIGADA`, sem chave, `IA_PROVEDOR_FALSO`, `NAO_CONTRATADA` e `LIMITE`.
- `ia/__tests__/seguranca.test.ts` — dados pessoais (incl. e-mail e CPF dentro de texto), custo em qualquer nível, corte de listas, envelope à prova de `</dados_da_loja>`.
- `ia/__tests__/cliente.test.ts` — marcas de cache, parte variável fora do prefixo, `tool_choice: none`, `json_schema`, fallback só nos modelos que aceitam, tradução de 429/529/timeout/cancelamento.
- `ia/ferramentas/__tests__/ferramentas.test.ts` — as 12 ferramentas usam só o `contaId` do servidor mesmo quando o modelo manda outro; filtro de custo sem `VER_CUSTO`; filtro por papel no registro; JSON Schema gerado; reais/datas; dinheiro em jogo; e-mail removido; corte de tamanho; erros curtos sem vazar detalhes.
- `ia/__tests__/assistente.test.ts` — uma ferramenta, várias no mesmo turno em paralelo, erro de ferramenta, limite de 6 rodadas + resposta sem ferramentas, cancelamento pelo `signal`, falha do provedor (descarta pergunta e conversa nova), sem acesso, conversa de outro usuário, recusa, papel sem custo, título.
- `ia/__tests__/explicacoes.test.ts`, `ia/__tests__/sugestoes.test.ts`, `ia/__tests__/cobranca.test.ts`, `ia/__tests__/resumoSemanal.test.ts`.
- `lib/__tests__/sse.test.ts` — evento partido em vários pedaços, vários eventos num pedaço, CRLF, comentários, várias linhas `data`, UTF-8 partido.
- `components/ia/__tests__/markdown.test.ts` — blocos, inline, links externos e `javascript:` viram texto.
- Rotas: `api/ia/chat` (SSE, cabeçalhos, validação, rate limit), `api/ia/conversas` (escopo do usuário, apagar tudo só pelo dono), `api/mercadopago/webhook` (roteamento IA × principal), `api/cron/ia-limpeza`.
- `controle/__tests__/analiseIa.test.ts` reescrito: saída estruturada + compatibilidade com conteúdo antigo gravado.

E2E: `e2e/07-assistente-ia.spec.ts` (com `IA_PROVEDOR_FALSO=1` e `IA_CONTAS_LIBERADAS=e2e@skubo.test`) — fluxo completo no desktop (sugestão → chip da ferramenta → resposta com link → 👍 → histórico → apagar em dois cliques), celular 390 (painel em tela cheia, campo e botões, envio, fechar), conta sem acesso (cartão de venda com Testar/Assinar, via resposta simulada de `/api/ia/acesso`), Reposição "Por que essa sugestão?" e Central "Perguntar sobre isto".

Achado no caminho: `scripts/migrate-deploy.mjs` abortava o build em um banco **totalmente vazio** (sem `_prisma_migrations`: "called markMigrationRolledBack on a database without migrations table"). Produção não é afetada (a tabela existe), mas qualquer ambiente novo (staging, preview com banco próprio) quebrava no primeiro deploy. A mensagem entrou na lista de saídas ignoráveis — um banco sem tabela de migrações não tem migração em estado de falha para resolver.

## Fase 10 — Documentação e checklist de produção

- `CLAUDE.md`: item **Skubo IA** em "Fonte da verdade", variáveis novas em "Environment Requirements", nota do e2e e "Ciclo atual" → Ciclo 15.
- `env.example`: todas as variáveis `IA_*`, `ANTHROPIC_WORKSPACE_ID` e `NEXT_PUBLIC_SUPORTE_URL`, com os preços de tabela de outubro de 2026 como ponto de partida.
- `docs/MANUAL-DO-USUARIO.md` e `/ajuda/manual`: seção "Assistente IA (Skubo IA)" — o que perguntar, exemplos, botões nas telas, resumo semanal, limites, quem vê o quê, privacidade e como contratar.
- `docs/GUIA-DE-CONFIGURACAO.md`: seção 5 reescrita (chave e workspace, preços e orçamento, cobrança, liberação manual, kill switch, crons, onde acompanhar) e checklist de ida ao ar atualizado.

### Bateria final

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit` | limpo |
| `npm run lint` | sem avisos nem erros |
| `npm test` | **152 arquivos, 909 testes passando** (antes do ciclo: 136 arquivos, 789 testes) |
| `npm run build` | ok — inclusive sobre um banco Postgres **vazio** (valida a correção do `migrate-deploy`) |
| `npm run test:e2e` | **20 passando, 19 pulados de propósito (cada fluxo roda no viewport que interessa), 0 falhas**, nos 3 viewports, com Postgres descartável, `IA_PROVEDOR_FALSO=1` e `IA_CONTAS_LIBERADAS=e2e@skubo.test` |
| Migrações | `prisma migrate diff` (migrações → schema) **vazio** depois de `20261108090000_ciclo15_skubo_ia` |
| Revisão visual | painel lateral (claro, desktop 1440), tela cheia no celular 390 (escuro), página `/ia` (escuro) e cartão da `/assinatura` (claro) — achado e corrigido um selo de status com contraste baixo (verde sobre o roxo do cartão) |

### Teste com a chave real

A chave é de usuário (`sk-ant-usr-…`) e só funciona com o cabeçalho `anthropic-workspace-id`; com o workspace informado (`ANTHROPIC_WORKSPACE_ID`), o teste real passou pelo próprio núcleo do app, sobre os dados do banco de teste:

| Chamada | Resultado |
|---|---|
| Haiku 5.5 e Sonnet 5.5 (texto simples, Sonnet com `fallbacks: "default"`) | ok, ~1,1 s cada |
| Assistente: "Quanto vendi nos últimos 30 dias e o que preciso comprar?" | 5,1 s; chamou `resumo_financeiro` e `sugestao_reposicao` **em paralelo**; resposta em português com os números do banco e links para Financeiro e Reposição; a 2ª chamada do turno leu 6.237 tokens do cache de prompt |
| Análise da Central (saída estruturada) | 11,9 s; 5 prioridades e 5 riscos, JSON válido |
| "Por que essa sugestão?" (Haiku) | 1,4 s |
| "Explicar variação" (Sonnet, estruturada) | 6,3 s; 3 motivos com números |

Custo estimado observado: ~R$ 0,13 por pergunta no assistente e ~R$ 0,11 por análise — o orçamento padrão de R$ 10/mês dá ~70 perguntas por conta. A chave nunca foi gravada no repositório.

### Decisões tomadas sem consulta (resumo)

1. Saída estruturada (`output_config.format`) em vez de `tool_choice` forçado (400 no Sonnet 5.5).
2. Preços separados opcionais para o modelo rápido (`IA_PRECO_RAPIDO_*`).
3. Fallback de recusa no servidor ligado nos modelos que aceitam; chamadas pelo namespace `beta` do SDK.
4. Esforço `low` no chat e no modelo rápido, `medium` nas análises.
5. `ANTHROPIC_WORKSPACE_ID` opcional, por causa do tipo de chave recebida.
6. `vendas_por_produto` sobre `gerarLucroPorProduto` (fonte da tela Financeiro → Produtos), não `agruparVendas`.
7. Atalho `Ctrl/Cmd + J` (o `K` já é da paleta de comandos).
8. Só o texto final dos turnos anteriores volta ao modelo (compatível com a checagem de histórico dos modelos 5.5).
9. Pergunta descartada quando o provedor falha antes de qualquer texto (evita duplicar no "Tentar de novo").
10. "Apagar todas as conversas" em `/ajustes` (não em `/configuracoes`, que desde o Ciclo 13 é só o retorno do OAuth).
11. Resumo semanal agendado a cada 10 min das 11:00 às 12:50 UTC de segunda (em vez de uma execução só), para o orçamento de 50 s por execução dar conta de todas as contas.
12. Pedido manual de ativação mantido só como alternativa sem Mercado Pago.
13. Cache das explicações separado por perfil de custo.
14. Período `90d` adicionado às ferramentas para acompanhar a Visão geral.
15. Correção do `migrate-deploy` para banco vazio (bug pré-existente achado no e2e).

### Riscos conhecidos

- **Custo estimado ≠ fatura**: depende dos preços configurados e da cotação; serve para o limite por conta e para a margem do add-on, não substitui a fatura da Anthropic. O teto no console da Anthropic é a trava final.
- **Cache das explicações em memória** quando não há Upstash: vale por instância serverless (pode gerar a mesma explicação mais de uma vez no dia). Com `UPSTASH_REDIS_*` configurado é compartilhado.
- Sem Upstash, o limite de perguntas (20/10 min) e de explicações (30/10 min) é contado **no banco** (`src/modules/ia/limite.ts`), então vale entre instâncias; com Upstash, usa o Redis.
- **Webhook da IA não testado contra o Mercado Pago real** (sem credenciais aqui); a lógica é coberta por testes com os payloads documentados. Fazer o checkout real até a tela do MP no go-live.
- O provedor falso escolhe a ferramenta por palavras-chave; ele existe só para e2e e nunca deve estar ligado em produção.

### Próximos passos sugeridos

- Medir no admin, depois de 2 semanas, o custo médio por pergunta e ajustar `IA_ORCAMENTO_MENSAL_CENTAVOS` e o preço do add-on.
- Usar a lista de 👎 (`/admin/ia/feedback`) para ajustar o prompt.
- Avaliar ferramentas de escrita (por exemplo, "gerar o pedido de compra sugerido") com confirmação explícita do usuário — hoje tudo é somente leitura, de propósito.

### Checklist de go-live

- [ ] Variáveis na Vercel: `ANTHROPIC_API_KEY` (chave de workspace, ou `ANTHROPIC_WORKSPACE_ID` junto), `IA_MODELO`, `IA_MODELO_RAPIDO`, preços `IA_PRECO_*` conferidos na página oficial de preços da Anthropic, `IA_COTACAO_DOLAR`, `PLATFORM_ADMIN_EMAILS`, `CRON_SECRET`, credenciais do Mercado Pago (`MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`), `NEXT_PUBLIC_SUPORTE_URL`.
- [ ] `IA_PROVEDOR_FALSO` **ausente** em produção.
- [ ] `npx prisma migrate deploy` no banco de produção (com backup antes) — o `npm run build` já roda; inclui as migrações do ciclo 14 e a `20261108090000_ciclo15_skubo_ia`.
- [ ] Crons `ia-limpeza` e `ia-resumo-semanal` aparecendo na Vercel.
- [ ] Webhook do Mercado Pago apontando para `/api/mercadopago/webhook` (o mesmo já usado).
- [ ] Permissão "Notas fiscais (leitura)" ativa no app do Bling e conta reconectada.
- [ ] Teste de fumaça em produção: login, Central de controle, assistente (1 pergunta), Reposição "Por que essa sugestão?", checkout do add-on até a tela do Mercado Pago, `/admin` com o bloco de IA.
- [ ] Limite mensal da Anthropic configurado no console dela (teto de gasto), além do orçamento por conta no Skubo.
- [ ] Revogar a chave `sk-ant-usr-…` que foi colada no chat e usar uma nova.
- [ ] Incluir o parágrafo sobre o processamento pela Anthropic na política de privacidade publicada no site (o app não tem página de política).


## Fechamento — "completo de uma vez por todas" e deploy

### Pendências antigas fechadas

- **CMV retroativo** (pendência do Ciclo 8, item 6): cadastrar o custo de um produto não atualizava as vendas que já estavam sem custo — o item "Vendas do mês sem custo (CMV)" da Central de controle nunca sumia. Novo `preencherCustoDasVendasSemCusto` (em `ingestao/sincronizador.ts`, mesmo cálculo de `revincularVendasDoAnuncio`): só preenche itens com custo vazio, nunca sobrescreve custo histórico, alcança kits que usam o componente e processa em lotes de 300. Chamado ao salvar o custo do produto, na importação de custos por planilha, ao confirmar um pedido de compra e, como rede de segurança (Bling, importações), no cron `financeiro-diario`. 6 testes.
- **Botão "Atualizar"** (Ciclo 8, item 7) agora também em Fluxo de caixa, Cartões e Vendas → Por produto.
- Pendências do Ciclo 7 já cobertas: o filtro por produto em Vendas existe pela busca textual; a importação de histórico não tem mais botão próprio (a sincronização da Central/Financeiro cuida disso).
- Continuam dependendo de dado real do Mercado Livre/Bling (não dá para fechar sem uma conta conectada olhando o payload): mapeador de `claims`, vendas de outros canais via Bling, devolução parcial por item, campos da NF do Bling. `cancelamentoNaCompetencia` fica inerte de propósito (não aparece na tela).

### IA — endurecimento para produção

- Limite de requisições no banco quando não há Upstash (produção não tem).
- **Admin → Visão geral → Skubo IA → "Testar conexão com a IA"**: chama o modelo principal e o rápido e mostra chave, workspace, preços, kill switch e o erro técnico, se houver — funciona mesmo com `IA_DESLIGADA`.
- `pontoPedido` arredondado para cima nas ferramentas (a explicação real mostrava "11,155 unidades").

### Verificações antes do deploy

- Backup do banco de produção (Neon, Postgres 16, 26 MB) com `pg_dump -Fc` antes de qualquer migração.
- **Ensaio das migrações sobre a cópia restaurada desse backup**: as 3 pendentes (`ciclo14_notas_fiscais_venda`, `ciclo14_analise_ia`, `ciclo15_skubo_ia`) aplicaram, `prisma migrate diff` banco → schema vazio, dados preservados.
- **As 12 ferramentas rodadas localmente sobre os dados reais das 11 contas da cópia** (nada enviado à Anthropic): zero falhas; a maior conta (3.078 vendas) ficou dentro do limite de tamanho.
- Bateria: tsc limpo, lint limpo, Vitest, `npm run build` e Playwright (20 passando, 0 falhas).

### Configuração de produção (Vercel, projeto `estoque-api-pstock`)

Variáveis adicionadas: `ANTHROPIC_API_KEY` (sensível), `ANTHROPIC_WORKSPACE_ID`, `IA_MODELO`, `IA_MODELO_RAPIDO`, `IA_PRECO_*` (Sonnet 5.5: 2 / 10 / 0,2 / 2,5; Haiku 5.5: 0,1 / 0,5 / 0,01 / 0,125 — US$ por milhão de tokens, tabela de out/2026), `IA_COTACAO_DOLAR`, `PLATFORM_ADMIN_EMAILS`, `IA_CONTAS_LIBERADAS` (a conta do dono da plataforma) e **`CRON_SECRET`** — que não existia: todas as rotas `/api/cron/*` respondiam 401 em produção, ou seja, nenhum cron (renovação de token do Bling, sincronização, Financeiro diário, catálogo) rodava.

Deixado de fora de propósito: **`TOKEN_ENCRYPTION_KEY`**. O código aceita ligar a qualquer momento (tokens antigos sem o prefixo `enc:v1:` continuam legíveis), mas é uma porta de mão única: assim que os tokens forem regravados criptografados, um rollback para um deploy anterior (sem a chave) derruba ML e Bling. Ligar depois que esta versão estiver estável, em `production`, `preview` e `development` (as três usam o mesmo banco), e nunca mais trocar. `MP_ACCESS_TOKEN`/`MP_WEBHOOK_SECRET` dependem das suas credenciais do Mercado Pago — sem elas a assinatura não bloqueia ninguém e o "Assinar" do Skubo IA vira pedido de ativação.
