export interface PassoSpotlight {
  /** Valor do atributo data-tour do elemento a destacar. */
  seletor: string;
  titulo: string;
  texto: string;
}

/**
 * Passos do tour guiado sobre a interface real. Cada um aponta pra um
 * elemento com [data-tour="<seletor>"] em algum lugar do app — pra adicionar
 * um passo novo, só marcar o elemento com esse atributo e incluir aqui.
 */
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
