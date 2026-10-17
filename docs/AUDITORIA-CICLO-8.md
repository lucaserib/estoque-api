# Auditoria — Ciclo 8: Financeiro busca dados reais

Registro vivo de execução do `PROMPT-CICLO-8-FINANCEIRO-INTEGRACAO.md`, uma seção por fase.

## Fase 0 — Testes que reproduzem o problema real

**Construído:**
- Fixtures reais em `src/modules/financeiro/canais/mercadoLivre/__tests__/fixtures/`: `pedido-comum.json` (1 unidade), `pedido-2-unidades.json`, `pedido-cancelado.json` — ids numéricos como a API devolve de fato.
- `canais/mercadoLivre/esquemas.ts`: esquemas Zod (`pedidoSchema`, `descontosSchema`, `custoEnvioSchema`, `envioSchema`, `pagamentoSchema`) que convertem todo id (`z.union([z.string(), z.number()]).transform(String)`). Ainda não plugados no mapeador — isso é Fase 1.
- `MLOrder.id` em `src/types/mercadolivre.ts` ampliado para `string | number` (refletindo o payload real).
- Testes novos que capturam os bugs do diagnóstico (F1, F5, F6, F7), todos citados no relatório de produção de 17/10/2026:
  - `mapeador.test.ts`: id numérico → `pedidoExternoId`/`envioExternoId` devem virar string (F1); `somarDescontoVendedor` com o formato real `{details:[{items:[{amounts}]}]}` (F5); pedido cancelado com pagamento estornado deve mapear para `CANCELADA` (F6).
  - `formulas.test.ts`: desconto do vendedor não deve ser subtraído de novo da margem/imposto, já que `unit_price` já vem líquido (F5).
  - `sincronizador.test.ts` e `dre.test.ts`: `faturamentoBruto` deve **incluir** a venda depois cancelada, com `cancelamentos` guardando o valor dela à parte — hoje é excluído na origem e subtraído de novo na DRE (F7).

**Resultado ao final da fase:** `tsc`/`lint` limpos; `npm test` com **7 testes vermelhos de propósito** (F5 ×4, F6 ×1, F7 ×2) — são a especificação executável do que a Fase 1 precisa corrigir. F1 já foi corrigido nesta fase (`String(pedido.id)` em `mapeador.ts` e `cliente.ts`) porque ampliar o tipo `MLOrder.id` sem isso quebrava a compilação; o restante do diagnóstico (F2, F5, F6, F7, F8, F9, F12) continua pendente para a Fase 1.

**Pendências explícitas para a Fase 1:** corrigir `somarDescontoVendedor`/`mapearPedido` para o formato real de desconto; `mapearStatus` considerar histórico de pagamentos; `calcularMargemContribuicao` deixar de subtrair `descontoVendedor`; `atualizarResumoDoDia` e `somarVendaCanalDoMes` passarem a incluir vendas canceladas em `faturamentoBruto`; a bateria `obterEnvio`/logística real; liberação via Mercado Pago; `cancelamentoNaCompetencia`/`usarImpostoEstimado`; webhook robusto a erro parcial.
