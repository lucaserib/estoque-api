import { definirModelo } from "./tipos";

export type DadosConviteAceito = { nomeConvidado: string | null; emailConvidado: string; papel: string };

export const conviteAceito = definirModelo<DadosConviteAceito>({
  chave: "convite-aceito",
  categoria: "TRANSACIONAL",
  urgente: false,
  montar: (dados) => ({
    assunto: `${dados.nomeConvidado ?? dados.emailConvidado} entrou na sua equipe`,
    preCabecalho: "O convite que você mandou foi aceito.",
    corpo: `Boa notícia: **${dados.nomeConvidado ?? dados.emailConvidado}** (${dados.emailConvidado}) aceitou o convite e já faz parte da equipe, com o papel **${dados.papel}**.\n\nVocê pode mudar o papel ou remover a pessoa quando quiser em Usuários.`,
    botao: { rotulo: "Ver a equipe", url: "/usuarios" },
    motivo: "Você recebeu este e-mail porque convidou esta pessoa para a sua equipe no Skubo.",
  }),
});
