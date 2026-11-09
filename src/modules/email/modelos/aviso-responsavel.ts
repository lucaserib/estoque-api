import { definirModelo } from "./tipos";

export type DadosAvisoResponsavel = { nomeMembro: string | null; emailMembro: string; nomeLoja: string | null };

export const avisoResponsavel = definirModelo<DadosAvisoResponsavel>({
  chave: "aviso-responsavel",
  categoria: "TRANSACIONAL",
  urgente: false,
  montar: (dados) => ({
    assunto: "Sua equipe está sem acesso ao Skubo",
    preCabecalho: "A assinatura da loja precisa ser renovada.",
    corpo: `Olá!\n\n**${dados.nomeMembro ?? dados.emailMembro}** tentou usar o Skubo, mas a assinatura ${dados.nomeLoja ? `da loja **${dados.nomeLoja}**` : "da loja"} não está ativa. Enquanto isso, ninguém da equipe consegue acessar.\n\nRenove para liberar todo mundo de novo. Seus dados continuam guardados.`,
    botao: { rotulo: "Renovar a assinatura", url: "/assinatura" },
    motivo: "Você recebeu este e-mail porque administra a assinatura desta loja no Skubo.",
  }),
});
