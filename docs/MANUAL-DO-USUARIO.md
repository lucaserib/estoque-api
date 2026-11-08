# Manual do usuário — Skubo

Guia rápido das telas principais. A mesma versão, com os mesmos textos, está disponível dentro do app em **menu do usuário → Ajuda → Manual do usuário** (`/ajuda/manual`).

## Primeiros passos

1. Conecte o **Mercado Livre** e o **Bling** em Integrações (menu lateral).
2. Logo depois de conectar o Bling, o Skubo já traz produtos, custos e estoque. Se faltar alguma permissão no app do Bling, a tela de Integrações mostra qual marcar.
3. Em Anúncios e vínculos (Mercado Livre), vincule cada anúncio ao produto certo do seu catálogo. Um anúncio sem vínculo não entra no cálculo de custo, margem ou reposição.
4. Preencha o custo dos produtos que ainda não têm (Ajustes → ou direto na ficha do produto) — sem custo não tem margem.

A jornada **Configurar minha loja** (`/comecar`) guia por essas etapas na ordem, com uma barra de progresso.

## Central de controle

`/controle` dá uma nota de 0 a 100 para a saúde da loja e lista, por ordem de urgência, o que está distorcendo os números ou travando vendas: produto que vende e está sem estoque, sem custo, margem negativa, anúncio sem vínculo, vendas sem custo no DRE, imposto não configurado, despesas do mês não lançadas, integração desconectada. Cada item tem o botão que leva direto para resolver e, com o Skubo IA, o botão **Perguntar sobre isto**. No plano com IA, a análise lê tudo isso e devolve as prioridades do mês, e toda segunda chega o resumo da semana.

## Assistente IA (Skubo IA)

O Skubo IA é um analista de e-commerce que conversa com os números da sua loja. Abra pelo botão de brilho no canto da tela, pelo atalho **Ctrl + J** (Cmd + J no Mac) ou pelo menu **Início → Assistente IA** (`/ia`, em tela cheia).

**O que dá para perguntar.** Tudo o que o Skubo sabe da sua loja: estoque, reposição, Full, anúncios, vendas, margem, faturamento com frete, cadastro e a Central de controle. Exemplos:

- "O que preciso comprar esta semana?"
- "Por que minha margem caiu este mês?"
- "Quais anúncios estão perdendo venda?"
- "Compare este mês com o mês passado."
- "Quanto faturei com frete ontem?"
- "Como está o Borrifador 500 ml?"

Enquanto pensa, ele mostra o que está consultando ("Consultando a reposição…") e, na resposta, diz em qual tela você confere cada número. As sugestões de pergunta mudam conforme a tela aberta. Enter envia, Shift + Enter quebra a linha, **Parar** interrompe, e 👍/👎 ajudam a melhorar as respostas.

**Dentro das telas.** Os botões com o ícone de brilho explicam o número na hora: **Por que essa sugestão?** em cada linha da Reposição, **Resumo do produto** na ficha do produto, **Explicar variação** na Visão geral e no Financeiro, **Plano de ação** na Saúde dos anúncios e **Perguntar sobre isto** em cada item da Central de controle.

**Resumo semanal.** Toda segunda de manhã a Central de controle recebe o resumo da semana anterior com 3 prioridades e os riscos. Quem é administrador da conta recebe um aviso; dá para desligar em **Perfil → Notificações**.

**Limites.** Cada conta tem um limite mensal de uso, mostrado no topo do assistente ("62% do uso do mês"). Ao chegar em 100%, o assistente avisa a data em que o limite renova. A IA só lê os dados — ela nunca altera produtos, pedidos ou anúncios — e pode errar: confira sempre na tela indicada.

**Quem vê o quê.** Cada pessoa vê só as próprias conversas. O assistente respeita o papel de quem pergunta: quem não pode ver custo e margem não recebe esses números nem pela IA.

**Privacidade.** As conversas ficam guardadas por 90 dias e você pode apagar qualquer uma no histórico; o dono da conta pode apagar todas em **Ajustes → Skubo IA**. Para responder, os números da loja são enviados à Anthropic, a empresa do modelo de IA, sem dados pessoais de compradores; pelos termos comerciais da Anthropic, esses dados não são usados para treinar modelos.

**Como contratar.** Em **Assinatura** (`/assinatura`) ou no próprio assistente: **Testar grátis por 7 dias** (uma vez por conta) ou **Assinar** por R$ 29,90/mês, pago pelo Mercado Pago junto com a sua assinatura do Skubo. Dá para cancelar a qualquer momento e o acesso continua até o fim do mês pago. Só o administrador da conta contrata.

## Faturamento com frete

O cartão **Quanto foi faturado de verdade** (Visão geral e Financeiro) mostra o faturamento de três jeitos: só produtos (igual ao Mercado Livre), com frete (produtos + frete do envio, como o Bling registra o pedido) e em nota fiscal (soma das notas de saída autorizadas no Bling). "Ver por dia" abre a tabela diária e "Trazer notas do Bling" atualiza as notas na hora — elas também são atualizadas sozinhas todo dia.

## Equipe

Em Usuários (`/usuarios`), convide quem trabalha com você e escolha o papel (compras, estoque, vendas ou só leitura). Envie o link pelo WhatsApp ou copie. A pessoa pode criar senha ou entrar com o Google usando o e-mail convidado — se ela já tinha login no Skubo sem loja própria, basta entrar.

## Saúde dos anúncios

`/mercado-livre` mostra o que precisa de atenção nos seus anúncios ativos, agrupado por tipo de problema: preço abaixo do custo, sem estoque, estoque Full baixo, pausado, sem vínculo, sem tarifa ou frete sincronizados. Cada grupo tem um botão que leva direto pra resolver.

## Vendas e lucro

`/financeiro/vendas` tem duas abas: **Por venda** (cada pedido, com o lucro calculado) e **Por produto** (ranking de quem mais dá margem). O lucro usa sempre preço, tarifa, frete, custo e imposto do momento — não é um número salvo que pode ficar desatualizado.

## DRE (Financeiro)

`/financeiro/dre` mostra o resultado do período em cascata: receita → custo da mercadoria → tarifas e frete → despesas fixas rateadas → resultado final. Cada linha tem uma explicação de onde o número vem.

## Reposição

`/reposicao` sugere quanto comprar de cada produto, com base na venda real dos últimos dias (incluindo saída manual e venda de kit explodida nos componentes) e no estoque disponível (local + Full + pedidos de compra já em aberto). "Gerar pedidos" monta rascunhos de pedido de compra agrupados pelo fornecedor principal de cada produto.

## Ajustes

Uma tela só (`/ajustes`) pra conta, loja e marca, impostos e faturamento, prazo padrão de reposição, status das integrações, link pro Financeiro e aparência (tema claro/escuro).

## Celular

O app funciona instalado na tela de início do celular (PWA) — guia completo em **Ajuda → Instalar no celular** (`/ajuda/celular`). Uma vez instalado, a navegação de baixo e o botão "+" flutuante facilitam o uso com uma mão.

## Suporte

Dúvida ou problema que este manual não resolveu: fale com quem administra sua conta do Skubo.
