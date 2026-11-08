# Bling API v3 — o que o Skubo realmente usa

Referência rápida dos endpoints, parâmetros e peculiaridades da API v3 do Bling
que o código deste repositório efetivamente chama. Não é a documentação
completa da API do Bling — é o subconjunto implementado em
`src/services/blingService.ts`, mais os detalhes que já causaram bug aqui
(timezone, JWT, kit/variação). Quando um comportamento abaixo divergir do que
você observar no painel do Bling, o código é a fonte de verdade — abra uma
issue/ajuste este documento.

## Base e autenticação

- Base URL: `https://api.bling.com.br/Api/v3`
- OAuth: `https://www.bling.com.br/Api/v3/oauth` (`authorize` e `token`)
- **Toda chamada autenticada precisa do header `enable-jwt: "1"`** — sem ele o
  Bling devolve um token opaco em vez do JWT esperado, e as chamadas seguintes
  falham de um jeito confuso. Isso já causou um bug real neste projeto; está
  centralizado em `BLING_JWT_HEADER` dentro de `blingService.ts`, não espalhe
  esse header manualmente em chamadas novas.
- Refresh de token usa um lock distribuído (`pg_advisory_xact_lock`,
  `BlingService.refreshWithLock`) para instâncias serverless concorrentes não
  disputarem o refresh ao mesmo tempo.
- Rate limit: 3 req/s por conta (`src/lib/blingRateLimiter.ts`).

## Escopos (o que cada recurso exige)

O Bling não documenta de forma clara qual escopo cobre qual endpoint; o mapa
abaixo (`ESCOPO_POR_RECURSO` em `blingService.ts`) é o que foi necessário
descobrir na prática para dar a mensagem certa quando falta permissão
(`BlingEscopoError`, 403 do Bling):

| Caminho | Escopo necessário no app do Bling |
|---|---|
| `/estoques`, `/depositos` | Estoques e depósitos (leitura) |
| `/produtos/fornecedores` | Produtos — fornecedores (leitura) |
| `/produtos*` | Produtos (leitura) |
| `/contatos*` | Contatos (leitura) |
| `/contas*`, `/categorias*`, `/formas-pagamentos*` | Financeiro — contas a pagar/receber (leitura) |
| `/pedidos*` | Pedidos de venda (leitura) |
| `/empresas*` | Dados básicos da empresa |
| `/nfe*` | Notas fiscais (leitura) — usado pelo "Em nota fiscal" do faturamento |

Logo depois de conectar, o callback testa `/produtos` e `/depositos`
(`BlingService.verificarEscopos`) e a tela de Integrações mostra o que faltou.

## Notas fiscais de saída

`sincronizarNotasFiscais` (`modules/financeiro/canais/erp/bling/notasFiscais.ts`)
lê `GET /nfe?tipo=1&dataEmissaoInicial&dataEmissaoFinal` e, quando a lista
não traz `valorNota`/`numeroPedidoLoja`, busca `GET /nfe/{id}`. Guarda só
notas autorizadas (situação 5, 6 ou 7) e canceladas (2) em
`NotaFiscalVenda`, ligando à venda pelo `numeroPedidoLoja` (= número do
pedido ou do pacote no ML). Roda no cron diário (últimos 3 dias) e pelo botão
"Trazer notas do Bling" no cartão de faturamento.

Quando falta escopo, a mensagem já orienta: Central de extensões → Área do
integrador → app Skubo → Escopos → marcar o escopo → Reconectar em
Integrações. Repetir a chamada sem reconectar não resolve (o token já foi
emitido sem o escopo).

## Endpoints usados

| Método | Endpoint | Para quê | Parâmetros reais |
|---|---|---|---|
| GET | `/produtos` | Listar produtos | `pagina`, `limite` (até 100), `criterio=5` (alterados desde), `tipo=P`, `dataAlteracaoInicial` (opcional, formato `yyyy-MM-dd HH:mm:ss`, **hora de Brasília** — ver abaixo) |
| GET | `/produtos` (busca) | Busca por código/nome | `criterio=2`, `tipo=T`, `codigos[]=<sku exato>` **ou** `nome=<termo>` — a API não filtra por GTIN, isso é feito no código depois de buscar |
| GET | `/produtos/{id}` | Detalhe de um produto | — |
| GET | `/produtos/fornecedores` | Fornecedores de um produto | `idProduto` |
| GET | `/estoques/saldos` | Saldo de estoque por depósito | `pagina`, `limite`, `idsProdutos[]` (repetido, até ~100 por chamada — por isso o sync em lote usa `LOTE_ESTOQUE_BLING = 50`) |
| GET | `/depositos` | Lista de depósitos da conta | — (usado também como teste de escopo/conectividade, ex.: etapa "Conectar o Bling" do onboarding) |
| POST | `/estoques` | Ajustar saldo de um produto | `{ produto: { id }, deposito: { id }, operacao: "B", quantidade, observacoes }` — `operacao: "B"` é "Balanço" (define o saldo absoluto, não soma/subtrai) |
| GET | `/contatos/{id}` | Dados de um contato (fornecedor) | — |
| GET | `/contas/pagar`, `/contas/receber` | Contas financeiras | `pagina`, `limite`, `dataInicialVencimento` |
| GET | `/categorias/receitas-despesas` | Categorias financeiras do Bling | — |
| GET | `/pedidos/vendas` | Pedidos de venda | `pagina`, `limite`, `dataInicial` |
| GET | `/empresas/me/dados-basicos` | ID da empresa (`blingCompanyId`, usado para casar webhook) | — |

## Fuso horário

O Bling interpreta `dataAlteracaoInicial`/`dataInicial` como **hora local de
Brasília**, não UTC — mandar a data em UTC faz o filtro pegar (ou perder)
produtos a mais ou a menos dependendo do horário do dia. Toda data mandada ao
Bling passa por `formatarDataHoraBrasilia` (`src/modules/financeiro/dominio/periodo.ts`),
com 1h de folga pra trás no caso da sincronização incremental de produtos (pra
não perder uma alteração que aconteceu bem na borda da última sincronização).

## Produto: tipo, kit e variação

Os três campos que decidem como um produto do Bling é tratado:

- `situacao`: `"A"` = ativo (`BlingService.isProductActive`).
- `formato`: `"E"` = kit/estrutura (`BlingService.isKit` — os componentes vêm
  no detalhe do produto e são sincronizados por `sincronizarComponentesKitBling`).
  `"V"` = produto pai de variações (as variações vêm no array `variacoes[]` do
  detalhe, cada uma com `id` e `codigo` próprios).
- `codigo`: o SKU. **O produto pai de uma variação (`formato: "V"`) normalmente
  vem sem `codigo`** — quem tem SKU, preço e estoque próprios são as
  variações. `sincronizarProdutoUnico` (`src/services/blingProductSync.ts`)
  trata isso: produto sem código com `variacoes[]` não vazio → importa cada
  variação como um produto próprio (SKU da variação), ignora o pai. Produto
  sem código e sem variações → fica de fora, com aviso (`BlingProdutoIgnorado`).

## GTIN/EAN

O campo `gtin` vem no detalhe do produto do Bling (`BlingProduct.gtin`) e é
gravado no `Produto.ean` na sincronização — mas **a busca da API v3 não
filtra por GTIN** (só `codigos[]` exato ou `nome`), então qualquer
correspondência por EAN no app é feita comparando localmente, nunca mandada
como parâmetro pro Bling.

## Webhook

- `POST /api/bling/webhook`, assinado por `X-Bling-Signature-256` (HMAC-SHA256
  com `BLING_CLIENT_SECRET`), deduplicado por `eventId`. Eventos de Produto,
  Estoque e Produto-Fornecedor.
- Cadastrar no app do Bling: `https://<seu-domínio>/api/bling/webhook`
  (copiável direto na tela Integrações, Fase 5 deste ciclo).
- O evento não carrega `userId`/`contaId` — a conta é resolvida pelo
  `companyId` (`blingCompanyId`, obtido de `/empresas/me/dados-basicos` na
  conexão).

## Fixture mínima de um produto simples (campos realmente lidos pelo código)

```json
{
  "id": 123456789,
  "nome": "Adaptador USB-C",
  "codigo": "ADAPT-USBC",
  "preco": 49.9,
  "precoCusto": 22.5,
  "situacao": "A",
  "formato": "S",
  "gtin": "7891234567890",
  "estoque": { "saldoFisicoTotal": 50, "saldoVirtualTotal": 48 }
}
```

## Fixture mínima de um produto pai de variação (`formato: "V"`)

```json
{
  "id": 111,
  "nome": "Camiseta Básica",
  "codigo": "",
  "formato": "V",
  "situacao": "A",
  "variacoes": [
    { "id": 112, "codigo": "CAMISETA-P", "nome": "Camiseta Básica P" },
    { "id": 113, "codigo": "CAMISETA-M", "nome": "Camiseta Básica M" }
  ]
}
```

## O que não está documentado aqui porque não foi usado ainda

Qualquer endpoint da API v3 do Bling fora da tabela acima (NF-e, logística,
pedidos de compra do próprio Bling etc.) não foi implementado neste projeto —
não assuma comportamento sem checar o código ou a documentação oficial do
Bling antes de integrar algo novo.
