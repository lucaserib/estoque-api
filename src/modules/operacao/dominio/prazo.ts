import {
  type DiaCalendario,
  diaEmBrasilia,
  fimDaSemana,
  fimDoDia,
  horaEmBrasilia,
  inicioDoDia,
  instanteEmBrasilia,
} from "@/modules/financeiro/dominio/periodo";

export type SituacaoPrazo = "concluida" | "arquivada" | "atrasada" | "hoje" | "semana" | "futura" | "sem-prazo";

export interface EstadoTarefaPrazo {
  prazo: Date | string | null;
  concluidaEm: Date | string | null;
  arquivadaEm: Date | string | null;
}

function comoData(valor: Date | string | null): Date | null {
  if (valor === null) return null;
  return valor instanceof Date ? valor : new Date(valor);
}

export function situacaoDoPrazo(tarefa: EstadoTarefaPrazo, agora: Date = new Date()): SituacaoPrazo {
  if (tarefa.arquivadaEm) return "arquivada";
  if (tarefa.concluidaEm) return "concluida";
  const prazo = comoData(tarefa.prazo);
  if (!prazo) return "sem-prazo";
  if (prazo.getTime() < agora.getTime()) return "atrasada";
  if (prazo.getTime() <= fimDoDia(agora).getTime()) return "hoje";
  if (prazo.getTime() <= fimDaSemana(agora).getTime()) return "semana";
  return "futura";
}

const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function lerDia(texto: string): DiaCalendario | null {
  const partes = DATA_ISO.exec(texto);
  if (!partes) return null;
  const dia = { ano: Number(partes[1]), mes: Number(partes[2]), dia: Number(partes[3]) };
  const teste = new Date(Date.UTC(dia.ano, dia.mes - 1, dia.dia));
  if (teste.getUTCFullYear() !== dia.ano || teste.getUTCMonth() !== dia.mes - 1 || teste.getUTCDate() !== dia.dia) return null;
  return dia;
}

export function diaParaTexto(dia: DiaCalendario): string {
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${dia.ano}-${dois(dia.mes)}-${dois(dia.dia)}`;
}

export function montarPrazo(data: string, hora?: string | null): { prazo: Date; prazoComHora: boolean } | null {
  const dia = lerDia(data);
  if (!dia) return null;
  if (hora) {
    const partes = HORA.exec(hora);
    if (!partes) return null;
    return { prazo: instanteEmBrasilia(dia, Number(partes[1]), Number(partes[2])), prazoComHora: true };
  }
  return { prazo: fimDoDia(instanteEmBrasilia(dia)), prazoComHora: false };
}

export function partesDoPrazo(prazo: Date, prazoComHora: boolean): { data: string; hora: string | null } {
  const dia = diaEmBrasilia(prazo);
  if (!prazoComHora) return { data: diaParaTexto(dia), hora: null };
  const { hora, minuto } = horaEmBrasilia(prazo);
  return { data: diaParaTexto(dia), hora: `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}` };
}

export function hojeEmTexto(agora: Date = new Date()): string {
  return diaParaTexto(diaEmBrasilia(agora));
}

export function intervaloDoDia(data: string): { inicio: Date; fim: Date } | null {
  const dia = lerDia(data);
  if (!dia) return null;
  const inicio = inicioDoDia(instanteEmBrasilia(dia));
  return { inicio, fim: fimDoDia(inicio) };
}
