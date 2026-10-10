# Auditoria — Ciclo 7 (Módulo Financeiro)

Documento de referência do ciclo. Atualizado ao final de cada fase.

## Fase 0 — Linha de base e verificação dos dados do Mercado Livre

### Checks (10/10/2026)

- `npx tsc --noEmit`: limpo.
- `npx next lint`: limpo.
- `npm test`: 19 arquivos, 127 testes, todos passando (linha de base antes desta fase).

### Restrição do ambiente

Idêntica à registrada em todo o Ciclo 6: este ambiente não tem `DATABASE_URL` (nenhuma migração pode ser testada contra um banco real) e não alcança `api.mercadolibre.com` (bloqueado por `PolicyAgent` do próprio ML). Toda verificação contra dados reais do Mercado Livre fica pendente para produção — é exatamente o que a rota de diagnóstico desta fase existe para viabilizar.

### O que foi feito

1. **Leitura do código a reaproveitar**: `src/lib/mlOrders.ts` (`fetchAllOrders`/`fetchOrdersWithFallback`, paginação e filtro de data já prontos), `src/services/mercadoLivreService.ts` (`getValidToken`/`refreshWithLock` com trava distribuída, `getOrder`, `processOrderWebhook` — ponto exato onde a Fase 3 vai pendurar a ingestão financeira), `src/lib/mlFetch.ts` (backoff com `Retry-After`), `src/lib/margem.ts` e `src/lib/custo.ts` (`resolverCustoProduto`, `calcularCustoKit` — fonte do CMV), `src/lib/pendencias.ts`, `src/services/reposicaoService.ts`, `src/app/api/dashboard/resumo/route.ts`, `ConfiguracaoGeral.aliquotaImposto` (Ciclo 6 Fase 5/9), `src/lib/permissoes.ts` (matriz de papéis), crons existentes (`bling-refresh`, `bling-sync`, `cadastro-incompleto`, `ml-webhook-retry` — todos no padrão `CRON_SECRET` que o cron financeiro da Fase 8 vai seguir).
2. **`GET /api/financeiro/diagnostico/mercado-livre?pedido=<id>`** (`src/app/api/financeiro/diagnostico/mercado-livre/route.ts`): só `ADMIN` (mesmo padrão de `usuarios/route.ts`, checagem direta de `role`, não a matriz de `permissoes.ts` — é um diagnóstico técnico, não uma permissão de produto). Busca `GET /orders/{id}`, `GET /orders/{id}/discounts` e, quando o pedido tem `shipping.id`, `GET /shipments/{id}/costs`; extrai `payments` do próprio objeto do pedido (a API do ML já embute isso, segundo a documentação — **não confirmado contra um pedido real**). `removerCamposSensiveis` tira recursivamente `buyer`, e-mail, nome, telefone, endereço, cartão e documento de qualquer nível da resposta antes de devolver — nenhum token sai do backend em nenhum momento (usado só para montar o header `Authorization`). 4 testes (`__tests__/route.test.ts`): 403 para quem não é ADMIN, 400 sem `pedido`, sanitização de dado pessoal confirmada campo a campo, e o caso de pedido sem `shipping.id` (sinaliza erro em `custosEnvio` sem quebrar a resposta).
3. **`docs/financeiro/fontes-mercado-livre.md`**: tabela de cada campo usado, endpoint, caminho na resposta e nível de confiança — a maioria marcada "Pendente de confirmação real" de propósito, porque é exatamente isso que ainda não foi verificado. Lista as 5 perguntas abertas mais importantes para quem rodar o diagnóstico em produção, na ordem de risco para a fórmula da DRE (a mais crítica: `sale_fee` é por unidade ou por linha).
4. **Escopo decidido para "escreva os mapeadores" do item 3 do documento**: os mapeadores de verdade (`canais/mercadoLivre/`, tipos `*Normalizada`) ficam para a Fase 3, que já está explicitamente no roteiro para isso, com testes de fixture também explícitos no item 4 daquela fase. Fazer isso duas vezes (uma versão preliminar agora, outra "de verdade" na Fase 3) seria retrabalho sem necessidade — a Fase 0 entrega o diagnóstico (para gerar os fixtures reais) e a documentação das perguntas abertas; a Fase 3 entrega o mapeador que responde essas perguntas com testes.

### O que ficou pendente desta fase

- Nenhuma das 5 perguntas abertas em `fontes-mercado-livre.md` foi respondida com dado real — todas dependem de rodar o diagnóstico em produção contra pedidos reais (um comum, um Full, um com desconto) antes da Fase 3 travar os mapeadores.
- `payments` sendo extraído direto de `order.payments` (sem chamada separada a `/payments/{id}`) é uma suposição baseada em documentação, não confirmada.

### Checks ao final da fase

- `npx tsc --noEmit`: limpo.
- `npx next lint`: limpo.
- `npm test`: 20 arquivos, 131 testes, todos passando (4 novos desta fase).
