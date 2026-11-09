import { definirModelo, dataBR } from "./tipos";

export type DadosConviteEquipe = { nomeConvidante: string | null; nomeLoja: string | null; papel: string; link: string; expiraEm: Date | string };

export const conviteEquipe = definirModelo<DadosConviteEquipe>({
  chave: "convite-equipe",
  categoria: "TRANSACIONAL",
  urgente: true,
  montar: (dados) => ({
    assunto: `${dados.nomeConvidante ?? "Sua equipe"} convidou você para o Skubo`,
    preCabecalho: `Entre na equipe ${dados.nomeLoja ? `da loja ${dados.nomeLoja}` : "da loja"} no Skubo.`,
    corpo: `Olá!\n\n**${dados.nomeConvidante ?? "Um administrador"}** convidou você para a equipe ${dados.nomeLoja ? `da loja **${dados.nomeLoja}**` : "da loja"} no Skubo, com o papel **${dados.papel}**.\n\nO Skubo junta estoque, reposição e lucro do Mercado Livre e do Bling num lugar só.\n\nO convite vale até ${dataBR(dados.expiraEm)}.`,
    botao: { rotulo: "Aceitar o convite", url: dados.link },
    motivo: "Você recebeu este e-mail porque alguém da loja convidou este endereço para o Skubo. Se não esperava o convite, ignore esta mensagem.",
  }),
});
