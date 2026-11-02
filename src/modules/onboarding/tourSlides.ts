import type { LucideIcon } from "lucide-react";
import { Boxes, Link2, Compass, LayoutGrid, AlertTriangle, Rocket } from "lucide-react";

export interface SlideTour {
  icon: LucideIcon;
  titulo: string;
  texto: string;
}

export const SLIDES_TOUR: SlideTour[] = [
  {
    icon: Boxes,
    titulo: "O estoque e o lucro da sua loja, num cubo só",
    texto:
      "O Skubo junta Mercado Livre, Bling e estoque num lugar só, pra você saber o que vender, repor e quanto sobra no fim do mês.",
  },
  {
    icon: Link2,
    titulo: "De onde vêm os números",
    texto:
      "Preço e estoque vêm direto do Mercado Livre e do Bling, sincronizados sozinhos. Custo vem das suas compras confirmadas. Nada aqui é estimado sem avisar.",
  },
  {
    icon: Compass,
    titulo: "A jornada de configuração",
    texto:
      "A tela \"Configurar minha loja\" conduz você passo a passo — conectar, trazer o catálogo, vincular anúncios, preencher custo. Cada passo libera o próximo.",
  },
  {
    icon: LayoutGrid,
    titulo: "Onde fica cada coisa",
    texto:
      "Vendas e lucro, Estoque e compras, Anúncios e Ajustes — os 4 grupos do menu lateral. No celular, a mesma coisa numa barra embaixo.",
  },
  {
    icon: AlertTriangle,
    titulo: "Pendências que avisam antes de um prejuízo",
    texto:
      "Produto sem custo, margem negativa, venda sem vínculo — o Skubo mostra isso antes de virar um problema maior, com um botão que resolve.",
  },
  {
    icon: Rocket,
    titulo: "Pronto pra começar",
    texto: "Vamos deixar sua loja configurada — leva menos de 15 minutos.",
  },
];
