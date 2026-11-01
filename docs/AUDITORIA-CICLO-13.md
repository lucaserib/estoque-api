# Auditoria — Ciclo 13: de MVP a produto final

Registro vivo da execução de `PROMPT-CICLO-13-PRODUTO-FINAL.md` (raiz). Leia também `docs/ANALISE-CRITICA-PRODUTO.md` (diagnóstico de produção de 24/10) e `docs/AUDITORIA-CICLO-12.md`.

## FASE 0 — Publicar o que estava pronto e criar a rede de segurança

### Item 1 — Commits do que já estava pronto

O working tree tinha trabalho real de três frentes diferentes misturado, sem commit. Separado em três commits (arquivo por arquivo, não por trecho — alguns arquivos como `Sidebar.tsx`/`blingProductSync.ts` carregavam conteúdo de mais de uma frente e ficaram no commit onde a maior parte do conteúdo já estava documentada):

1. `feat: fonte única de vínculo e lista paginada de produtos (Ciclo 12 Fase 1)` — sidebar com rolagem própria, mês atual como padrão, lista de produtos paginada no servidor, serviço único de vínculo com kit de quantidade, cadastro rápido pelo Bling.
2. `fix: fatura do ML contada duas vezes na DRE e acabamento da auditoria de 24/10` — a correção do `mapeadorCobrancas.ts` (famílias `CVV*`/`CFON*`/`CFF*`) com a migração de reclassificação, cartões sem sobreposição, toast com fundo sólido, mensagens de escopo do Bling, PWA instalável.
3. `docs: diagnóstico e plano do Ciclo 13, identidade visual do Skubo` — os documentos do próprio ciclo e os arquivos prontos da marca (`public/brand/skubo/`), que a Fase 1 vai aplicar.

`npx tsc --noEmit`, `npx next lint` e `npm test` (686 testes) limpos antes do push. `npm run build` completo (com `prisma migrate deploy` real) não pôde ser verificado neste ambiente por não ter `DATABASE_URL` — verificado com `npx next build` isolado (sem o passo de migração) e, à parte, com um Postgres local descartável rodando a migração completa (ver item 2). Push feito para `origin/master` (`777d78e..03996cc`).

### Item 2 — Testes de navegador (Playwright) e a rede de segurança que isso exigiu

Ao montar o banco de teste semeado pedido pela Fase 0, `prisma migrate deploy` **falhou num banco novo, do zero** — não é um problema introduzido agora, é um buraco que já existia no histórico de migrações:

- **`bling_accounts`, `bling_sync_history` e `stock_replenishment_config` nunca tiveram um `CREATE TABLE` em nenhuma migração.** As três existem em produção (criadas em algum momento fora do fluxo de migração — `db push` ou SQL manual), então ninguém notou; mas qualquer banco novo (um ambiente de CI, uma cópia para um dev novo, um restore de desastre) quebra ao tentar rodar `prisma migrate deploy` do zero. Corrigido com uma migração aditiva (`20261003140000_bling_e_reposicao_tabelas_base`, `CREATE TABLE IF NOT EXISTS` + `FOREIGN KEY` guardada com `DO $$ ... EXCEPTION WHEN duplicate_object`) inserida cronologicamente antes da primeira migração que já fazia `ALTER TABLE` nelas — não muda nada em produção (as tabelas já existem lá), só conserta o bootstrap do zero.
- Depois de corrigir isso, `prisma migrate diff` contra um banco 100% migrado ainda apontava mais divergência: uma coluna (`produtos_mercado_livre.mlSold90Days`) nunca adicionada por migração, `produtoId` que deveria ser opcional e não estava, um índice único que deveria ter sido removido, e três índices com nomes truncados de um jeito diferente do que o schema atual geraria. Tudo corrigido numa segunda migração aditiva e idempotente (`20261101000000_ciclo13_sincroniza_drift_schema`, com `IF NOT EXISTS`/`IF EXISTS` e blocos `DO $$ ... IF EXISTS/NOT EXISTS` nos renames de índice, para não quebrar se o nome em produção já estiver diferente do que o diff local viu).
- Verificado depois das duas migrações: `prisma migrate diff` contra o schema atual devolve "This is an empty migration" — banco novo e `schema.prisma` batem exatamente.
- `prisma/seed.ts` ganhou uma segunda etapa (`seedE2E`), sempre executada depois dos dados aleatórios de desenvolvimento: usuário fixo `e2e@skubo.test`, 1 conta ML e 1 Bling (tokens falsos, nunca chamam a API de verdade), 18 produtos + 2 kits determinísticos, 60 vendas em 2 meses (geradas passando os dados brutos por `calcularVenda` de verdade, para a margem gravada bater com o que qualquer tela vai mostrar) e cobranças da fatura com os sub-tipos reais `CVVML`/`CFFE`/`CVVPRC` (via `mapearCobranca`, a mesma função de produção — nada inventado). Também idempotente (apaga e recria os dados do usuário e2e a cada execução).
- Achado e corrigido de passagem: a seção de dados aleatórios do `prisma/seed.ts` (preexistente) não era idempotente — rodar o seed duas vezes no mesmo banco quebrava em SKU duplicado, o que também quebraria `npm run test:e2e` numa segunda execução contra o mesmo banco de teste. Agora pula a geração aleatória (mantendo o e2e sempre fresco) se o usuário de desenvolvimento já tiver produtos.
- `playwright.config.ts` + `e2e/global-setup.ts` (roda `migrate deploy` e `db seed` antes da suíte) + `e2e/*.spec.ts`, cobrindo os 5 cenários mínimos do prompt, nos três tamanhos (1440×900, 1366×680, 390×844):
  1. login → Visão geral sem nenhum texto sobreposto (checado por `boundingBox` de todo par de elementos dentro de cada cartão) e sem rolagem horizontal.
  2. Sidebar: com Financeiro aberto em 1366×680, "Usuários" continua clicável (pulado no celular, onde a navegação é outra).
  3. Financeiro: margem do cartão do topo = soma da coluna Margem do bloco "Por logística".
  4. DRE: soma de todas as linhas de componente (as com prefixo `(−)`/`(+)`/`(±)` mais "Vendas brutas") fecha com a última linha de subtotal (Lucro líquido).
  5. Vincular o anúncio "Kit 2 ..." (sugestão automática de 2 unidades pelo título) e conferir que a venda que usava esse anúncio deixa de aparecer sem custo (pulado nos projetos 1366×680/390×844 — é um fluxo de escrita, não um teste de layout por tamanho, e rodar de novo encontraria o botão já trocado por "Editar").
  - **Rodado de verdade nesta sessão** (não só escrito): Postgres local descartável, `npx playwright install chromium`, `next build` + `next start`, suíte completa nos três tamanhos. Resultado: **12 passaram, 3 pulados (como esperado), 0 falharam**. `npm run test:e2e` no `package.json`.
- CI (GitHub Actions) para rodar isso automaticamente a cada push/PR **não foi criado nesta sessão** — exigiria decidir onde o Postgres de teste do CI vive (serviço do GitHub Actions vs. banco gerenciado) e configurar segredos novos, uma decisão de infraestrutura que não cabe dentro da mesma execução sem confirmar com o Lucas. `npm run test:e2e` já funciona local ou em qualquer CI que forneça um `DATABASE_URL` descartável.

### Item 3 — Monitoramento (Sentry)

- `tracesSampleRate: 0.1` **já estava ligado** nos três configs (`sentry.server.config.ts`, `sentry.edge.config.ts`, `src/instrumentation-client.ts`) — nada a fazer aqui.
- `onRequestError` (`src/instrumentation.ts`) já capturava os erros que escapam até o Next.js, mas sem `contaId` — e a maioria das rotas de API deste app **trata o próprio erro** (`catch { console.error(...); return NextResponse.json(...) }`), então o erro nunca chegava a esse hook global. Resolver isso rota por rota não cabe nesta fase (são centenas de rotas). Adicionado o que dá para fazer no único ponto central que toca toda rota: `onRequestError` agora decodifica o cookie de sessão (mesma lógica do `verifyUser`, sem round-trip ao banco) e marca o erro com a tag `contaId` antes de mandar pro Sentry — sem e-mail, nome ou qualquer outro dado pessoal. 7 testes novos (`src/__tests__/instrumentation.test.ts`) cobrindo cookie seguro/inseguro, token inválido, sem segredo configurado, sem cookie, e o formato de array que o Node às vezes entrega.
- Alerta para erro novo: **não dá para configurar por código** — é um alerta dentro do projeto Sentry (Settings → Alerts), que exige acesso ao dashboard do Sentry do Lucas. Anotado em "Passos manuais" abaixo.

### Resultado ao final da fase
`tsc`/`lint`/`test` limpos; `npm test` com 735 testes passando (7 novos). `next build` completo. Suíte e2e rodada de ponta a ponta (Postgres local descartável) nos três tamanhos: 12 passaram, 3 pulados, 0 falharam.

## Passos manuais do Lucas (Fase 0)
- [ ] Rodar `npm run build` local antes do próximo deploy, para aplicar as duas migrações novas (`20261003140000_bling_e_reposicao_tabelas_base` e `20261101000000_ciclo13_sincroniza_drift_schema`) em produção — são aditivas e não tocam dados, mas valem a conferência de praxe.
- [ ] No Sentry (Settings → Alerts do projeto): criar um alerta para "erro novo" (issue nunca vista antes). Não dá para fazer por código.
- [ ] Decidir, quando chegar a hora de configurar CI: onde roda o Postgres descartável dos testes e2e (serviço do GitHub Actions é a opção mais simples) — fora do escopo desta sessão.
