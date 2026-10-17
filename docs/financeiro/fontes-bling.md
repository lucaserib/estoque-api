# Fontes de dados financeiros — Bling

Registro de confiança dos endpoints do Bling (API v3) usados pela integração financeira (Ciclo 8 Fase 4), no mesmo espírito de `fontes-mercado-livre.md`: nenhum destes foi confirmado contra uma resposta real nesta sessão.

| Campo | Endpoint | Confiança | Status |
|---|---|---|---|
| Contas a pagar | `GET /contas/pagar?pagina=&limite=&dataInicialVencimento=` | Caminho e paginação (`pagina`/`limite`) seguem a mesma convenção já confirmada em `/produtos`; os nomes de campo de cada conta (`vencimento`, `valor`, `situacao`, `contato.id`, `categoria.id`, `dataPagamento`) são um palpite | Pendente de confirmação real |
| Contas a receber | `GET /contas/receber?pagina=&limite=&dataInicialVencimento=` | Mesma confiança de contas a pagar | Pendente de confirmação real |
| Categorias de receitas/despesas | `GET /categorias/receitas-despesas` | Não confirmado | Pendente de confirmação real |
| Pedidos de venda (outros canais) | `GET /pedidos/vendas` | **Não implementado.** Exigiria um adaptador `AdaptadorCanalFinanceiro` novo com `canal: CanalVenda.ERP` (o valor já existe no enum) e uma forma de distinguir pedidos que só espelham vendas do Mercado Livre (já ingeridas direto) dos pedidos de outros canais — ver `VendaCanalNormalizada.origemReal`, já desenhado para isso. Fica como pendência explícita da Fase 4; não arrisquei implementar sem nenhum dado real do formato de pedido do Bling. | Pendente |

## Como o status "PAGO × PREVISTO" é decidido

O campo `situacao` do Bling (código numérico) não foi confirmado, então `sincronizarContasFinanceirasBling` não o usa para decidir o status do lançamento — usa a presença de `dataPagamento` (`PAGO` se vier preenchida, `PREVISTO` senão), que é um sinal mais robusto a variações de código.

## Mapeamento de categoria

`MapeamentoCategoriaBling` (`userId`, `blingCategoriaId` → `categoriaFinanceiraId`) resolve a categoria de cada conta. Sem mapeamento, cai em "Outras" (já seedada por `seedPlanoContasPadrao`) — nunca descarta o valor. A tela para o usuário criar esses mapeamentos é da Fase 5; por ora só a API/ingestão lê a tabela.

## Liga/desliga

`ConfiguracaoGeral.blingContasAtivo` (default `false`) — a ingestão (`sincronizarContasFinanceirasBling`, chamada pelo cron `bling-sync`) não roda nada enquanto estiver desligada. Fica desligada por padrão porque o escopo de API do Bling para "Contas a pagar/receber" pode não estar habilitado na conexão existente — ver o passo manual de reconexão no fim de `docs/AUDITORIA-CICLO-8.md`.
