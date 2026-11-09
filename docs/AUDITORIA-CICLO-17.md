# Auditoria — Ciclo 17 (cérebro da operação: tarefas, quadros e ideias da equipe)

Plano: `PROMPT-CICLO-17-CEREBRO-DA-OPERACAO.md`. Nada foi commitado: o Ciclo 16 ainda está no diretório de trabalho esperando revisão e o Ciclo 17 depende das migrações dele, então os dois ficam juntos para revisão com `git diff`.

## Decisões tomadas sozinho

| Decisão | Por quê |
|---|---|
| Todo o schema do ciclo numa migração só (`20261108100100_ciclo17_fase0_operacao`) | As fases seguintes só usam o que já existe; uma migração aditiva é mais simples de revisar e de aplicar. |
| `Tarefa.colunaId` com `ON DELETE NO ACTION` (não `RESTRICT`) | Com `RESTRICT`, apagar um quadro ou a conta (exclusão LGPD) falharia: o Postgres checa na hora, antes de a cascata apagar as tarefas. `NO ACTION` checa no fim do comando. Apagar só uma coluna continua exigindo mover as tarefas antes (regra da aplicação). |
| Número da tarefa por conta numa tabela de sequência (`INSERT … ON CONFLICT DO UPDATE … RETURNING`) | `MAX + 1` repete número com dois cadastros ao mesmo tempo. |
| Estrutura padrão criada no primeiro acesso sob `pg_advisory_xact_lock` | Duas abas abrindo a tela juntas criariam dois quadros "Operação da loja". |
| Prazo só com dia vence às 23:59:59.999 de São Paulo | "Atrasada" passa a ser só `prazo < agora`, sem caso especial; hoje/semana pelo calendário de São Paulo, igual ao Financeiro. |
| Recorrência gera a próxima ao concluir, sempre no futuro | Uma rotina diária concluída com 5 dias de atraso não deve criar 5 tarefas vencidas. `@@unique([serieId, prazo])` impede duplicar se concluírem duas vezes. |
| Na captura rápida, dia da semana é sempre o próximo (nunca hoje) e abreviações (`seg`, `sex`, `dom`) não contam | "sexta" dito numa sexta quer dizer a próxima; abreviações colidem com palavras comuns do título. |
| Vínculo só aceita caminho interno (`/…`, sem `//` nem `\`) | O vínculo vira link na tela; aceitar URL externa abriria redirecionamento para fora e `javascript:`. |
| Menção gravada como `@[Nome](id)` e validada contra a conta no servidor | Notificar só quem é da loja; menção a id de fora vira texto simples. |
| Quem tem papel LEITURA vê tudo, mas não edita nem recebe tarefa | Coerente com o papel; uma tarefa atribuída a quem não pode concluí-la ficaria parada. |
| Tarefa nova (captura rápida, botão flutuante, "Criar tarefa" de outras telas, rotinas) já vem com **quem criou** como responsável, salvo `@pessoa` ou escolha de "Ninguém" | Sem isso a tarefa anotada pelo botão do celular não aparecia no "Meu dia" de quem anotou (o e2e pegou) e a loja acumulava tarefas órfãs. Passar adiante é um toque. |

## Fase 0 — Fundação

- Migração `20261108100100_ciclo17_fase0_operacao`: `QuadroTarefas`, `ColunaTarefas`, `Tarefa`, `EtiquetaTarefa`, `TarefaEtiqueta`, `ItemChecklistTarefa`, `ComentarioTarefa`, `AtividadeTarefa`, `NotaOperacao`, `SequenciaConta`, `User.emailTarefas`, `NotificationType.TAREFA`. Conferida: aplicada num banco vazio e na cópia de produção (11 usuários preservados), `prisma migrate diff` vazio nos dois.
- Permissões `TAREFAS_EDITAR` e `TAREFAS_ADMINISTRAR` em `src/lib/permissoes.ts`.
- Domínio puro em `src/modules/operacao/dominio/` (roda no navegador e no servidor): `posicao.ts`, `prazo.ts`, `recorrencia.ts`, `capturaRapida.ts`, `mencoes.ts`, `esquemas.ts` (limites, cores, padrões de e-commerce e todos os esquemas zod de entrada).
- Servidor: `contexto.ts` (contexto e permissões do usuário, membros da conta, numeração, estrutura padrão) e `erros.ts` (erros com status e resposta padrão das rotas).
- `periodo.ts` do Financeiro passou a exportar os utilitários de calendário de São Paulo que já tinha (`diaEmBrasilia`, `instanteEmBrasilia`, `somarDiasAoDia`, `horaEmBrasilia`).
- Testes: `dominio.test.ts` (22) e `estrutura.banco.test.ts` (3, Postgres real: primeiro acesso simultâneo cria um quadro só, numeração sem repetição com 20 em paralelo, exclusão da conta leva tudo em cascata).

## Fase 1 — API

- Serviços em `src/modules/operacao/`: `tarefas.ts` (criar com idempotência por `chaveOrigem`, editar com controle de versão e histórico por campo, mover com posição entre vizinhos e renumeração, conclusão/reabertura pela coluna, próxima ocorrência da rotina, concluir/reabrir/arquivar/restaurar/duplicar, excluir de vez), `quadros.ts` (quadros, colunas e etiquetas com as regras de papel), `checklist.ts`, `comentarios.ts` (menções validadas), `consultas.ts` (início, quadro com cartões, lista paginada, resumo pessoal e da equipe), `filtros.ts`, `serializacao.ts`, `avisos.ts` (notificações no app; o e-mail entra na Fase 5) e `tipos.ts` (contratos usados pelas telas).
- 17 rotas em `src/app/api/operacao/` (todas com `verifyUserAtivo` + `permissaoErrorResponse`, entrada validada por zod, erros padronizados por `respostaErroOperacao`); limite de 120 tarefas/hora e 60 comentários/10 min por pessoa.
- Regras confirmadas em teste: a origem repetida devolve a tarefa aberta (inclusive com duas criações simultâneas) e libera uma nova depois de concluída; entrar numa coluna de concluídas conclui e sair reabre; a rotina gera a próxima uma vez só mesmo com reabrir e concluir de novo; versão antiga dá 409; outra loja recebe 404 em tudo; colunas sempre com "a fazer" e "concluídas"; apagar coluna com tarefas exige destino (e conclui se o destino for de concluídas); não arquiva o último quadro e passa o padrão adiante; concluídas há mais de 14 dias saem do quadro (continuam na lista); LEITURA só lê.
- Limite de cartões por coluna (WIP) é **aviso**, não bloqueio: a resposta do mover traz o texto e a tela mostra. Bloquear no meio de um arrastar frustra mais do que ajuda numa loja pequena.
- Testes: `tarefas.banco.test.ts` (15, Postgres real).

## Fase R — Funil de indicação completo (pedido durante o ciclo)

Auditoria de ponta a ponta do funil do Ciclo 16. Os ganchos estavam ligados (cadastro por e-mail e por Google, conexão do ML, pagamento e estorno no webhook, cron de carência, recompensa, admin). Corrigido e completado:

| Problema | Correção |
|---|---|
| **Defeito:** loja indicada que pagava *antes* de conectar o Mercado Livre nunca liberava a recompensa — `aoConectarMercadoLivre` só marcava `ativadoEm` no status "Criou a conta" | Marca `ativadoEm` também em "Assinou"/"Em carência"; o cron recompensa na próxima rodada |
| **Defeito:** indicações paradas esperando o ML ocupavam o lote de 200 do cron para sempre (ordenado pela carência mais antiga) — com volume, as novas nunca seriam avaliadas | A consulta já exclui quem espera o ML; a contagem delas sai num `count` separado |
| Loja que já tinha o ML conectado ao entrar com o código ficava esperando um evento que não viria | A indicação nasce como "Conectou o Mercado Livre" |
| Quem recebia o link não via de quem era o convite nem o que ganhava; código inválido passava sem aviso | `GET /api/indicacao/convite` (público, 30/min por IP, só nome da loja ou primeiro nome): faixa "X convidou você… você ganha 5 perguntas" em `/planos` e no cadastro, e validação ao digitar o código (cadastro e `/boas-vindas`) |
| Quem esqueceu o código no cadastro não tinha como informar depois | "Foi indicado por alguém?" em `/indique` (`POST /api/indicacao/codigo`): só o dono da conta, nos primeiros 14 dias, antes do primeiro pagamento, sem indicação anterior e nunca o próprio código; 10 tentativas/hora |
| Quem indicou só sabia da indicação no cadastro e na recompensa | Notificação quando a loja indicada assina, com a data em que os dias saem (ou o aviso de que falta conectar o ML) |
| Status "Assinou · aguardando a carência" mesmo quando o que faltava era o ML; sem próximo passo | Rótulo "Assinou · falta conectar o Mercado Livre" (também no admin, com a contagem) e o próximo passo de cada indicação em `/indique` |
| Celular: só WhatsApp e botão de copiar de 32 px | Botão **Compartilhar** (folha nativa do celular, quando o navegador oferece) e áreas de toque de 40–44 px |

Testes: `fluxo.test.ts` (+2), `cadastro.test.ts` (+1), `convite.test.ts` (novo, 4); e2e `08-crescimento` passa a conferir a faixa do convite em `/planos` e no cadastro e o código informado depois.

## Fase 2 — Quadro, detalhe e nova tarefa

- `src/components/operacao/`: `QuadroKanban` (dnd-kit 6.3.1/10.0.0/3.2.2, fixados; mouse com 6 px, toque longo de 250 ms, teclado; atualização otimista que volta atrás se o servidor recusar; recarrega a cada 20 s com a aba visível e ao voltar para a aba), `CartaoTarefaView` (número, etiquetas, prazo colorido pela situação, checklist, comentários, vínculo, prioridade, responsável e menu **Mover para…**), `DetalheTarefa` (folha lateral; tela cheia no celular com **Concluir** fixo no rodapé), `NovaTarefa` (global, aberta por evento de qualquer tela), `GerenciarQuadro`/`NovoQuadro` (só ADMIN), `FiltrosTarefas` (selects nativos; no celular, numa folha que sobe de baixo), `CapturaRapida` (mostra o que entendeu antes de criar), `Folha`, `OperacaoContexto` (equipe, etiquetas, quadros e permissões carregados uma vez, cache de 60 s).
- Navegação: "Tarefas e ideias" no menu lateral, **Tarefas** no menu inferior do celular (6 itens, com `min-w-0` para não estourar em 390 px), "Nova tarefa" e "Anotar uma ideia" na paleta de comandos (`/operacao?nova=1`, `/operacao/ideias?nova=1`), botão flutuante na área de operação.
- `?tarefa=<id>` abre o detalhe em qualquer aba (links das notificações e e-mails).

## Fase 3 — Meu dia, lista e calendário

- **Meu dia** (`/operacao`): saudação, captura rápida (sem `@` a tarefa fica com quem anotou), contadores (atrasadas, hoje, próximos 7 dias, feitas na semana), seções com concluir em um toque e **Desfazer**, aviso de tarefas sem responsável, painel da equipe para o ADMIN e rotinas sugeridas quando não há nada.
- **Lista**: filtros (pessoa, etiqueta, prioridade, situação — abertas, atrasadas, hoje, 7 dias, sem prazo, concluídas, arquivadas), ordem, quadro, "Carregar mais" até 200; aceita `?responsavel=` e `?situacao=` vindos do Meu dia.
- **Calendário**: grade do mês no computador (arrastar para outro dia muda o prazo; "+" no dia cria com aquele prazo) e agenda por dia no celular, com as atrasadas do mês no topo.
- **Rotinas sugeridas** (antecipadas da Fase 5): 9 rotinas de e-commerce (perguntas do ML diária, Full semanal, Central de controle, pedidos atrasados, saúde dos anúncios, compras da semana, despesas e conferência do mês, contagem de estoque), criadas com prazo, repetição, etiqueta, checklist e link para a tela certa. A chave de origem passa para a próxima ocorrência, então a mesma rotina nunca é criada duas vezes.

## Fase 4 — Ideias e notas

- Serviço `notas.ts` + 4 rotas (`/api/operacao/notas…`): nota privada só para quem escreveu (nem o ADMIN vê — 404 até para ele), nota da equipe editada pelo autor ou ADMIN, só o autor muda quem vê, apoio às ideias com `array_append`/`array_remove` num `UPDATE` só (sem corrida), ordem por arrastar, fixar, arquivar, apagar.
- Tela `/operacao/ideias`: mural com cores, filtros (tudo, ideias, notas, só minhas, arquivadas), busca, fixadas no topo, arrastar para ordenar, **Virar tarefa** (abre a nova tarefa já preenchida e a nota mostra "Virou a tarefa #N"); no celular, uma coluna e o botão flutuante cria nota.
- Testes: `notas.banco.test.ts` (5).

## Fase 5 — Rotina e avisos

- E-mails `tarefa-atribuida`, `tarefa-mencao` e `resumo-tarefas` (transacionais, pela fila), só para quem deixou ligado **Perfil → Tarefas → Avisos de tarefas por e-mail** (`User.emailTarefas`, padrão ligado, disponível para todos os papéis). No app, os avisos chegam sempre.
- Anti-repetição: atribuição 1 e-mail por tarefa/pessoa/dia, menção 1 por tarefa/pessoa/hora, resumo 1 por pessoa/dia.
- Cron `tarefas-diario` às 11:00 UTC (8h de São Paulo): notificação + e-mail com atrasadas e as de hoje (até 5 de cada), só para contas ativas; para antes de 45 s e a próxima execução continua.
- Texto do usuário (título, comentário) passa por `textoLivreSeguro` antes de entrar no Markdown do e-mail — sem isso, um título `[clique](site)` viraria link no e-mail.
- Testes: `avisos.banco.test.ts` (4).

## Fase 6 — Integrações com o resto do Skubo

- **Criar tarefa** a partir de: cada item da Central de controle (`controle:<item>`, prioridade alta se for crítico, link para a ação do item), cada linha da Reposição (título já diz o que fazer — "Enviar N un. de X para o Full" ou "Comprar N un. de X" —, `reposicao:<produto>`, ligada ao produto), cada grupo da Saúde dos anúncios (lista os anúncios na descrição, `anuncios:<categoria>`), a ficha do produto (sem chave: pode haver várias tarefas por produto) e o detalhe do pedido de compra em aberto (`pedido:<id>`). A chave impede duplicar: clicar de novo avisa "Já existe uma tarefa aberta para isso" e oferece abrir.
- Cartão **Minhas tarefas** na Visão geral (atrasadas, para hoje e as 3 próximas; some quando não há nada).
- **Busca global** e paleta de comandos encontram tarefas por título ou `#número`.
- **Skubo IA**: ferramenta somente leitura `tarefas_da_equipe` (atrasadas, hoje, 7 dias, sem prazo, abertas, concluídas; filtro por pessoa; resumo por pessoa só para ADMIN), disponível para todos os papéis; passa pelos mesmos filtros de saída das outras ferramentas.
- Bateria ao fim da fase: `tsc` limpo, lint limpo, Vitest **184 arquivos / 1117 testes**.

## Fase 7 — Fechamento

- E2E `e2e/09-operacao.spec.ts`: Meu dia com captura rápida (prazo, etiqueta e prioridade entendidos, sem rolagem horizontal) nas três resoluções; quadro com adicionar na coluna, **arrastar com o mouse** e mover pelo menu até "Feito" (persistido após recarregar); detalhe com checklist, comentário, prioridade, prazo, concluir e histórico; **fluxo do celular** (menu inferior → Tarefas, nova tarefa em tela cheia, concluir/reabrir com o botão fixo no rodapé dentro da tela, voltar, abas de coluna, mover pelo menu, nota nova pelo botão flutuante, sem rolagem horizontal em Meu dia, quadro e ideias); ideias com apoio e virar tarefa; Central de controle sem duplicar, rotinas sugeridas e o cartão na Visão geral. O seed zera a operação da conta de e2e a cada execução.
- Correções achadas ao revisar os fluxos do e2e:
  - `/operacao?nova=1` disparava o pedido de "Nova tarefa" antes de o componente global escutar. Agora o pedido fica guardado até alguém ouvir (`ouvirNovaTarefa`).
  - Mudar dois campos seguidos no detalhe (prioridade e prazo) dava um falso "outra pessoa alterou". A versão só trava título e descrição; os outros campos mudam um a um sem se atropelar. Teste novo cobre duas edições simultâneas.
- Defeitos reais que o e2e pegou (todos corrigidos):
  - **CSS global antigo** (`styles/global.css`) desliga o clique de todo elemento cuja classe contenha `absolute` (`*[class*="absolute"] { pointer-events: none }`). O botão de enviar da captura rápida era `absolute` e não recebia clique nem toque (só o Enter funcionava); a faixa de prioridade do cartão usava `before:absolute`, o que tirava o clique da área do cartão fora dos botões (atrapalhando segurar para arrastar). Captura rápida virou uma linha flexível e a faixa virou borda esquerda. **Atenção para quem mexer no front:** não use `absolute` em elemento clicável.
  - No celular, o botão flutuante "Nova tarefa" ficava embaixo do botão flutuante do Skubo IA. O botão da IA agora se afasta em toda a área `/operacao`, como já fazia em Produtos e Pedidos.
  - A folha (painel lateral/tela cheia) tinha animação de saída; nesses ~300 ms o Radix mantém a página sem clique, e um clique logo depois de fechar se perdia (reproduzido 3 de 3 vezes num roteiro isolado). A folha agora fecha sem animação de saída e devolve o clique na hora (3 de 3 depois da correção).
  - Criar uma tarefa invalidava sem necessidade o cache de equipe/quadros; a "Nova tarefa" aberta logo em seguida ainda estava carregando e o "Criar tarefa" do rodapé não fazia nada. O cache não é mais invalidado por mudança de tarefa e o botão só habilita com o formulário pronto.
- Documentação: `CLAUDE.md` (fonte da verdade da Operação, e2e, ciclo atual), `docs/MANUAL-DO-USUARIO.md` e `/ajuda/manual` (seção Tarefas e ideias), `docs/GUIA-DE-CONFIGURACAO.md` (cron `tarefas-diario`, primeiro acesso, rotina do lojista).
- Durante a execução, o disco do computador chegou a 100% e o build falhou com `ENOSPC`. Apaguei só o cache de build do Next (`.next/cache`, 3,2 GB, regenerável). Vale liberar espaço na máquina.

## Bateria final

- `tsc` sem erros e `npm run lint` limpo.
- Vitest: **184 arquivos / 1118 testes** passando (com `TESTE_BANCO_URL`, os 5 arquivos de banco do módulo rodam contra Postgres real).
- `npm run build` ok.
- Playwright 01–09 nas três resoluções: **38 passando, 0 falhando** (43 pulados de propósito por resolução).
- O banco de testes local ficou corrompido quando o disco encheu (o sistema também apagou pastas vazias do `/tmp`); as pastas vazias do Postgres foram recriadas, sem perda de dado.

## Pendências deliberadas

- **Anexos em tarefas** (foto da nota, comprovante): ficaram de fora — exigem armazenamento de arquivos com controle de acesso por conta; o vínculo com telas do Skubo e a descrição com links cobrem o começo.
- **Ações em lote** (selecionar várias e concluir/atribuir): não entraram; a Lista já filtra e conclui em um toque.
- **Tempo real** (WebSocket): na Vercel não há conexão persistente; o quadro atualiza a cada 20 s e ao voltar para a aba, e o mover é otimista.
- **Reordenar itens do checklist pela tela**: a API aceita (`anteriorId`/`seguinteId`), a tela ainda só adiciona, marca e apaga.

## Produção (2026-11-09)

- Enviado a pedido do usuário junto com o Ciclo 16: commit `4ef3304` (Ciclos 16 e 17) e `573a2dc` (correção abaixo). Deploy da Vercel pronto; o build aplicou as 9 migrações (`20261108090100` a `20261108100100`) no banco de produção sem erro.
- Variáveis de produção hoje: **sem** `MP_ACCESS_TOKEN` (ninguém é bloqueado por assinatura; as contas antigas ficam em "teste" sem trava) e **sem** `RESEND_API_KEY` (e-mails só no log). Ligar cada um segue o checklist de `docs/AUDITORIA-CICLO-16.md` e `docs/GUIA-DE-CONFIGURACAO.md`.
- Teste de fumaça em produção: páginas públicas (`/login`, `/planos`, `/register`, `/termos`, `/privacidade`, `/indique/regulamento`, `/esqueci-senha`) 200; `/api/planos` 200; convite com código inexistente devolve `valido: false`; `/r/<código>` leva ao cadastro com o código; `/operacao` sem sessão vai para o login; cron sem token 401; Mercado Pago simulado desligado (404).
- **Correção feita na ida ao ar:** chamada de API sem sessão respondia 500 (e registrava erro interno) em quase todas as rotas — defeito antigo, de antes destes ciclos. `verifyUser` agora lança `NaoAutenticadoError` e `permissaoErrorResponse` devolve 401 (`NAO_AUTENTICADO`), mantendo as mensagens. Teste `src/lib/__tests__/naoAutenticado.test.ts`; bateria 185 arquivos / 1120 testes.
