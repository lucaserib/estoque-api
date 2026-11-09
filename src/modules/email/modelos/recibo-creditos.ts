import { definirModelo, dataBR, reais } from "./tipos";

export type DadosReciboCreditos = { pacote: string; perguntas: number; valorCentavos: number; validoAte: Date | string; saldo: number };

export const reciboCreditos = definirModelo<DadosReciboCreditos>({
  chave: "recibo-creditos",
  categoria: "TRANSACIONAL",
  urgente: false,
  montar: (dados) => ({
    assunto: `Suas ${dados.perguntas} perguntas da Skubo IA chegaram`,
    preCabecalho: `Pagamento de ${reais(dados.valorCentavos)} confirmado.`,
    corpo: `Pagamento confirmado! Suas perguntas já estão na conta.\n\n- Pacote: **${dados.pacote}**\n- Valor: **${reais(dados.valorCentavos)}**\n- Perguntas: **${dados.perguntas}**, válidas até ${dataBR(dados.validoAte)}\n- Saldo agora: **${dados.saldo} perguntas**`,
    botao: { rotulo: "Perguntar para a IA", url: "/ia" },
    motivo: "Você recebeu este e-mail porque comprou um pacote de perguntas da Skubo IA.",
  }),
});
