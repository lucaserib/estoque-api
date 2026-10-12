/**
 * Contrato para integração do financeiro com um ERP externo (hoje, só
 * Bling) — direção INVERSA de `AdaptadorCanalFinanceiro` (que traz dados
 * de canal de venda PARA DENTRO do financeiro). Aqui o financeiro EXPORTA
 * contas a pagar e categorias do plano de contas PARA o ERP, para quem usa
 * o Bling como sistema contábil principal e quer ver os lançamentos
 * gerados aqui (recorrência, parcelamento, pedido de compra confirmado)
 * refletidos lá.
 *
 * Ciclo 7 Fase 9: interface documentada, **sem nenhuma implementação**.
 * Não existe `adaptadorErpBling.ts`, nenhuma rota chama isto, e nenhum
 * botão na UI aparece. Entra num ciclo futuro, quando houver demanda real.
 *
 * Endpoints do Bling (API v3) que esta interface tem em mente, conforme o
 * prompt original do Ciclo 7 — nenhum confirmado contra a API real nesta
 * sessão (mesma ressalva de `docs/financeiro/fontes-mercado-livre.md` para
 * o Mercado Livre: documentação pública, não testado):
 * - `POST /contas/pagar` — uma conta a pagar por `exportarContaAPagar`.
 * - `POST /categorias/receitas-despesas` — uma categoria por `exportarCategoria`.
 *
 * A direção oposta ("importar pedidos de outros canais" através do ERP —
 * por exemplo, pedidos da Amazon que chegam consolidados no Bling, sem
 * este projeto precisar de um adaptador próprio para a Amazon) **não
 * precisa de interface nova nenhuma**: é só implementar
 * `AdaptadorCanalFinanceiro` (`../tipos.ts`) com `canal: CanalVenda.ERP`
 * (o enum já tem esse valor) e registrar em `../registro.ts`, exatamente
 * como qualquer outro canal — ver `docs/financeiro/como-adicionar-um-canal.md`.
 * O Bling-como-fonte-de-pedidos é um *canal de entrada*; só o
 * export de contas a pagar/categorias é uma via de saída nova, daí a
 * interface separada.
 */

export interface ContaAPagarParaExportar {
  /** Id do LancamentoFinanceiro de origem — usado para a chave de idempotência do lado do ERP. */
  idInterno: string;
  descricao: string;
  /** Centavos, igual a todo o resto do financeiro. */
  valor: number;
  vencimento: Date;
  /** Nome da categoria (o Bling casa por nome/código próprio, não pelo nosso CategoriaFinanceira.id). */
  categoriaNome: string;
  fornecedorNome: string | null;
}

export interface CategoriaParaExportar {
  /** Id da CategoriaFinanceira de origem. */
  idInterno: string;
  nome: string;
  tipo: "RECEITA" | "DESPESA";
}

export interface ResultadoExportacaoErp {
  /** Id do registro no ERP (ex.: id da conta a pagar no Bling). */
  idExterno: string;
  /**
   * true quando o ERP já tinha esse registro (reenvio idempotente não
   * criou duplicata) — mesmo espírito de `chaveExterna` usado em todo o
   * resto da ingestão financeira, só que aqui quem garante a idempotência
   * do lado de fora é o próprio ERP, não uma `@@unique` nossa.
   */
  jaExistia: boolean;
}

/**
 * Cada método deve ser seguro de chamar de novo para o mesmo registro
 * (reprocessamento, retry de erro de rede) sem criar duplicata no ERP —
 * mesma exigência de idempotência que todo o resto do financeiro já segue.
 */
export interface AdaptadorErpFinanceiro {
  erp: "BLING";
  exportarContaAPagar(contaId: string, dados: ContaAPagarParaExportar): Promise<ResultadoExportacaoErp>;
  exportarCategoria(contaId: string, dados: CategoriaParaExportar): Promise<ResultadoExportacaoErp>;
}
