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
    titulo: "Tarefas e ideias (Operação)",
    conteudo: (
      <div className="space-y-3">
        <p>
          A área{" "}
          <Link href="/operacao" className="text-primary hover:underline">
            Operação
          </Link>{" "}
          (no celular, <strong>Tarefas</strong> no menu de baixo) é onde a equipe combina quem faz o quê e até quando — e
          onde as ideias não se perdem.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Meu dia:</strong> o que está com você — atrasadas, para hoje, próximos 7 dias e sem prazo. Toque no
            círculo para concluir (dá para desfazer).
          </li>
          <li>
            <strong>Anotar rápido:</strong> escreva do jeito que fala, por exemplo &quot;Cobrar fornecedor amanhã @ana
            #compras !alta&quot;. O Skubo entende a pessoa (@), a etiqueta (#), a prioridade (!urgente, !alta, !baixa) e o
            prazo (hoje, amanhã, sexta, 15/12, às 14h) e mostra o que entendeu antes de criar.
          </li>
          <li>
            <strong>Quadros:</strong> A fazer → Fazendo → Aguardando → Feito. Arraste os cartões (no celular, segure o
            cartão ou use o menu … → Mover para). Colocar em &quot;Feito&quot; conclui. O administrador cria quadros,
            colunas, limite por coluna e etiquetas.
          </li>
          <li>
            <strong>Detalhe da tarefa:</strong> responsável, prazo, prioridade, etiquetas, repetição, descrição, checklist,
            comentários (use @ para chamar alguém) e histórico.
          </li>
          <li>
            <strong>Rotinas:</strong> tarefas que se repetem; ao concluir, a próxima já aparece. Em Meu dia, &quot;Ver
            rotinas sugeridas&quot; traz as mais comuns de quem vende no Mercado Livre.
          </li>
          <li>
            <strong>Lista e Calendário:</strong> todas as tarefas com filtros; no calendário do computador, arraste para
            outro dia para mudar o prazo; no celular, ele vira uma agenda.
          </li>
          <li>
            <strong>Ideias e notas:</strong> mural da equipe para ideias (todos podem apoiar) e notas. &quot;Só eu
            vejo&quot; deixa a nota privada — nem o administrador vê. &quot;Virar tarefa&quot; transforma a ideia em
            tarefa.
          </li>
          <li>
            <strong>Direto das outras telas:</strong> &quot;Criar tarefa&quot; na Central de controle, na Reposição, na
            Saúde dos anúncios, na ficha do produto e no pedido de compra — já preenchida, com o link de volta e sem
            duplicar.
          </li>
          <li>
            <strong>Avisos:</strong> notificação quando passarem uma tarefa para você, te mencionarem ou comentarem numa
            tarefa sua; por e-mail também, e um resumo diário às 8h (desligue em{" "}
            <Link href="/perfil" className="text-primary hover:underline">
              Perfil
            </Link>{" "}
            → Tarefas).
          </li>
        </ul>
      </div>
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
          <strong>Cuidados:</strong> a IA só lê os dados — nunca altera nada — e pode errar: confira na tela indicada.
          Quem não pode ver custo e margem não recebe esses números nem pela IA.
        </p>
        <p>
          <strong>Privacidade:</strong> cada pessoa vê só as próprias conversas, guardadas por 90 dias; dá para apagar
          qualquer uma no histórico, e o dono da conta apaga todas em Ajustes → Skubo IA. Para responder, os números da
          loja são enviados à Anthropic, a empresa do modelo de IA, sem dados pessoais de compradores; pelos termos
          comerciais da Anthropic, esses dados não são usados para treinar modelos.
        </p>
        <p>
          <strong>Quanto custa:</strong> a IA funciona com perguntas, sem mensalidade — veja Perguntas da IA logo abaixo.
        </p>
      </div>
    ),
  },
  {
    titulo: "Perguntas da IA",
    conteudo: (
      <div className="space-y-3">
        <p>
          Cada loja tem um saldo de perguntas, mostrado no topo do assistente e em{" "}
          <Link href="/ajustes#ia" className="text-primary hover:underline">
            Ajustes → Skubo IA
          </Link>
          .
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Grátis para começar:</strong> toda loja nova ganha perguntas para testar (válidas por 14 dias). Quem
            entrou pelo link de indicação de outra loja ganha perguntas extras.
          </li>
          <li>
            <strong>O que gasta:</strong> cada pergunta no assistente gasta 1, e cada análise da Central de controle
            também. As explicações dentro das telas são grátis até um limite por dia, e o resumo semanal é grátis para
            quem assina o Skubo. Se a resposta falhar, a pergunta volta para o saldo.
          </li>
          <li>
            <strong>Comprar mais:</strong> no assistente, em Ajustes → Skubo IA ou em{" "}
            <Link href="/assinatura" className="text-primary hover:underline">
              Assinatura
            </Link>
            . Escolha um pacote e pague por Pix ou cartão no Mercado Pago (abre em outra aba); as perguntas entram
            sozinhas quando o pagamento é aprovado. Pacote não é mensalidade: não renova sozinho.
          </li>
          <li>
            <strong>Validade:</strong> perguntas compradas valem 1 ano, e o saldo usa primeiro as que vencem antes.
            Quando sobrarem 3 ou menos, o assistente avisa e você recebe um e-mail.
          </li>
          <li>O saldo é da loja, não da pessoa: toda a equipe que usa a IA gasta do mesmo saldo.</li>
        </ul>
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
        , convide quem trabalha com você e escolha o papel (compras, estoque, vendas ou só leitura). O
        convite chega por e-mail e você também pode copiar o link ou mandar pelo WhatsApp. Ele vale 7 dias:
        use <strong>Renovar</strong> se vencer ou <strong>Reenviar</strong> se o e-mail não chegou. A pessoa
        cria a senha ou entra com o Google usando o e-mail convidado, e você recebe um aviso quando ela
        aceita. Para tirar alguém da equipe, use o botão de remover na linha da pessoa — ela perde o acesso
        na hora e recebe um e-mail. Quem quiser sair por conta própria usa{" "}
        <Link href="/perfil" className="text-primary hover:underline">
          Perfil
        </Link>{" "}
        → Sair desta equipe.
      </p>
    ),
  },
  {
    titulo: "Assinatura e teste grátis",
    conteudo: (
      <div className="space-y-3">
        <p>
          Toda loja começa com <strong>7 dias grátis, sem cartão</strong>. Em{" "}
          <Link href="/assinatura" className="text-primary hover:underline">
            Assinatura
          </Link>{" "}
          você vê quantos dias faltam e escolhe o plano — mensal (o primeiro mês pode ter desconto) ou anual —
          pago pelo Mercado Pago. Os preços estão sempre em{" "}
          <Link href="/planos" className="text-primary hover:underline">
            Planos
          </Link>
          .
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Assinar durante o teste não faz perder os dias que faltam: a primeira cobrança só acontece no fim do teste.</li>
          <li>Tem cupom? Digite no campo de cupom antes de assinar.</li>
          <li>Cancelar é a qualquer momento, em Assinatura; o acesso continua até o fim do período já pago.</li>
          <li>Pagamento recusado: o Mercado Pago tenta de novo e o Skubo continua funcionando por 5 dias. Troque o cartão em Assinatura.</li>
          <li>
            Com o teste ou a assinatura vencidos, quem é administrador vai para a tela de planos e quem é da equipe pode
            clicar em <strong>Avisar o responsável</strong>. Nenhum dado é apagado: assinando de novo, tudo volta.
          </li>
          <li>Só o administrador da conta assina, troca de plano ou cancela.</li>
        </ul>
      </div>
    ),
  },
  {
    titulo: "Indique e ganhe",
    conteudo: (
      <div className="space-y-3">
        <p>
          Em{" "}
          <Link href="/indique" className="text-primary hover:underline">
            Indique e ganhe
          </Link>{" "}
          estão o seu link e o seu código (SKU-…). Mande para outros vendedores pelo WhatsApp ou copie.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Quem entra pelo seu link (ou digita o código no cadastro) ganha perguntas extras da IA.</li>
          <li>
            Quando a loja indicada paga a assinatura e passa a carência, você ganha <strong>dias grátis de Skubo</strong>.
            As regras atuais aparecem na própria tela e no regulamento.
          </li>
          <li>
            Os dias entram sozinhos: no teste, o teste fica mais longo; no mensal, viram desconto na próxima cobrança (ou
            ela é pulada quando os dias cobrem o mês); no anual, o período é estendido.
          </li>
          <li>Indicar a própria loja, outra loja sua ou usar o mesmo pagamento não vale.</li>
          <li>Para receber o link, confirme o seu e-mail primeiro (o banner no topo reenvia a confirmação).</li>
        </ul>
      </div>
    ),
  },
  {
    titulo: "Sua conta e seus dados",
    conteudo: (
      <ul className="list-disc space-y-1.5 pl-5">
        <li>
          <strong>Esqueci a senha:</strong> na tela de entrada, Esqueci minha senha. O link vale 1 hora e, depois da troca,
          os outros aparelhos saem da conta.
        </li>
        <li>
          <strong>Confirmar o e-mail:</strong> o link chega no cadastro; se não chegou, use Reenviar link no banner do topo.
        </li>
        <li>
          <strong>E-mails que você recebe:</strong> em Perfil → Comunicações você escolhe receber ou não novidades e dicas.
          Avisos de segurança, cobrança e recibos sempre chegam.
        </li>
        <li>
          <strong>Seus dados (LGPD):</strong> em Perfil → Privacidade e seus dados você baixa uma cópia dos seus dados ou
          pede a exclusão da conta. Detalhes na{" "}
          <Link href="/privacidade" className="text-primary hover:underline">
            Política de Privacidade
          </Link>
          .
        </li>
      </ul>
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
