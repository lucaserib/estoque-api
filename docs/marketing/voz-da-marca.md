# Voz da marca Skubo

Guia para quem escreve e-mails, campanhas e textos de venda do Skubo — e para a IA que sugere rascunhos no admin.

## Quem lê

Lojistas brasileiros que vendem no Mercado Livre (muitos também na Shopee, na Amazon e em loja própria), de 30 a 1.500+ pedidos por mês. Gente ocupada, que resolve tudo pelo celular, conhece bem o próprio produto e desconfia de promessa fácil. Entendem de Full, reputação, tarifa e frete; não gostam de jargão de software.

## Como o Skubo fala

- **Direto e concreto.** Diga o que a pessoa ganha, com o número quando houver: "veja o que vai acabar antes da próxima compra chegar", não "otimize sua gestão".
- **Português do Brasil, de lojista para lojista.** "Você", frases curtas, verbos no começo. Pode usar termos do mercado (Full, anúncio, reposição, margem, Bling).
- **Calmo e confiável.** O Skubo cuida do dinheiro e do estoque da pessoa: nada de urgência falsa, contagem regressiva ou caixa alta.
- **Um pedido por e-mail.** Uma ação principal, um botão.
- **Curto.** Assunto com até 50 caracteres; pré-cabeçalho com até 90; corpo que cabe na tela do celular.

## Nunca

- Prometer resultado ("aumente suas vendas em 30%"), garantir lucro ou falar de "renda extra".
- Inventar recurso, desconto, prazo ou depoimento.
- Usar CAIXA ALTA, várias exclamações, "GRÁTIS!!!", emojis em excesso (no máximo um, e só se fizer sentido).
- Falar mal de concorrente ou citar marca de concorrente.
- Pedir dados pessoais, senha ou pagamento por e-mail.
- Linguagem de pressão: "última chance", "só hoje", "corra".

## Formato

- O corpo é Markdown simples: parágrafos, **negrito**, listas com "- ", links `[texto](url)` e, se precisar, um botão numa linha sozinha `[[Texto do botão|/caminho]]`.
- Variáveis disponíveis: `{{nome}}`, `{{loja}}`, `{{link_indicacao}}`, `{{dias_teste}}`, `{{saldo_ia}}`, `{{link_planos}}`.
- Termine com a ação, não com uma despedida longa. A assinatura e o rodapé o sistema já coloca.

## Exemplos

Bom assunto: "O Skubo já sabe o que você precisa comprar"
Ruim: "🚀🚀 NOVIDADE IMPERDÍVEL PARA SUA LOJA!!!"

Bom corpo:

> Olá, {{nome}}! Com as vendas sincronizadas, a Reposição já calcula o que vai acabar e quanto comprar de cada produto, contando o estoque local, o Full e os pedidos em aberto. Dá uma olhada: costuma aparecer pelo menos um produto que você ia deixar faltar.

Ruim:

> Revolucione a gestão do seu e-commerce com a plataforma mais completa do mercado e multiplique seus resultados!
