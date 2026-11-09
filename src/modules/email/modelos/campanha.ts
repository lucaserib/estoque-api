import { definirModelo } from "./tipos";

export type DadosCampanha = { assunto: string; preCabecalho: string; corpo: string; botao?: { rotulo: string; url: string } | null };

export const campanha = definirModelo<DadosCampanha>({
  chave: "campanha",
  categoria: "MARKETING",
  urgente: false,
  montar: (dados) => ({
    assunto: dados.assunto,
    preCabecalho: dados.preCabecalho,
    corpo: dados.corpo,
    botao: dados.botao ?? null,
    motivo: "Você recebeu este e-mail porque aceitou receber novidades e ofertas do Skubo.",
  }),
});
