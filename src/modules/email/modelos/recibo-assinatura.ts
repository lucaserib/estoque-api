import { definirModelo, dataBR, reais } from "./tipos";

export type DadosReciboAssinatura = { plano: string; valorCentavos: number; pagoEm: Date | string; proximaCobranca: Date | string | null };

export const reciboAssinatura = definirModelo<DadosReciboAssinatura>({
  chave: "recibo-assinatura",
  categoria: "TRANSACIONAL",
  urgente: false,
  montar: (dados) => ({
    assunto: `Recibo do Skubo · ${reais(dados.valorCentavos)}`,
    preCabecalho: `Pagamento do plano ${dados.plano} confirmado.`,
    corpo: `Recebemos seu pagamento. Obrigado por usar o Skubo!\n\n- Plano: **${dados.plano}**\n- Valor: **${reais(dados.valorCentavos)}**\n- Pago em: ${dataBR(dados.pagoEm)}${dados.proximaCobranca ? `\n- Próxima cobrança: ${dataBR(dados.proximaCobranca)}` : ""}\n\nO comprovante oficial fica no seu Mercado Pago.`,
    botao: { rotulo: "Ver minha assinatura", url: "/assinatura" },
    motivo: "Você recebeu este e-mail porque um pagamento da sua assinatura do Skubo foi aprovado.",
  }),
});
