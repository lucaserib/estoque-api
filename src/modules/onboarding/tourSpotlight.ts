export interface PassoSpotlight {
  seletor: string;
  titulo: string;
  texto: string;
}

export const PASSOS_SPOTLIGHT: PassoSpotlight[] = [
  {
    seletor: "logo",
    titulo: "Esse é o Skubo",
    texto: "Clique aqui a qualquer momento pra voltar à Visão geral.",
  },
  {
    seletor: "busca",
    titulo: "Busque qualquer coisa",
    texto: "Produto, SKU, pedido ou anúncio — aperte ⌘K (ou clique aqui) de qualquer tela.",
  },
  {
    seletor: "comecar",
    titulo: "Sua jornada de configuração",
    texto: "Volte aqui sempre que quiser ver o que falta configurar na sua loja.",
  },
  {
    seletor: "notificacoes",
    titulo: "Avisos importantes",
    texto: "Pendência crítica, sincronização que falhou, conta pra reconectar — tudo aparece aqui.",
  },
];
