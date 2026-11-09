import type { SituacaoPrazo } from "@/modules/operacao/dominio/prazo";
import { hojeEmTexto, lerDia } from "@/modules/operacao/dominio/prazo";

const DIA_MS = 24 * 60 * 60 * 1000;
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function diasEntreTextos(a: string, b: string): number {
  const x = lerDia(a);
  const y = lerDia(b);
  if (!x || !y) return 0;
  return Math.round((Date.UTC(y.ano, y.mes - 1, y.dia) - Date.UTC(x.ano, x.mes - 1, x.dia)) / DIA_MS);
}

export function rotuloPrazo(data: string | null, hora: string | null, situacao: SituacaoPrazo, agora: Date = new Date()): string | null {
  if (!data) return null;
  const hoje = hojeEmTexto(agora);
  const diferenca = diasEntreTextos(hoje, data);
  const dia = lerDia(data);
  let texto: string;
  if (diferenca === 0) texto = "Hoje";
  else if (diferenca === 1) texto = "Amanhã";
  else if (diferenca === -1) texto = "Ontem";
  else if (diferenca > 1 && diferenca < 7 && dia) texto = SEMANA[new Date(Date.UTC(dia.ano, dia.mes - 1, dia.dia)).getUTCDay()];
  else if (dia) texto = `${String(dia.dia).padStart(2, "0")}/${String(dia.mes).padStart(2, "0")}${dia.ano !== Number(hoje.slice(0, 4)) ? `/${dia.ano}` : ""}`;
  else texto = data;
  if (hora) texto += ` ${hora}`;
  if (situacao === "atrasada" && diferenca < 0) texto += ` · ${Math.abs(diferenca)} ${Math.abs(diferenca) === 1 ? "dia" : "dias"} atrasada`;
  return texto;
}

export function classeSituacao(situacao: SituacaoPrazo): string {
  switch (situacao) {
    case "atrasada":
      return "text-destructive-text";
    case "hoje":
      return "text-warning-text";
    case "concluida":
      return "text-success-text";
    default:
      return "text-muted-foreground";
  }
}

export function quandoRelativo(iso: string, agora: Date = new Date()): string {
  const segundos = Math.round((agora.getTime() - new Date(iso).getTime()) / 1000);
  if (segundos < 60) return "agora";
  if (segundos < 3600) return `há ${Math.floor(segundos / 60)} min`;
  if (segundos < 86400) return `há ${Math.floor(segundos / 3600)} h`;
  const dias = Math.floor(segundos / 86400);
  if (dias < 30) return `há ${dias} ${dias === 1 ? "dia" : "dias"}`;
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(iso));
}
