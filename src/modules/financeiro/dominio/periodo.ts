/**
 * Todo limite de dia/semana/mês do financeiro é calculado no fuso de
 * América/São_Paulo, não no fuso do servidor. O Brasil não observa mais
 * horário de verão desde 2019, mas calculamos o offset de verdade via `Intl`
 * em vez de fixar "-03:00" — funciona também para datas antigas com DST.
 */
const FUSO = "America/Sao_Paulo";

interface DataCalendario {
  ano: number;
  mes: number; // 1-12
  dia: number;
}

export interface Competencia {
  ano: number;
  mes: number; // 1-12
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

/** Quantos minutos o relógio de FUSO está adiantado em relação ao UTC nesse instante (negativo = atrasado). */
function offsetMinutos(data: Date): number {
  const p = partesNoFuso(data);
  const comoUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  return (comoUtc - data.getTime()) / 60000;
}

/** Instante UTC correspondente a um horário de parede em FUSO. */
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

/** Semana começando na segunda-feira (padrão de relatório financeiro/ISO, não o domingo do calendário comum). */
export function inicioDaSemana(data: Date): Date {
  const cal = dataCalendarioNoFuso(data);
  const comoUtc = new Date(Date.UTC(cal.ano, cal.mes - 1, cal.dia));
  const diaDaSemana = comoUtc.getUTCDay(); // 0=domingo..6=sábado
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

/** Mês/ano de competência (regime de caixa não se aplica — é sempre o calendário de SP). */
export function competenciaDe(data: Date): Competencia {
  const cal = dataCalendarioNoFuso(data);
  return { ano: cal.ano, mes: cal.mes };
}

/**
 * Soma meses a uma data de calendário (vencimento, dia de fatura…), não a um
 * instante — por isso usa UTC puro, não o fuso de SP: "todo dia 10" não
 * depende de fuso, é só aritmética de calendário. Preserva o dia do mês,
 * com piso no último dia se o mês de destino for mais curto (ex.: dia 31 de
 * janeiro + 1 mês = 28/29 de fevereiro, não março).
 */
export function somarMeses(data: Date, quantidadeDeMeses: number): Date {
  const ano = data.getUTCFullYear();
  const mes = data.getUTCMonth();
  const dia = data.getUTCDate();

  const ultimoDiaDoMesDestino = new Date(Date.UTC(ano, mes + quantidadeDeMeses + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ano, mes + quantidadeDeMeses, Math.min(dia, ultimoDiaDoMesDestino)));
}
