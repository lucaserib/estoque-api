import { definirModelo, saudacao } from "./tipos";

export type DadosMembroRemovido = { nome: string | null; nomeLoja: string | null; saiuPorConta: boolean };

export const membroRemovido = definirModelo<DadosMembroRemovido>({
  chave: "membro-removido",
  categoria: "TRANSACIONAL",
  urgente: false,
  montar: (dados) => ({
    assunto: dados.saiuPorConta ? "Você saiu da equipe no Skubo" : "Você não faz mais parte da equipe no Skubo",
    preCabecalho: "Seu acesso aos dados da loja foi encerrado.",
    corpo: `${saudacao(dados.nome)}\n\n${dados.saiuPorConta ? "Você saiu" : "Um administrador removeu você"} da equipe ${dados.nomeLoja ? `da loja **${dados.nomeLoja}**` : "da loja"} no Skubo. Você não vê mais os dados dessa loja.\n\nSeu login continua funcionando: se quiser, pode usar o Skubo com a sua própria loja, com teste grátis.`,
    botao: { rotulo: "Entrar no Skubo", url: "/login" },
    motivo: "Você recebeu este e-mail porque seu acesso a uma equipe no Skubo mudou.",
  }),
});
