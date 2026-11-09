const FUSO = "America/Sao_Paulo";

interface DataCalendario {
  ano: number;
  mes: number;
  dia: number;
}

export interface Competencia {
  ano: number;
  mes: number;
}

function partesNoFuso(data: Date) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSO,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const partes = dtf.formatToParts(data);
  const valor = (tipo: string) =>
    Number(partes.find((p) => p.type === tipo)?.value);
  return {
    ano: valor("year"),
    mes: valor("month"),
    dia: valor("day"),
    hora: valor("hour"),
    minuto: valor("minute"),
    segundo: valor("second"),
  };
}

function dataCalendarioNoFuso(data: Date): DataCalendario {
  const p = partesNoFuso(data);
  return { ano: p.ano, mes: p.mes, dia: p.dia };
}

function offsetMinutos(data: Date): number {
  const p = partesNoFuso(data);
  const comoUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  return (comoUtc - data.getTime()) / 60000;
}

function instanteNoFuso(
  cal: DataCalendario,
  hora: number,
  minuto: number,
  segundo: number,
  milissegundo: number
): Date {
  const chute = new Date(
    Date.UTC(cal.ano, cal.mes - 1, cal.dia, hora, minuto, segundo, milissegundo)
  );
  const offset = offsetMinutos(chute);
  return new Date(chute.getTime() - offset * 60000);
}

function somarDiasCalendario(cal: DataCalendario, dias: number): DataCalendario {
  const d = new Date(Date.UTC(cal.ano, cal.mes - 1, cal.dia));
  d.setUTCDate(d.getUTCDate() + dias);
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
}

export function inicioDoDia(data: Date): Date {
  return instanteNoFuso(dataCalendarioNoFuso(data), 0, 0, 0, 0);
}

export function fimDoDia(data: Date): Date {
  const amanha = somarDiasCalendario(dataCalendarioNoFuso(data), 1);
  return new Date(instanteNoFuso(amanha, 0, 0, 0, 0).getTime() - 1);
}

export function inicioDaSemana(data: Date): Date {
  const cal = dataCalendarioNoFuso(data);
  const comoUtc = new Date(Date.UTC(cal.ano, cal.mes - 1, cal.dia));
  const diaDaSemana = comoUtc.getUTCDay();
  const deslocamentoParaSegunda = diaDaSemana === 0 ? -6 : 1 - diaDaSemana;
  const segunda = somarDiasCalendario(cal, deslocamentoParaSegunda);
  return instanteNoFuso(segunda, 0, 0, 0, 0);
}

export function fimDaSemana(data: Date): Date {
  const inicio = inicioDaSemana(data);
  const domingo = somarDiasCalendario(dataCalendarioNoFuso(inicio), 7);
  return new Date(instanteNoFuso(domingo, 0, 0, 0, 0).getTime() - 1);
}

export function inicioDoMes(data: Date): Date {
  const cal = dataCalendarioNoFuso(data);
  return instanteNoFuso({ ...cal, dia: 1 }, 0, 0, 0, 0);
}

export function fimDoMes(data: Date): Date {
  const cal = dataCalendarioNoFuso(data);
  const primeiroDoProximoMes: DataCalendario =
    cal.mes === 12
      ? { ano: cal.ano + 1, mes: 1, dia: 1 }
      : { ano: cal.ano, mes: cal.mes + 1, dia: 1 };
  return new Date(instanteNoFuso(primeiroDoProximoMes, 0, 0, 0, 0).getTime() - 1);
}

export function competenciaDe(data: Date): Competencia {
  const cal = dataCalendarioNoFuso(data);
  return { ano: cal.ano, mes: cal.mes };
}

export function somarMeses(data: Date, quantidadeDeMeses: number): Date {
  const ano = data.getUTCFullYear();
  const mes = data.getUTCMonth();
  const dia = data.getUTCDate();

  const ultimoDiaDoMesDestino = new Date(Date.UTC(ano, mes + quantidadeDeMeses + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ano, mes + quantidadeDeMeses, Math.min(dia, ultimoDiaDoMesDestino)));
}

export type ChavePeriodoRapido = "mes-atual" | "mes-anterior" | "7" | "30" | "90";

export const OPCOES_PERIODO_RAPIDO: Array<{ value: ChavePeriodoRapido; label: string }> = [
  { value: "mes-atual", label: "Mês atual" },
  { value: "mes-anterior", label: "Mês anterior" },
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
];

export interface PeriodoComparado {
  chave: string;
  desde: Date;
  ate: Date;
  anteriorDesde: Date;
  anteriorAte: Date;
  dias: number;
  rotulo: string;
  rotuloComparacao: string;
}

const DIA_MS = 24 * 60 * 60 * 1000;

function inicioDoMesAnterior(data: Date): Date {
  return inicioDoMes(new Date(inicioDoMes(data).getTime() - 1));
}

export function resolverPeriodoRapido(chaveBruta: string | null | undefined, agora: Date = new Date()): PeriodoComparado {
  const chave = chaveBruta ?? "mes-atual";

  if (chave === "mes-atual") {
    const desde = inicioDoMes(agora);
    const anteriorDesde = inicioDoMesAnterior(agora);
    const decorrido = agora.getTime() - desde.getTime();
    const anteriorAte = new Date(Math.min(anteriorDesde.getTime() + decorrido, desde.getTime() - 1));
    return {
      chave,
      desde,
      ate: agora,
      anteriorDesde,
      anteriorAte,
      dias: Math.max(1, Math.ceil(decorrido / DIA_MS)),
      rotulo: "Mês atual",
      rotuloComparacao: "vs mesmo período do mês anterior",
    };
  }

  if (chave === "mes-anterior") {
    const desde = inicioDoMesAnterior(agora);
    const ate = new Date(inicioDoMes(agora).getTime() - 1);
    const anteriorDesde = inicioDoMesAnterior(desde);
    return {
      chave,
      desde,
      ate,
      anteriorDesde,
      anteriorAte: new Date(desde.getTime() - 1),
      dias: Math.round((ate.getTime() + 1 - desde.getTime()) / DIA_MS),
      rotulo: "Mês anterior",
      rotuloComparacao: "vs mês retrasado",
    };
  }

  const numero = Number(chave);
  const dias = Number.isFinite(numero) && numero > 0 ? Math.min(90, Math.max(7, Math.round(numero))) : 30;
  const desde = new Date(agora.getTime() - dias * DIA_MS);
  return {
    chave: String(dias),
    desde,
    ate: agora,
    anteriorDesde: new Date(desde.getTime() - dias * DIA_MS),
    anteriorAte: new Date(desde.getTime() - 1),
    dias,
    rotulo: `Últimos ${dias} dias`,
    rotuloComparacao: `vs ${dias} dias anteriores`,
  };
}

export function formatarDataHoraBrasilia(data: Date): string {
  const p = partesNoFuso(data);
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${p.ano}-${dois(p.mes)}-${dois(p.dia)} ${dois(p.hora)}:${dois(p.minuto)}:${dois(p.segundo)}`;
}

export type DiaCalendario = DataCalendario;

export function diaEmBrasilia(data: Date): DiaCalendario {
  return dataCalendarioNoFuso(data);
}

export function horaEmBrasilia(data: Date): { hora: number; minuto: number } {
  const p = partesNoFuso(data);
  return { hora: p.hora, minuto: p.minuto };
}

export function instanteEmBrasilia(dia: DiaCalendario, hora = 0, minuto = 0): Date {
  return instanteNoFuso(dia, hora, minuto, 0, 0);
}

export function somarDiasAoDia(dia: DiaCalendario, dias: number): DiaCalendario {
  return somarDiasCalendario(dia, dias);
}
