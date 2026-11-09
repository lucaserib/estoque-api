import { definirModelo, saudacao } from "./tipos";

export type DadosRedefinirSenha = { nome: string | null; link: string };

export const redefinirSenha = definirModelo<DadosRedefinirSenha>({
  chave: "redefinir-senha",
  categoria: "TRANSACIONAL",
  urgente: true,
  montar: (dados) => ({
    assunto: "Redefina sua senha do Skubo",
    preCabecalho: "O link vale por 1 hora e só pode ser usado uma vez.",
    corpo: `${saudacao(dados.nome)}\n\nRecebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo para escolher uma nova senha.\n\nO link vale por **1 hora** e só funciona uma vez. Depois da troca, os outros aparelhos saem da conta.\n\nSe não foi você, pode ignorar este e-mail: sua senha continua a mesma.`,
    botao: { rotulo: "Criar nova senha", url: dados.link },
    motivo: "Você recebeu este e-mail porque alguém pediu para redefinir a senha desta conta no Skubo.",
  }),
});
