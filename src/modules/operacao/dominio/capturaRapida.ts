import type { PrioridadeTarefa } from "@prisma/client";
import { type DiaCalendario, diaEmBrasilia, somarDiasAoDia } from "@/modules/financeiro/dominio/periodo";
import { diaParaTexto, lerDia } from "./prazo";

export interface PessoaCaptura {
  id: string;
  nome: string | null;
  email: string;
}

export interface EtiquetaCaptura {
  id: string;
  nome: string;
}

export interface ResultadoCaptura {
  titulo: string;
  responsavelId: string | null;
  etiquetaIds: string[];
  prioridade: PrioridadeTarefa | null;
  prazo: { data: string; hora: string | null } | null;
  avisos: string[];
}

export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

const PRIORIDADES: Record<string, PrioridadeTarefa> = {
  urgente: "URGENTE",
  alta: "ALTA",
  media: "MEDIA",
  baixa: "BAIXA",
};

const DIAS_SEMANA: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  "segunda-feira": 1,
  terca: 2,
  "terca-feira": 2,
  quarta: 3,
  "quarta-feira": 3,
  quinta: 4,
  "quinta-feira": 4,
  sexta: 5,
  "sexta-feira": 5,
  sabado: 6,
};

const CONECTORES_DATA = new Set(["ate", "para", "pra", "em", "na", "no", "dia"]);
const PADRAO_HORA = /^([01]?\d|2[0-3])(?:h([0-5]\d)?|:([0-5]\d))$/;
const PADRAO_HORA_SEM_SUFIXO = /^([01]?\d|2[0-3])$/;

function lerHora(texto: string, aceitarSemSufixo: boolean): string | null {
  const partes = PADRAO_HORA.exec(texto) ?? (aceitarSemSufixo ? PADRAO_HORA_SEM_SUFIXO.exec(texto) : null);
  if (!partes) return null;
  return `${String(Number(partes[1])).padStart(2, "0")}:${partes[2] ?? partes[3] ?? "00"}`;
}
const PADRAO_DATA = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/;

function diaDaSemana(dia: DiaCalendario): number {
  return new Date(Date.UTC(dia.ano, dia.mes - 1, dia.dia)).getUTCDay();
}

function proximoDiaDaSemana(hoje: DiaCalendario, alvo: number): DiaCalendario {
  const atual = diaDaSemana(hoje);
  const distancia = ((alvo - atual + 7) % 7) || 7;
  return somarDiasAoDia(hoje, distancia);
}

function dataPorBarra(partes: RegExpExecArray, hoje: DiaCalendario): DiaCalendario | null {
  const dia = Number(partes[1]);
  const mes = Number(partes[2]);
  let ano = partes[3] ? Number(partes[3]) : hoje.ano;
  if (partes[3] && partes[3].length === 2) ano += 2000;
  const texto = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  const lido = lerDia(texto);
  if (!lido) return null;
  if (!partes[3] && (lido.mes < hoje.mes || (lido.mes === hoje.mes && lido.dia < hoje.dia))) {
    return lerDia(`${ano + 1}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`);
  }
  return lido;
}

function encontrarPessoa(token: string, pessoas: PessoaCaptura[]): PessoaCaptura[] {
  const alvo = normalizar(token);
  if (!alvo) return [];
  const porPrimeiroNome = pessoas.filter((p) => normalizar(p.nome ?? "").split(/\s+/)[0] === alvo);
  if (porPrimeiroNome.length > 0) return porPrimeiroNome;
  return pessoas.filter(
    (p) =>
      normalizar(p.nome ?? "").replace(/\s+/g, "").startsWith(alvo) ||
      normalizar(p.email.split("@")[0]).startsWith(alvo)
  );
}

function encontrarEtiqueta(token: string, etiquetas: EtiquetaCaptura[]): EtiquetaCaptura | null {
  const alvo = normalizar(token);
  return (
    etiquetas.find((e) => normalizar(e.nome) === alvo) ??
    etiquetas.find((e) => normalizar(e.nome).replace(/\s+/g, "").startsWith(alvo)) ??
    null
  );
}

export function interpretarCaptura(
  texto: string,
  contexto: { pessoas: PessoaCaptura[]; etiquetas: EtiquetaCaptura[]; agora?: Date }
): ResultadoCaptura {
  const hoje = diaEmBrasilia(contexto.agora ?? new Date());
  const palavras = texto.trim().split(/\s+/).filter(Boolean);
  const consumidas = new Set<number>();
  const avisos: string[] = [];
  let responsavelId: string | null = null;
  const etiquetaIds: string[] = [];
  let prioridade: PrioridadeTarefa | null = null;
  let dia: DiaCalendario | null = null;
  let hora: string | null = null;

  const consumirConector = (indice: number) => {
    const anterior = indice - 1;
    if (anterior >= 0 && !consumidas.has(anterior) && CONECTORES_DATA.has(normalizar(palavras[anterior]))) {
      consumidas.add(anterior);
    }
  };

  for (let i = 0; i < palavras.length; i += 1) {
    if (consumidas.has(i)) continue;
    const bruto = palavras[i];
    const limpo = normalizar(bruto).replace(/[.,;]+$/, "");

    if (bruto.startsWith("@") && bruto.length > 1) {
      const encontradas = encontrarPessoa(bruto.slice(1).replace(/[.,;]+$/, ""), contexto.pessoas);
      if (encontradas.length === 1) {
        responsavelId = encontradas[0].id;
        consumidas.add(i);
      } else if (encontradas.length > 1) {
        avisos.push(`Mais de uma pessoa combina com ${bruto}.`);
      } else {
        avisos.push(`Ninguém da equipe combina com ${bruto}.`);
      }
      continue;
    }

    if (bruto.startsWith("#") && bruto.length > 1) {
      const etiqueta = encontrarEtiqueta(bruto.slice(1).replace(/[.,;]+$/, ""), contexto.etiquetas);
      if (etiqueta) {
        if (!etiquetaIds.includes(etiqueta.id)) etiquetaIds.push(etiqueta.id);
        consumidas.add(i);
      } else {
        avisos.push(`A etiqueta ${bruto} não existe.`);
      }
      continue;
    }

    if (bruto.startsWith("!") && PRIORIDADES[limpo.slice(1)]) {
      prioridade = PRIORIDADES[limpo.slice(1)];
      consumidas.add(i);
      continue;
    }

    if (limpo === "hoje") {
      dia = hoje;
      consumidas.add(i);
      consumirConector(i);
      continue;
    }

    if (limpo === "amanha") {
      dia = somarDiasAoDia(hoje, 1);
      consumidas.add(i);
      consumirConector(i);
      continue;
    }

    if (limpo === "depois" && normalizar(palavras[i + 1] ?? "") === "de" && normalizar(palavras[i + 2] ?? "").replace(/[.,;]+$/, "") === "amanha") {
      dia = somarDiasAoDia(hoje, 2);
      consumidas.add(i).add(i + 1).add(i + 2);
      consumirConector(i);
      continue;
    }

    if (limpo in DIAS_SEMANA) {
      dia = proximoDiaDaSemana(hoje, DIAS_SEMANA[limpo]);
      consumidas.add(i);
      consumirConector(i);
      continue;
    }

    const porBarra = PADRAO_DATA.exec(limpo);
    if (porBarra) {
      const lido = dataPorBarra(porBarra, hoje);
      if (lido) {
        dia = lido;
        consumidas.add(i);
        consumirConector(i);
      } else {
        avisos.push(`Data inválida: ${bruto}.`);
      }
      continue;
    }

    if (limpo === "as") {
      const seguinte = lerHora(normalizar(palavras[i + 1] ?? "").replace(/[.,;]+$/, ""), true);
      if (seguinte) {
        hora = seguinte;
        consumidas.add(i).add(i + 1);
        continue;
      }
    }

    const horaDireta = lerHora(limpo, false);
    if (horaDireta) {
      hora = horaDireta;
      consumidas.add(i);
    }
  }

  if (hora && !dia) dia = hoje;

  const titulo = palavras
    .filter((_, indice) => !consumidas.has(indice))
    .join(" ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/[\s,;-]+$/, "")
    .trim();

  return {
    titulo,
    responsavelId,
    etiquetaIds,
    prioridade,
    prazo: dia ? { data: diaParaTexto(dia), hora } : null,
    avisos,
  };
}
