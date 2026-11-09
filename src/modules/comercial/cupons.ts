import { Prisma, type AlvoCupom, type Cupom } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const VALOR_MINIMO_COBRANCA_CENTAVOS = 100;

export class CupomInvalidoError extends Error {
  readonly code = "CUPOM_INVALIDO";

  constructor(message: string) {
    super(message);
    this.name = "CupomInvalidoError";
  }
}

export function normalizarCodigoCupom(codigo: string): string {
  return codigo.trim().toUpperCase().replace(/\s+/g, "");
}

export function descontoDoCupom(cupom: Pick<Cupom, "tipo" | "valor">, precoCentavos: number): number {
  const bruto = cupom.tipo === "PERCENTUAL" ? Math.round((precoCentavos * cupom.valor) / 100) : cupom.valor;
  const maximo = Math.max(0, precoCentavos - VALOR_MINIMO_COBRANCA_CENTAVOS);
  return Math.max(0, Math.min(bruto, maximo));
}

export interface CupomAplicavel {
  cupom: Cupom;
  descontoCentavos: number;
  precoFinalCentavos: number;
}

export async function validarCupom(
  codigoInformado: string,
  alvo: AlvoCupom,
  contaId: string,
  precoCentavos: number,
  opcoes: { referencia?: string | null; agora?: Date } = {}
): Promise<CupomAplicavel> {
  const agora = opcoes.agora ?? new Date();
  const codigo = normalizarCodigoCupom(codigoInformado);
  const cupom = await prisma.cupom.findUnique({ where: { codigo } });

  if (!cupom || !cupom.ativo) throw new CupomInvalidoError("Cupom não encontrado.");
  if (cupom.alvo !== alvo) throw new CupomInvalidoError("Este cupom não vale para esta compra.");
  if (cupom.validoAte && cupom.validoAte.getTime() < agora.getTime()) throw new CupomInvalidoError("Este cupom expirou.");
  if (cupom.usosMaximos !== null && cupom.usos >= cupom.usosMaximos) throw new CupomInvalidoError("Este cupom já se esgotou.");

  const usoAnterior = await prisma.usoCupom.findUnique({ where: { cupomId_contaId: { cupomId: cupom.id, contaId } } });
  if (usoAnterior && usoAnterior.referencia !== (opcoes.referencia ?? null)) {
    throw new CupomInvalidoError("Sua loja já usou este cupom.");
  }

  const descontoCentavos = descontoDoCupom(cupom, precoCentavos);
  return { cupom, descontoCentavos, precoFinalCentavos: precoCentavos - descontoCentavos };
}

export async function registrarUsoCupom(cupomId: string, contaId: string, referencia: string | null): Promise<boolean> {
  try {
    await prisma.$transaction([
      prisma.usoCupom.create({ data: { cupomId, contaId, referencia } }),
      prisma.cupom.update({ where: { id: cupomId }, data: { usos: { increment: 1 } } }),
    ]);
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return false;
    throw error;
  }
}
