import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";

const SECOES = [
  {
    titulo: "Primeiros passos",
    conteudo: (
      <>
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>
            Conecte o <strong>Mercado Livre</strong> e o <strong>Bling</strong> em{" "}
            <Link href="/integracoes" className="text-primary hover:underline">
              Integrações
            </Link>
            .
          </li>
          <li>Rode &quot;Sincronizar agora&quot; em cada um — isso traz seus anúncios, produtos e estoque.</li>
          <li>
            Em{" "}
            <Link href="/mercado-livre/produtos" className="text-primary hover:underline">
              Anúncios e vínculos
            </Link>
            , vincule cada anúncio ao produto certo do seu catálogo. Um anúncio sem vínculo não entra no
            cálculo de custo, margem ou reposição.
          </li>
          <li>Preencha o custo dos produtos que ainda não têm — sem custo não tem margem.</li>
        </ol>
        <p className="mt-3 text-sm text-muted-foreground">
          A jornada{" "}
          <Link href="/comecar" className="text-primary hover:underline">
            Primeiros passos
          </Link>{" "}
          guia por essas etapas na ordem, com uma barra de progresso.
        </p>
      </>
    ),
  },
  {
    titulo: "Saúde dos anúncios",
    conteudo: (
      <p>
        <Link href="/mercado-livre" className="text-primary hover:underline">
          Mercado Livre
        </Link>{" "}
        mostra o que precisa de atenção nos seus anúncios ativos, agrupado por tipo de problema: preço
        abaixo do custo, sem estoque, estoque Full baixo, pausado, sem vínculo, sem tarifa ou frete
        sincronizados. Cada grupo tem um botão que leva direto pra resolver.
      </p>
    ),
  },
  {
    titulo: "Vendas e lucro",
    conteudo: (
      <p>
        <Link href="/financeiro/vendas" className="text-primary hover:underline">
          Vendas
        </Link>{" "}
        tem duas abas: <strong>Por venda</strong> (cada pedido, com o lucro calculado) e{" "}
        <strong>Por produto</strong> (ranking de quem mais dá margem). O lucro usa sempre preço, tarifa,
        frete, custo e imposto do momento — não é um número salvo que pode ficar desatualizado.
      </p>
    ),
  },
  {
    titulo: "DRE (Financeiro)",
    conteudo: (
      <p>
        <Link href="/financeiro/dre" className="text-primary hover:underline">
          A DRE
        </Link>{" "}
        mostra o resultado do período em cascata: receita → custo da mercadoria → tarifas e frete →
        despesas fixas rateadas → resultado final. Cada linha tem uma explicação de onde o número vem.
      </p>
    ),
  },
  {
    titulo: "Reposição",
    conteudo: (
      <p>
        <Link href="/reposicao" className="text-primary hover:underline">
          Reposição
        </Link>{" "}
        sugere quanto comprar de cada produto, com base na venda real dos últimos dias (incluindo saída
        manual e venda de kit explodida nos componentes) e no estoque disponível (local + Full + pedidos
        de compra já em aberto). &quot;Gerar pedidos&quot; monta rascunhos de pedido de compra agrupados
        pelo fornecedor principal de cada produto.
      </p>
    ),
  },
  {
    titulo: "Ajustes",
    conteudo: (
      <p>
        Uma tela só (
        <Link href="/ajustes" className="text-primary hover:underline">
          Ajustes
        </Link>
        ) pra conta, loja e marca, impostos e faturamento, prazo padrão de reposição, status das
        integrações, link pro Financeiro e aparência (tema claro/escuro).
      </p>
    ),
  },
  {
    titulo: "Celular",
    conteudo: (
      <p>
        O app funciona instalado na tela de início do celular (PWA) — guia completo em{" "}
        <Link href="/ajuda/celular" className="text-primary hover:underline">
          Instalar no celular
        </Link>
        . Uma vez instalado, a navegação de baixo e o botão &quot;+&quot; flutuante facilitam o uso com
        uma mão.
      </p>
    ),
  },
];

export default function ManualDoUsuarioPage() {
  return (
    <div className="container mx-auto max-w-2xl space-y-6 p-6">
      <PageHeader title="Manual do usuário" subtitle="Guia rápido das telas principais" />

      {SECOES.map((secao) => (
        <SectionCard key={secao.titulo} title={secao.titulo}>
          <div className="text-sm leading-relaxed text-foreground">{secao.conteudo}</div>
        </SectionCard>
      ))}

      <p className="text-sm text-muted-foreground">
        Dúvida ou problema que este manual não resolveu: fale com quem administra sua conta do Skubo.
      </p>
    </div>
  );
}
