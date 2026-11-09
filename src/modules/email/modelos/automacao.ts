import { definirModelo } from "./tipos";

export type DadosAutomacao = { assunto: string; preCabecalho: string; corpo: string; botao?: { rotulo: string; url: string } | null; motivo?: string };

export const automacao = definirModelo<DadosAutomacao>({
  chave: "automacao",
  categoria: "CICLO_DE_VIDA",
  urgente: false,
  montar: (dados) => ({
    assunto: dados.assunto,
    preCabecalho: dados.preCabecalho,
    corpo: dados.corpo,
    botao: dados.botao ?? null,
    motivo: dados.motivo ?? "Você recebeu este e-mail porque tem uma conta no Skubo.",
  }),
});
