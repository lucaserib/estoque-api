import { definirModelo, saudacao } from "./tipos";

export type DadosConfirmarEmail = { nome: string | null; link: string };

export const confirmarEmail = definirModelo<DadosConfirmarEmail>({
  chave: "confirmar-email",
  categoria: "TRANSACIONAL",
  urgente: true,
  montar: (dados) => ({
    assunto: "Confirme seu e-mail no Skubo",
    preCabecalho: "Um clique para confirmar que este e-mail é seu.",
    corpo: `${saudacao(dados.nome)}\n\nConfirme seu e-mail para proteger sua conta e liberar a compra de perguntas da IA e o programa de indicação.\n\nO link vale por 72 horas.`,
    botao: { rotulo: "Confirmar meu e-mail", url: dados.link },
    motivo: "Você recebeu este e-mail porque criou uma conta no Skubo. Se não foi você, ignore esta mensagem.",
  }),
});
