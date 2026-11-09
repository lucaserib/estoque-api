import { z } from "zod";
import {
  type DiaCalendario,
  diaEmBrasilia,
  fimDoDia,
  horaEmBrasilia,
  instanteEmBrasilia,
  somarDiasAoDia,
} from "@/modules/financeiro/dominio/periodo";
import { lerDia } from "./prazo";

export const NOMES_DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

export const recorrenciaSchema = z
  .object({
    frequencia: z.enum(["DIARIA", "SEMANAL", "MENSAL"]),
    intervalo: z.number().int().min(1).max(30).default(1),
    diasSemana: z.array(z.number().int().min(0).max(6)).max(7).default([]),
    diaDoMes: z.number().int().min(1).max(31).nullable().default(null),
    ate: z
      .string()
      .nullable()
      .default(null)
      .refine((valor) => valor === null || lerDia(valor) !== null, "Data final inválida."),
  })
  .superRefine((valor, contexto) => {
    if (valor.frequencia === "SEMANAL" && valor.diasSemana.length === 0) {
      contexto.addIssue({ code: z.ZodIssueCode.custom, message: "Escolha pelo menos um dia da semana.", path: ["diasSemana"] });
    }
  })
  .transform((valor) => ({
    ...valor,
    diasSemana: [...new Set(valor.diasSemana)].sort((a, b) => a - b),
  }));

export type Recorrencia = z.output<typeof recorrenciaSchema>;

export function lerRecorrencia(valor: unknown): Recorrencia | null {
  if (valor === null || valor === undefined) return null;
  const lido = recorrenciaSchema.safeParse(valor);
  return lido.success ? lido.data : null;
}

function diaDaSemana(dia: DiaCalendario): number {
  return new Date(Date.UTC(dia.ano, dia.mes - 1, dia.dia)).getUTCDay();
}

function segundaDaSemana(dia: DiaCalendario): DiaCalendario {
  const semana = diaDaSemana(dia);
  return somarDiasAoDia(dia, semana === 0 ? -6 : 1 - semana);
}

function diasEntre(a: DiaCalendario, b: DiaCalendario): number {
  return Math.round((Date.UTC(b.ano, b.mes - 1, b.dia) - Date.UTC(a.ano, a.mes - 1, a.dia)) / 86_400_000);
}

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

function proximoDia(recorrencia: Recorrencia, atual: DiaCalendario, ancora: DiaCalendario): DiaCalendario {
  if (recorrencia.frequencia === "DIARIA") return somarDiasAoDia(atual, recorrencia.intervalo);

  if (recorrencia.frequencia === "SEMANAL") {
    const inicioAncora = segundaDaSemana(ancora);
    for (let passo = 1; passo <= 7 * recorrencia.intervalo + 7; passo += 1) {
      const candidato = somarDiasAoDia(atual, passo);
      const semanas = Math.floor(diasEntre(inicioAncora, segundaDaSemana(candidato)) / 7);
      if (semanas % recorrencia.intervalo === 0 && recorrencia.diasSemana.includes(diaDaSemana(candidato))) return candidato;
    }
    return somarDiasAoDia(atual, 7 * recorrencia.intervalo);
  }

  const alvo = recorrencia.diaDoMes ?? ancora.dia;
  const indiceMes = atual.ano * 12 + (atual.mes - 1) + recorrencia.intervalo;
  const ano = Math.floor(indiceMes / 12);
  const mes = (indiceMes % 12) + 1;
  return { ano, mes, dia: Math.min(alvo, ultimoDiaDoMes(ano, mes)) };
}

function instanteDoDia(dia: DiaCalendario, comHora: { hora: number; minuto: number } | null): Date {
  return comHora ? instanteEmBrasilia(dia, comHora.hora, comHora.minuto) : fimDoDia(instanteEmBrasilia(dia));
}

export function proximoPrazo(
  recorrencia: Recorrencia,
  prazoAtual: Date,
  prazoComHora: boolean,
  agora: Date = new Date()
): Date | null {
  const ancora = diaEmBrasilia(prazoAtual);
  const hora = prazoComHora ? horaEmBrasilia(prazoAtual) : null;
  const limite = recorrencia.ate ? lerDia(recorrencia.ate) : null;
  let dia = ancora;
  for (let tentativa = 0; tentativa < 1000; tentativa += 1) {
    dia = proximoDia(recorrencia, dia, ancora);
    if (limite && diasEntre(limite, dia) > 0) return null;
    const instante = instanteDoDia(dia, hora);
    if (instante.getTime() > agora.getTime()) return instante;
  }
  return null;
}

export function descreverRecorrencia(recorrencia: Recorrencia): string {
  const cada = (singular: string, plural: string) =>
    recorrencia.intervalo === 1 ? singular : `A cada ${recorrencia.intervalo} ${plural}`;
  let texto: string;
  if (recorrencia.frequencia === "DIARIA") texto = cada("Todo dia", "dias");
  else if (recorrencia.frequencia === "SEMANAL") {
    const dias = recorrencia.diasSemana.map((d) => NOMES_DIAS_SEMANA[d]).join(", ");
    texto = `${cada("Toda semana", "semanas")}: ${dias}`;
  } else {
    texto = `${cada("Todo mês", "meses")}${recorrencia.diaDoMes ? `, dia ${recorrencia.diaDoMes}` : ""}`;
  }
  if (recorrencia.ate) {
    const dia = lerDia(recorrencia.ate);
    if (dia) texto += ` até ${String(dia.dia).padStart(2, "0")}/${String(dia.mes).padStart(2, "0")}/${dia.ano}`;
  }
  return texto;
}
