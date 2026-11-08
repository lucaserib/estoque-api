export const EVENTO_ABRIR_ASSISTENTE = "skubo:abrir-assistente";
export const EVENTO_ABRIR_VENDA_IA = "skubo:abrir-venda-ia";

export interface DetalheAbrirAssistente {
  pergunta?: string;
  enviar?: boolean;
}

export function abrirAssistente(detalhe: DetalheAbrirAssistente = {}) {
  window.dispatchEvent(new CustomEvent<DetalheAbrirAssistente>(EVENTO_ABRIR_ASSISTENTE, { detail: detalhe }));
}

export function abrirVendaIa() {
  window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_VENDA_IA));
}

export function perguntaSobreItemDiagnostico(item: { titulo: string; quantidade: number }): string {
  return `Sobre "${item.titulo}" (${item.quantidade}) na Central de controle: o que está acontecendo e o que eu faço primeiro?`;
}
