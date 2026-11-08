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
          <li>
            Logo depois de conectar o Bling, o Skubo já traz produtos, custos e estoque. Se faltar alguma
            permissão no app do Bling, a tela de Integrações mostra qual marcar.
          </li>
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
            Configurar minha loja
          </Link>{" "}
          guia por essas etapas na ordem, com uma barra de progresso.
        </p>
      </>
    ),
  },
  {
    titulo: "Central de controle",
    conteudo: (
      <p>
        A{" "}
        <Link href="/controle" className="text-primary hover:underline">
          Central de controle
        </Link>{" "}
        dá uma nota de 0 a 100 para a saúde da loja e lista, por ordem de urgência, o que está distorcendo
        os números ou travando vendas: produto que vende e está sem estoque, sem custo, margem negativa,
        anúncio sem vínculo, vendas sem custo no DRE, imposto não configurado, despesas do mês não lançadas,
        integração desconectada. Cada item tem o botão que leva direto para resolver e, com o Skubo IA, o
        botão <strong>Perguntar sobre isto</strong>. No plano com IA, a análise lê tudo isso e devolve as
        prioridades do mês, e toda segunda chega o resumo da semana.
      </p>
    ),
  },
  {
    titulo: "Assistente IA (Skubo IA)",
    conteudo: (
      <div className="space-y-3">
        <p>
          Um analista de e-commerce que conversa com os números da sua loja. Abra pelo botão de brilho no canto da
          tela, pelo atalho <strong>Ctrl + J</strong> (Cmd + J no Mac) ou em{" "}
          <Link href="/ia" className="text-primary hover:underline">
            Assistente IA
          </Link>
          .
        </p>
        <p>
          <strong>O que perguntar:</strong> estoque, reposição, Full, anúncios, vendas, margem, faturamento com frete,
          cadastro e a Central de controle. Por exemplo: &quot;O que preciso comprar esta semana?&quot;, &quot;Por que minha
          margem caiu este mês?&quot;, &quot;Quais anúncios estão perdendo venda?&quot;, &quot;Compare este mês com o mês
          passado.&quot; Ele mostra o que está consultando e diz em qual tela você confere cada número.
        </p>
        <p>
          <strong>Dentro das telas:</strong> &quot;Por que essa sugestão?&quot; na Reposição, &quot;Resumo do produto&quot; na ficha
          do produto, &quot;Explicar variação&quot; na Visão geral e no Financeiro, &quot;Plano de ação&quot; na Saúde dos anúncios
          e &quot;Perguntar sobre isto&quot; na Central de controle. Toda segunda, o resumo da semana chega na Central (dá para
          desligar o aviso em Perfil).
        </p>
        <p>
          <strong>Limites:</strong> cada conta tem um limite mensal de uso, mostrado no topo do assistente. A IA só lê
          os dados — nunca altera nada — e pode errar: confira na tela indicada. Quem não pode ver custo e margem não
          recebe esses números nem pela IA.
        </p>
        <p>
          <strong>Privacidade:</strong> cada pessoa vê só as próprias conversas, guardadas por 90 dias; dá para apagar
          qualquer uma no histórico, e o dono da conta apaga todas em Ajustes → Skubo IA. Para responder, os números da
          loja são enviados à Anthropic, a empresa do modelo de IA, sem dados pessoais de compradores; pelos termos
          comerciais da Anthropic, esses dados não são usados para treinar modelos.
        </p>
        <p>
          <strong>Como contratar:</strong> em{" "}
          <Link href="/assinatura?recurso=ia" className="text-primary hover:underline">
            Assinatura
          </Link>{" "}
          ou no próprio assistente — teste grátis de 7 dias (uma vez por conta) ou R$ 29,90/mês pelo Mercado Pago,
          cancelável a qualquer momento.
        </p>
      </div>
    ),
  },
  {
    titulo: "Faturamento com frete",
    conteudo: (
      <p>
        O cartão <strong>Quanto foi faturado de verdade</strong> (Visão geral e Financeiro) mostra o
        faturamento de três jeitos: só produtos (igual ao Mercado Livre), com frete (produtos + frete do
        envio, como o Bling registra o pedido) e em nota fiscal (soma das notas de saída autorizadas no
        Bling). &quot;Ver por dia&quot; abre a tabela diária e &quot;Trazer notas do Bling&quot; atualiza as notas
        na hora — elas também são atualizadas sozinhas todo dia.
      </p>
    ),
  },
  {
    titulo: "Equipe",
    conteudo: (
      <p>
        Em{" "}
        <Link href="/usuarios" className="text-primary hover:underline">
          Usuários
        </Link>
        , convide quem trabalha com você e escolha o papel (compras, estoque, vendas ou só leitura). Envie o
        link pelo WhatsApp ou copie. A pessoa pode criar senha ou entrar com o Google usando o e-mail
        convidado — se ela já tinha login no Skubo sem loja própria, basta entrar.
      </p>
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
    <div className="mx-auto w-full max-w-2xl space-y-6">
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
