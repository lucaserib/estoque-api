export type StatusConta = "TESTE" | "ATIVA" | "INADIMPLENTE" | "VENCIDA" | "CANCELADA" | "BLOQUEADA";

export interface SituacaoConta {
  contaId: string;
  status: StatusConta;
  podeUsar: boolean;
  cobrancaObrigatoria: boolean;
  plano: "MONTHLY" | "ANNUAL" | null;
  testeTerminaEm: Date | null;
  diasRestantesTeste: number | null;
  periodoTerminaEm: Date | null;
  inativaDesde: Date | null;
  diasDeCredito: number;
  donoNome: string | null;
  donoEmail: string | null;
}
