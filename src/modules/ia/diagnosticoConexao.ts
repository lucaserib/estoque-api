import { RecursoIa } from "@prisma/client";
import { type ProvedorIa, obterProvedorIa, textoDaResposta } from "./cliente";
import {
  iaConfigurada,
  iaDesligada,
  modeloPrincipal,
  modeloRapido,
  precosConfigurados,
  usarProvedorFalso,
  workspaceAnthropic,
} from "./config";
import { IaIndisponivelError } from "./erros";

export interface ResultadoTesteModelo {
  modelo: string;
  papel: "principal" | "rapido";
  ok: boolean;
  duracaoMs: number;
  resposta: string | null;
  erro: string | null;
}

export interface DiagnosticoConexaoIa {
  configurada: boolean;
  desligada: boolean;
  provedorFalso: boolean;
  workspaceDefinido: boolean;
  precosConfigurados: boolean;
  modelos: ResultadoTesteModelo[];
}

async function testarModelo(provedor: ProvedorIa, modelo: string, papel: "principal" | "rapido"): Promise<ResultadoTesteModelo> {
  const inicio = Date.now();
  try {
    const resposta = await provedor.criarMensagem({
      recurso: RecursoIa.TITULO,
      modelo,
      sistemaFixo: "Responda apenas com a palavra ok.",
      mensagens: [{ role: "user", content: "Teste de conexão do Skubo." }],
      maxTokens: 300,
      esforco: "low",
    });
    return { modelo, papel, ok: true, duracaoMs: Date.now() - inicio, resposta: textoDaResposta(resposta).trim().slice(0, 40), erro: null };
  } catch (error) {
    const erro =
      error instanceof IaIndisponivelError
        ? [error.detalhe ?? error.codigo, error.tecnico].filter(Boolean).join(" — ")
        : error instanceof Error
        ? error.name
        : "erro desconhecido";
    return { modelo, papel, ok: false, duracaoMs: Date.now() - inicio, resposta: null, erro };
  }
}

export async function diagnosticarConexaoIa(provedor?: ProvedorIa): Promise<DiagnosticoConexaoIa> {
  const base = {
    configurada: iaConfigurada(),
    desligada: iaDesligada(),
    provedorFalso: usarProvedorFalso(),
    workspaceDefinido: Boolean(workspaceAnthropic()),
    precosConfigurados: precosConfigurados(),
  };
  if (!base.configurada) return { ...base, modelos: [] };
  const cliente = provedor ?? obterProvedorIa();
  const principal = modeloPrincipal();
  const rapido = modeloRapido();
  const modelos = await Promise.all([
    testarModelo(cliente, principal, "principal"),
    ...(rapido !== principal ? [testarModelo(cliente, rapido, "rapido")] : []),
  ]);
  return { ...base, modelos };
}
