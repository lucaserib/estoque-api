import { definirModelo, dataBR, reais, saudacao } from "./tipos";

export type DadosAvisoReajuste = { nome: string | null; plano: string; precoAtualCentavos: number; novoPrecoCentavos: number; aplicarEm: Date | string; motivo: string };

export const avisoReajuste = definirModelo<DadosAvisoReajuste>({
  chave: "aviso-reajuste",
  categoria: "TRANSACIONAL",
  urgente: false,
  montar: (dados) => ({
    assunto: `Aviso: o preço do plano ${dados.plano} do Skubo vai mudar`,
    preCabecalho: `A partir de ${dataBR(dados.aplicarEm)}, ${reais(dados.novoPrecoCentavos)}.`,
    corpo: `${saudacao(dados.nome)}\n\nQueremos avisar com antecedência: a partir de **${dataBR(dados.aplicarEm)}**, o plano **${dados.plano}** passa de ${reais(dados.precoAtualCentavos)} para **${reais(dados.novoPrecoCentavos)}**.\n\n${dados.motivo}\n\nSe preferir, você pode cancelar antes dessa data sem nenhuma cobrança extra.`,
    botao: { rotulo: "Ver minha assinatura", url: "/assinatura" },
    motivo: "Você recebeu este e-mail porque tem uma assinatura ativa no Skubo e o preço dela vai mudar.",
  }),
});
