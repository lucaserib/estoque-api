export type CodigoIaIndisponivel =
  | "NAO_CONFIGURADA"
  | "DESLIGADA"
  | "NAO_CONTRATADA"
  | "SEM_CREDITOS"
  | "LIMITE"
  | "FALHA_PROVEDOR";

export class IaIndisponivelError extends Error {
  constructor(
    message: string,
    readonly codigo: CodigoIaIndisponivel,
    readonly detalhe: string | null = null,
    readonly tecnico: string | null = null
  ) {
    super(message);
    this.name = "IaIndisponivelError";
  }
}

export class IaCanceladaError extends Error {
  constructor() {
    super("Resposta interrompida");
    this.name = "IaCanceladaError";
  }
}

export const MENSAGEM_FALHA_PROVEDOR = "A IA está instável agora, tente em alguns minutos.";

export function statusHttpDoErroIa(codigo: CodigoIaIndisponivel): number {
  if (codigo === "NAO_CONTRATADA" || codigo === "SEM_CREDITOS") return 402;
  if (codigo === "LIMITE") return 429;
  return 503;
}
