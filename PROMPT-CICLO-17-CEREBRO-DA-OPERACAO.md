# Ciclo 17 — Cérebro da operação (tarefas, quadros e ideias da equipe)

## O princípio

Uma loja de e-commerce roda em cima de dezenas de pequenas obrigações que hoje vivem na cabeça do dono, em grupo de WhatsApp e em papel: mandar reposição pro Full, responder pergunta do Mercado Livre, cobrar fornecedor atrasado, cadastrar custo de produto novo, conferir o Financeiro do mês, testar uma ideia de kit. O Skubo já **mostra** o que está errado (Central de controle, Reposição, Saúde dos anúncios); falta o lugar onde a equipe **combina quem faz o quê e até quando** — e onde as ideias não se perdem.

O "cérebro da operação" é esse lugar, com três camadas:

1. **Capturar** — anotar qualquer coisa em segundos, de qualquer tela: uma tarefa ("Cobrar Fornecedor X amanhã @Ana #compras !alta"), uma ideia, uma nota.
2. **Organizar** — quadros no estilo kanban (arrastar entre colunas), prioridade, prazo, responsável, etiquetas, checklist, recorrência para as rotinas da loja.
3. **Executar e acompanhar** — "Meu dia" com o que está atrasado e o que vence hoje, lista com filtros, calendário, concluídas, avisos para quem recebeu ou foi mencionado, resumo diário, visão da equipe para o dono.

O diferencial em relação a um Trello genérico: **a tarefa nasce do próprio Skubo**. "Criar tarefa" num item da Central de controle, numa linha da Reposição, num anúncio com problema, num produto ou num pedido de compra cria a tarefa já com o vínculo (link de volta para a tela certa) e sem duplicar se clicarem duas vezes. O assistente de IA lê as tarefas (só leitura) para responder "o que está atrasado na equipe?".

Tudo é da **conta** (a loja): quadros, tarefas, etiquetas e notas de equipe são compartilhados com todos os usuários da loja, respeitando o papel de cada um. Notas privadas são só de quem escreveu.

## Conceitos e modelo de dados

| Conceito | Modelo | Regras |
|---|---|---|
| Quadro | `QuadroTarefas` | Da conta. Um quadro padrão "Operação da loja" é criado no primeiro acesso. Vários quadros (Compras, Marketing, Lançamentos…). Arquivar em vez de apagar. |
| Coluna | `ColunaTarefas` | Do quadro, com `papel`: `A_FAZER`, `EM_ANDAMENTO` ou `CONCLUIDA`. Entrar numa coluna `CONCLUIDA` conclui a tarefa; sair reabre. Todo quadro mantém pelo menos uma coluna `A_FAZER` e uma `CONCLUIDA`. Limite opcional de cartões (WIP). |
| Tarefa | `Tarefa` | Número sequencial por conta (`#123`), título, descrição, prioridade (baixa, média, alta, urgente), responsável (usuário da conta que pode editar tarefas), prazo (dia ou dia + hora, fuso de São Paulo), etiquetas, checklist, comentários, histórico, vínculo com o Skubo, recorrência, origem. `versao` para conflito de edição. |
| Etiqueta | `EtiquetaTarefa` | Da conta. Padrão de e-commerce criado no primeiro acesso: Compras, Estoque, Full, Anúncios, Financeiro, Atendimento, Marketing, Fiscal. |
| Checklist | `ItemChecklistTarefa` | Itens ordenáveis com quem marcou e quando. |
| Comentário | `ComentarioTarefa` | Com menções (`@pessoa`) validadas contra a conta. Autor edita e apaga; ADMIN apaga. |
| Histórico | `AtividadeTarefa` | Append-only: criou, editou, moveu, atribuiu, mudou prazo/prioridade, concluiu, reabriu, arquivou, restaurou, comentou, checklist, etiquetas. |
| Nota / ideia | `NotaOperacao` | `tipo` NOTA ou IDEIA, cor, fixada, visibilidade EQUIPE ou PRIVADA, ordem no mural, apoios da equipe (ideias), "virar tarefa" (guarda o vínculo). |
| Sequência | `SequenciaConta` | Contador atômico por conta (`INSERT … ON CONFLICT DO UPDATE … RETURNING`) para o número da tarefa. |

Ordem dos cartões: `posicao` em ponto flutuante; mover calcula o meio entre os vizinhos informados por id (o servidor confere que são da mesma coluna e da mesma conta) e renumera a coluna quando o espaço fica pequeno demais.

Prazo: dia sem hora é gravado como o fim do dia em São Paulo. Atrasada = prazo no passado, não concluída e não arquivada. Hoje / esta semana pelo calendário de São Paulo.

Recorrência (`recorrencia` JSON validado): diária, semanal (dias da semana) ou mensal (dia do mês), com intervalo e data final opcional. Ao concluir uma tarefa recorrente, a próxima ocorrência nasce com o próximo prazo, mesma série (`serieId`), sem duplicar (`@@unique([serieId, prazo])`).

Idempotência na criação a partir de sinais do Skubo: `chaveOrigem` única por conta (ex.: `controle:sem-custo`, `reposicao:<produtoId>`, `anuncio:<id>`). Clicar de novo abre a tarefa que já existe (se ainda aberta).

## Permissões

| Ação | ADMIN | COMPRAS | ESTOQUE | VENDAS | LEITURA |
|---|---|---|---|---|---|
| `TAREFAS_EDITAR` — ver, criar, editar, mover, comentar, notas | SIM | SIM | SIM | SIM | VER |
| `TAREFAS_ADMINISTRAR` — quadros, colunas, etiquetas, excluir de vez, ver painel da equipe | SIM | NAO | NAO | NAO | NAO |

- Só recebe tarefa quem pode editar tarefas (LEITURA não é responsável).
- Excluir de vez: só ADMIN e só tarefa arquivada. Arquivar e restaurar: quem edita.
- Nota privada: só o autor vê e mexe (nem o ADMIN). Nota de equipe: autor ou ADMIN editam; todos que editam tarefas podem apoiar ideias e virar em tarefa.
- Tudo atrás de `verifyUserAtivo` (402 com assinatura vencida) e escopado por `contaId`; todo id recebido (quadro, coluna, etiqueta, responsável, vizinhos, menções) é conferido contra a conta.

## Telas

- **Operação** no menu lateral (seção própria), com abas: **Meu dia** (`/operacao`), **Quadros** (`/operacao/quadros/[id]`), **Lista** (`/operacao/lista`), **Calendário** (`/operacao/calendario`), **Ideias e notas** (`/operacao/ideias`).
- `?tarefa=<id>` abre o detalhe em qualquer aba (links das notificações e e-mails).
- **Captura rápida** com linguagem natural: `@nome`, `#etiqueta`, `!urgente|!alta|!baixa`, `hoje`, `amanhã`, dia da semana, `dd/mm`.
- **Nova tarefa** global (evento `abrirNovaTarefa`), na paleta de comandos e no botão flutuante do celular.
- Celular: quadro com rolagem horizontal e arrastar por toque (segurar), detalhe em tela cheia, calendário vira agenda.
- Atualização: recarrega ao voltar para a aba e a cada 20 s com a aba visível; mover é otimista e desfaz se o servidor recusar.

## Celular (fluxo limpo e completo)

O celular é tratado como tela principal, não como adaptação:

- "Tarefas" entra no menu inferior; `/operacao` abre em **Meu dia** (lista, não quadro), com a captura rápida no topo e o botão flutuante de nova tarefa.
- Quadro: colunas com rolagem horizontal por encaixe (uma coluna por vez), abas de coluna com contagem no topo para pular entre elas, arrastar com toque longo **e** menu "Mover para…" em cada cartão (alternativa confiável ao arrastar).
- Detalhe da tarefa em tela cheia, com cabeçalho fixo (voltar) e rodapé fixo com **Concluir**; campos em lista de toque, nada que dependa de passar o mouse.
- Calendário vira agenda por dia; Ideias em uma coluna; filtros num painel que sobe de baixo.
- Áreas de toque ≥ 44 px, sem rolagem horizontal da página, teclado não cobre o campo de comentário.

## Avisos

- Notificação no app: atribuída a você, mencionado em comentário, comentário em tarefa sua, tarefa que você criou foi concluída por outra pessoa.
- E-mail (se `User.emailTarefas`, desligável em Perfil): atribuída a você, menção, resumo diário (atrasadas + vencendo hoje) às 8h de São Paulo pelo cron `tarefas-diario`, um por pessoa por dia.

## Integrações

Criar tarefa a partir de: item da Central de controle, linha da Reposição, grupo da Saúde dos anúncios, ficha do produto, pedido de compra. Cartão "Minhas tarefas" na Visão geral. Tarefas na busca global (título e `#número`). Ferramenta `tarefas_da_equipe` (somente leitura) no Skubo IA. Rotinas sugeridas de e-commerce (recorrentes) com um clique.

## Fases

| Fase | Entrega |
|---|---|
| 0 — Fundação | Schema e migração `20261108100100_ciclo17_fase0_operacao`, permissões, domínio puro (posições, prazos e situação, recorrência, captura rápida, esquemas), acesso (membros da conta, quadro e etiquetas padrão), testes |
| 1 — API | Quadros, colunas, etiquetas, tarefas (CRUD, mover, concluir/reabrir/arquivar/restaurar/duplicar, excluir), checklist, comentários com menções, histórico, consultas com filtros e paginação, resumo; testes |
| 2 — Quadro | Kanban com arrastar (dnd-kit, mouse/toque/teclado), cartão, detalhe da tarefa, nova tarefa global, gestão de colunas/quadros/etiquetas, navegação (menu, paleta, celular) |
| 3 — Meu dia, lista e calendário | Meu dia com captura rápida e painel da equipe, lista com filtros (abertas, atrasadas, concluídas, arquivadas), calendário com arrastar para mudar o prazo |
| 4 — Ideias e notas | Mural com cores, fixar, privadas, apoiar, arrastar, virar tarefa |
| 5 — Rotina e avisos | Recorrência na conclusão, rotinas sugeridas, notificações, e-mails, preferência no Perfil, resumo diário (cron) |
| 6 — Integrações | Criar tarefa a partir das telas do Skubo, cartão na Visão geral, busca global, ferramenta da IA |
| R — Funil de indicação completo | Auditoria ponta a ponta do funil do Ciclo 16 (link `/r/`, cadastro por e-mail e Google, bônus do indicado, ML conectado, pagamento, carência, recompensa, dias aplicados, avisos, `/indique`, admin) e correção de tudo o que faltar, com testes |
| 7 — Fechamento | E2E `e2e/09-operacao.spec.ts` (desktop e celular) e do funil de indicação, documentação (CLAUDE.md, manual, guia, auditoria), bateria final |

## Regras do ciclo

Sem comentários no código; dados por `contaId`; validação com zod em toda entrada; ids sempre conferidos contra a conta; rate limit na criação e nos comentários; pt-BR; responsivo (1440/1366/390, claro e escuro); `tsc`, lint e testes verdes ao fim de cada fase; auditoria viva em `docs/AUDITORIA-CICLO-17.md`.
