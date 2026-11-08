import { z } from "zod";
import { fimDoDia, inicioDoDia, resolverPeriodoRapido } from "@/modules/financeiro/dominio/periodo";
import { ErroFerramenta, dataSp } from "./tipos";

const DIA_MS = 24 * 60 * 60 * 1000;
const MAXIMO_DIAS = 400;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

export const PERIODOS_RAPIDOS = ["hoje", "ontem", "7d", "30d", "90d", "mes_atual", "mes_anterior"] as const;

export const periodoSchema = z.object({
  periodo: z
    .enum(PERIODOS_RAPIDOS)
    .optional()
    .describe("Período pronto. Use quando o usuário falar em hoje, ontem, semana, 30 ou 90 dias, este mês ou mês passado. Padrão: mes_atual."),
  desde: z.string().regex(DATA).optional().describe("Início do período personalizado, AAAA-MM-DD (fuso de São Paulo)."),
  ate: z.string().regex(DATA).optional().describe("Fim do período personalizado, AAAA-MM-DD (inclusive)."),
});

export type EntradaPeriodo = z.infer<typeof periodoSchema>;

export interface PeriodoResolvido {
  desde: Date;
  ate: Date;
  anteriorDesde: Date;
  anteriorAte: Date;
  rotulo: string;
}

function diaSp(data: string, fim: boolean): Date {
  const meioDia = new Date(`${data}T12:00:00-03:00`);
  if (Number.isNaN(meioDia.getTime())) throw new ErroFerramenta(`Data inválida: ${data}`);
  return fim ? fimDoDia(meioDia) : inicioDoDia(meioDia);
}

export function resolverPeriodo(entrada: EntradaPeriodo | undefined, agora: Date): PeriodoResolvido {
  if (entrada?.desde || entrada?.ate) {
    const desde = diaSp(entrada.desde ?? entrada.ate!, false);
    const ate = new Date(Math.min(diaSp(entrada.ate ?? dataSp(agora)!, true).getTime(), agora.getTime()));
    if (ate.getTime() < desde.getTime()) throw new ErroFerramenta("A data final é anterior à inicial.");
    if (ate.getTime() - desde.getTime() > MAXIMO_DIAS * DIA_MS) {
      throw new ErroFerramenta(`Período máximo de ${MAXIMO_DIAS} dias.`);
    }
    const duracao = ate.getTime() - desde.getTime();
    return {
      desde,
      ate,
      anteriorDesde: new Date(desde.getTime() - duracao - 1),
      anteriorAte: new Date(desde.getTime() - 1),
      rotulo: `${dataSp(desde)} a ${dataSp(ate)}`,
    };
  }

  const chave = entrada?.periodo ?? "mes_atual";
  if (chave === "hoje") {
    const ontem = new Date(agora.getTime() - DIA_MS);
    return { desde: inicioDoDia(agora), ate: agora, anteriorDesde: inicioDoDia(ontem), anteriorAte: ontem, rotulo: "Hoje" };
  }
  if (chave === "ontem") {
    const ontem = new Date(agora.getTime() - DIA_MS);
    const anteontem = new Date(agora.getTime() - 2 * DIA_MS);
    return {
      desde: inicioDoDia(ontem),
      ate: fimDoDia(ontem),
      anteriorDesde: inicioDoDia(anteontem),
      anteriorAte: fimDoDia(anteontem),
      rotulo: "Ontem",
    };
  }
  const rapida = { "7d": "7", "30d": "30", "90d": "90", mes_atual: "mes-atual", mes_anterior: "mes-anterior" }[chave];
  const p = resolverPeriodoRapido(rapida, agora);
  return { desde: p.desde, ate: p.ate, anteriorDesde: p.anteriorDesde, anteriorAte: p.anteriorAte, rotulo: p.rotulo };
}

export function descreverPeriodo(p: { desde: Date; ate: Date; rotulo?: string }) {
  return { ...(p.rotulo ? { rotulo: p.rotulo } : {}), desde: dataSp(p.desde), ate: dataSp(p.ate) };
}
