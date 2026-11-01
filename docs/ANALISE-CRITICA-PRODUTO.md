# Análise crítica do Leap Stock — 24/10/2026

Auditoria feita em produção (`estoque-api-4iqj.vercel.app`, conta **LEAPSTORE**, papel ADMIN), no código local e nas APIs. Todo número abaixo foi lido do app ou do Mercado Livre nesta data. O objetivo não é listar bugs soltos: é explicar **por que o app ainda parece beta** e o que separa ele de um produto final.

---

## 1. Veredito

A **base de dados está boa**: as vendas de setembro e outubro batem com o Mercado Livre pedido a pedido (Conferência: 100% de cobertura, 198 pedidos válidos e R$ 7.045,62 em outubro até o dia 24; 103 e R$ 3.366,11 em setembro). A ingestão do Financeiro, o motor de cálculo e a sincronização retomável são sólidos.

O que derruba a confiança está **em cima** dessa base, em três camadas:

1. **Números que se contradizem na mesma tela** (seção 2). O lojista abre o Financeiro e vê margem de 1,5% no topo e 29,1% no bloco "Por logística", para o mesmo mês. Isso sozinho invalida o app aos olhos de quem usa.
2. **Cadastro incompleto sem caminho claro para completar** (seção 3). Metade das vendas não tem custo e o produto mais vendido nem está vinculado — e nenhuma tela conduz o usuário a resolver isso em ordem.
3. **Acabamento de MVP** (seções 4 e 5): valores sobrepostos, toasts transparentes, sidebar que esconde itens, busca do topo que não busca nada, telas que carregam do zero a cada clique, tudo dependente de botões "Atualizar".

---

## 2. Números que não batem (o problema número 1)

### 2.1 A fatura do ML estava sendo contada duas vezes na DRE — **corrigido nesta sessão**
| Outubro (até 24/10) | Valor |
|---|---|
| Faturamento | R$ 7.045,62 |
| Tarifas (do pagamento de cada venda) | R$ 739,48 |
| Frete (do pagamento de cada venda) | R$ 1.859,64 |
| **"Fatura do ML (Full e outras cobranças)"** | **R$ 1.942,36** |
| Margem de contribuição mostrada | **R$ 107,96 (1,5%)** |
| Margem no bloco "Por logística" (mesma tela) | **R$ 2.050,32 (29,1%)** |

A linha "Outras cobranças do ML" vem das linhas da fatura que o app não reconhecia. Na fatura de outubro elas são: `CFFE`/`CFFI` (tarifa de envio, R$ 2.242,67), `CVVML` (custo por vender, R$ 822,99), `CVVPRC` (custo por cobrar no MP, R$ 124,58) e taxas de parcelamento/recebimento (R$ 100,61) — R$ 3.290,85 no total, dos quais R$ 1.942,36 com data entre 1 e 24/10 entraram na DRE. São **exatamente a tarifa e o frete que o pagamento de cada venda já desconta**. Esses sub-tipos não estão na documentação do ML, então o mapeador os classificava como `NAO_MAPEADO` e somava de novo. Diferença: 107,96 + 1.942,36 = 2.050,32 — o número do bloco "Por logística" era o certo.

Corrigido em `mapeadorCobrancas.ts` (famílias `CVV*`, `CFON*`, `CFF*` viram tarifa/frete cobertos pelo pedido) com migração que reclassifica o que já está gravado. Depois do deploy, outubro passa a mostrar ~**R$ 2.050 de margem (29%)** — e ainda vai subir quando os custos que faltam forem preenchidos (2.2).

### 2.2 Metade das vendas sem custo
- **105 de 198 vendas de outubro sem custo** (R$ 3.121,52 de faturamento) e **96 sem produto vinculado**.
- O motivo principal é um só: o **Borrifador Névoa Spray** tem 5 anúncios ativos; **4 deles (107 vendas no mês: 33 + 29 + 24 + 21) não estão vinculados** a nenhum produto. O produto `BORRIFADOR1` existe, mas **sem custo**.
- 26 dos 41 produtos estão sem custo; 36 sem fornecedor; 15 sem preço.
- A tela de vínculo do ML estava **quebrada** (o botão "Vincular" não gravava nada — corrigido na Fase 1 do Ciclo 12, ainda não publicada).

Enquanto isso não for resolvido, **lucro e margem estão subestimados** e o app avisa de forma tímida ("105 venda(s) sem custo…"), sem levar o usuário até a solução.

### 2.3 Comparações enganosas
- Visão geral: "**+453,4%** vs 30d anteriores". Os 30 dias anteriores caem em agosto, mês só parcialmente importado. Comparar com período incompleto produz um número absurdo que tira a credibilidade. (A Fase 1 já troca o padrão para "Mês atual vs mesmo trecho do mês anterior".)
- "Hoje": margem **46,5%** contra 1,5% no mês — porque o dia não leva a fatura (que era contada em dobro). Some com a correção 2.1.
- Dashboard ainda filtra por "30 dias" em produção: é o "cliquei em mês e veio o mês passado". A Fase 1 já corrige (não publicada).

### 2.4 Por que o Mercado Turbo mostra um valor maior
O ML mostra **faturamento de produtos**. O Bling registra o pedido do ML com o **frete do envio somado ao total** do pedido, e o Mercado Turbo lê esse total. Em outubro, o frete gerado nos envios foi R$ 1.859,64 (pago pelo vendedor, já que quase tudo é Full e frete grátis) e o frete pago pelo comprador só R$ 109,91. Por isso: **ML ≈ R$ 7.045 / Mercado Turbo ≈ R$ 8.900**. Nenhum dos dois está errado — são definições diferentes. O app precisa **mostrar as três lado a lado** e deixar o usuário escolher qual é a "oficial" (ver prompt, Fase 3).

### 2.5 Dinheiro retido
"Retido pelo ML para quitar a fatura: R$ 2.452,69" aparece como rodapé. É dinheiro que **não chega no caixa** — precisa de destaque na tela de Caixa, não só uma linha cinza na DRE.

---

## 3. Integrações

### 3.1 Bling — "não sincroniza"
| Etapa | Situação real (24/10, 15:52) | Causa |
|---|---|---|
| Produtos | 46 lidos, **21 com erro** | "Produto Bling … **sem SKU**, ignorado" — produtos sem código no Bling (provavelmente pais de variação) eram tratados como erro e descartados |
| Estoque | **0 de 20**, nunca sincronizou | `insufficient_scope`: **o app do Bling não tem permissão de leitura de Estoques/Depósitos**. Toda chamada a `/depositos` e `/estoques` é recusada |
| Webhooks | **0 recebidos em 24h** | Não estão assinados (ou não chegam) no app do Bling |
| Rotina antiga "produtos_incremental" | Presa em "Em andamento" desde 15:59 | Laço longo dentro de `after()` estoura o tempo da função e nunca marca o fim |

Consequência direta: **valor em estoque R$ 0,00**, reposição sem estoque local, "Onde está o estoque" vazio. Não é o app de estoque que falha — é o Bling que não deixa ler.

Corrigido no código nesta sessão: mensagem clara de escopo (diz qual permissão marcar e onde), produto sem SKU vira **aviso** (não erro) com o nome do produto, pai de variações importa as variações, histórico mostra "Interrompida" em vez de "Em andamento" eterno, e a etapa para no primeiro erro de permissão (antes tentava todos).

**Ação sua no Bling (5 minutos)**: Central de extensões → Área do integrador → app do Leap Stock → Escopos → marcar **Estoques**, **Depósitos**, **Produtos**, **Fornecedores de produtos**, **Contatos** e (se quiser contas a pagar) **Contas a pagar/receber** → salvar → no Leap, Integrações → **Reconectar Bling**. Depois, no Bling, preencher o código (SKU) dos produtos sem código. Webhooks: no mesmo app, assinar `product`, `stock`, `virtual_stock` e `product_supplier` para `https://estoque-api-4iqj.vercel.app/api/bling/webhook`.

### 3.2 Mercado Livre
- Vendas: perfeitas (conferência 100%). Duas vendas no ano com tarifa zerada (R$ 1,65 e R$ 2,36) — detalhe do pagamento sem `charges_details`; aparecem em Conferência.
- **Notificações (webhooks) do ML nunca chegaram** — o app vive de sincronizações agendadas, por isso a sensação de "atrasado". Configurar no app do ML: `orders_v2`, `items`, `shipments`, `payments`, `claims` → `…/api/mercadolivre/webhook`.
- "auto_smart" roda a cada ~15 min com 0 registros e enche o histórico de Integrações de linhas inúteis.

---

## 4. Interface e experiência (o que faz parecer "rústico")

Visto no navegador, desktop e celular (375 px):

| Onde | Problema | Status |
|---|---|---|
| Visão geral → "Margem de contribuição" | `-R$ 179,83` e `(-2.0%)` **sobrepostos** (fonte mono com `leading-none`; no celular quebra em cima da linha de cima) | Corrigido (porcentagem vai para a nota; valor quebra sem sobrepor) |
| Toasts | Fundo com 10% de opacidade: o texto fica **por cima do conteúdo** e parece bug; 8 s na tela; sem botão de fechar | Corrigido (fundo sólido, faixa colorida por tipo, 5 s, fechar) |
| Sidebar | Em tela de 680 px, com Financeiro aberto, **Integrações/Configurações/Usuários somem** e não rolam | Corrigido na Fase 1 (não publicada) |
| Celular | **Toda página abre com o menu cobrindo a tela**; busca do topo empurra os botões para fora | Fase 1 + topo corrigido nesta sessão |
| Busca "⌘K" do topo | **Não faz nada** (input sem ação) | No prompt (paleta de comandos real) |
| "Parte da atualização falhou" | Selo sem explicar o quê nem como resolver | No prompt |
| Números | Fonte mono em tudo, sem hierarquia de cor; positivo/negativo quase iguais | No prompt (design) |
| Tabelas no celular | Tabelas de 6–8 colunas espremidas (rolagem lateral) | No prompt (cartões no celular) |
| App instalável | Não era (sem manifest) | Corrigido: manifest + ícones; dá para "Adicionar à tela de início" |
| Datas e valores | `toFixed(1)` com ponto ("-2.0%") em app pt-BR | No prompt (formatação única) |

### Redundância (o que confunde)
- **Três lugares com faturamento do mês**: Visão geral, Financeiro → Visão geral e Mercado Livre → Vendas (este último com outra fonte, a API do ML ao vivo). Cada um com um número ligeiramente diferente.
- **Quatro telas de configuração** (`/configuracoes` com ~3.000 linhas, `/configuracoes-gerais`, `/mercado-livre/configuracoes`, `/financeiro/configuracoes`).
- **Três rotinas que importam do Bling** (catálogo retomável, importação antiga em `after()`, `estoque-bling`), com botões diferentes em telas diferentes.
- Financeiro com 9 itens de menu; "Lucro por venda" e "Lucro por produto" são a mesma tabela agrupada de outro jeito.

---

## 5. Velocidade ("travado")

As APIs em si respondem bem quando aquecidas (0,2–0,6 s; o resumo do dashboard 1,3 s). A lentidão percebida vem da **arquitetura das telas**:
- As 39 páginas são `"use client"` e buscam tudo em `useEffect` depois de montar: **toda navegação começa vazia**, mostra skeleton, e só então pede os dados. Não há cache entre telas — voltar para uma página refaz tudo.
- Nenhuma rota de API usa cache HTTP; nenhum dado é pré-carregado ao passar o mouse no menu.
- Funções frias na Vercel (primeira chamada de cada rota leva segundos) somadas a várias chamadas em sequência por tela.
- Componentes com `setInterval` (sincronização automática do ML, notificações, status do financeiro) disputando a mesma conexão.
- Bibliotecas pesadas (gráficos, xlsx, jspdf) carregadas junto com as páginas mesmo sem uso.

---

## 6. O que falta para ser produto final (e não MVP)

1. **Confiança nos números**: uma definição por número, explicada na tela; conferência visível ("bate com o ML ✓"); avisos que levam à solução com um clique.
2. **Configuração guiada**: o app sabe o que falta (Bling sem permissão, anúncio sem vínculo, produto sem custo…) mas joga isso em listas soltas. Precisa de uma **jornada de configuração** com progresso, em etapas, que o usuário termina em uma tarde.
3. **Uma tela por assunto**, sem duplicatas.
4. **Acabamento**: design com hierarquia e cor, estados de vazio/erro/carregando decentes, toasts e confirmações consistentes, formatação pt-BR em tudo.
5. **Velocidade percebida**: cache entre telas, navegação instantânea, atualização em segundo plano.
6. **Celular de verdade**: navegação inferior, cartões no lugar de tabelas, ações principais ao alcance do polegar, instalável.
7. **Operação sem babá**: webhooks do ML e do Bling funcionando; o usuário não deveria precisar clicar em "Atualizar" nunca.

O plano de execução está em `PROMPT-CICLO-13-PRODUTO-FINAL.md`.
