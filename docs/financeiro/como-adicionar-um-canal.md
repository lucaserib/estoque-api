# Como adicionar um canal de venda ao módulo Financeiro

Guia de referência do Ciclo 7. O domínio financeiro (fórmulas, DRE, lucro por venda/produto, fluxo de caixa) nunca conhece Mercado Livre, Shopee ou qualquer API específica — ele só lê os tipos `*Normalizada` de `src/modules/financeiro/canais/tipos.ts`. Adicionar um canal novo é implementar um adaptador que traduz a API do canal para esses tipos; nada na ingestão, no domínio ou nas telas precisa mudar.

Este guia usa a **Shopee** como exemplo de ponta a ponta — o enum `CanalVenda` já tem `SHOPEE` (junto com `AMAZON`, `MAGALU`, `LOJA_PROPRIA`, `ERP`, `OUTRO`), então não é preciso migração nenhuma só para registrar o canal; a migração só seria necessária para um canal fora dessa lista.

## 1. O contrato: `AdaptadorCanalFinanceiro`

Definido em `src/modules/financeiro/canais/tipos.ts`:

```ts
export interface AdaptadorCanalFinanceiro {
  canal: CanalVenda;
  listarPedidosAlterados(conta: ContaCanal, desde: Date, ate: Date, cursor?: string | null): Promise<PaginaPedidos>;
  obterPedido(conta: ContaCanal, pedidoExternoId: string): Promise<VendaCanalNormalizada | null>;
  obterCustoEnvio?(conta: ContaCanal, envioId: string): Promise<CustoEnvioNormalizado>;
  listarGastosAds?(conta: ContaCanal, dia: Date): Promise<GastoAdsNormalizado[]>;
  listarCobrancas?(conta: ContaCanal, mesReferencia: string): Promise<CobrancaNormalizada[]>;
  listarLiberacoes?(conta: ContaCanal, desde: Date, ate: Date): Promise<LiberacaoNormalizada[]>;
}
```

Dois métodos são obrigatórios; os outros quatro são opcionais (capacidades que nem todo canal tem):

- **`listarPedidosAlterados`** (obrigatório): paginação por cursor — devolve só `{pedidoExternoId, atualizadoNoCanalEm}`, usado pelo cron diário (reprocessamento) e pelo backfill de histórico. Quem decide o que fazer com cada pedido é a camada de ingestão, não o adaptador.
- **`obterPedido`** (obrigatório): busca um pedido específico e devolve `VendaCanalNormalizada` já traduzida. Devolver `null` significa "pedido não existe mais nesse canal" (não é erro).
- **`obterCustoEnvio`** (opcional): nem todo canal separa o custo do frete do próprio pedido. Ausente = a ingestão usa `freteComprador` do pedido e marca a confiança como `ESTIMADO`.
- **`listarGastosAds`** (opcional): canais sem anúncio patrocinado próprio simplesmente não implementam.
- **`listarCobrancas`** (opcional): fatura mensal consolidada (armazenagem, tarifas não cobertas pelo pedido). Sem isso, a DRE mostra `outrasTarifasNaoMapeadas` sempre zero para esse canal — não é estimado, é zero de verdade porque não há outra fonte.
- **`listarLiberacoes`** (opcional): conferência manual de quando o dinheiro cai na conta — nunca alimenta a DRE, só a tela de configurações.

**Regra de ouro**: capacidade ausente (`undefined`) é diferente de valor zero. Se o canal não informa um dado, a ingestão deixa o campo `null` (ou usa `Confianca.ESTIMADO`) — a tela mostra "—" com o motivo, nunca inventa um zero.

## 2. Passo a passo (exemplo: Shopee)

### 2.1 Pasta do adaptador

```
src/modules/financeiro/canais/shopee/
  cliente.ts          — HTTP client + export do AdaptadorCanalFinanceiro
  mapeador.ts          — funções puras: resposta bruta da Shopee → tipos normalizados
  mapeadorAds.ts        — se a Shopee tiver ads próprio (opcional)
  mapeadorCobrancas.ts   — se a Shopee tiver fatura mensal (opcional)
  __tests__/
    mapeador.test.ts
```

Mesmo layout de `canais/mercadoLivre/` — mantenha, não invente uma estrutura nova.

### 2.2 Mapeador (funções puras, sem I/O)

`mapeador.ts` recebe o formato bruto da API da Shopee (tipado localmente, sem reaproveitar nada do ML) e devolve `VendaCanalNormalizada`. Ponto crítico, igual ao que o mapeador do ML já resolve:

- **Status**: a Shopee tem o próprio vocabulário de status de pedido — mapeie para `StatusVendaCanal` (`PAGA`/`CANCELADA`/`DEVOLVIDA`/`DEVOLVIDA_PARCIAL`/`EM_MEDIACAO`). Regime de competência: um pedido cancelado **antes** de qualquer pagamento aprovado não deveria nem ser ingerido (devolva `null` em `obterPedido`) — só entra quando o dinheiro chegou a existir financeiramente, mesmo que depois tenha sido desfeito.
- **Itens**: `tarifaTotal` em `ItemVendaCanalNormalizado` já é o total da linha (quantidade aplicada), nunca por unidade — confira se a API da Shopee devolve a tarifa por unidade ou por linha antes de preencher esse campo (foi exatamente o tipo de ambiguidade registrada como pendência para o ML em `docs/financeiro/fontes-mercado-livre.md`).
- **Pacote/carrinho**: se a Shopee tiver o conceito de carrinho com múltiplos pedidos saindo juntos (frete único), preencha `pacoteExternoId` igual nos pedidos do mesmo carrinho — a camada de ingestão (`ingestao/sincronizador.ts`) já sabe ratear o frete entre eles, não precisa reimplementar isso no adaptador.
- **Dinheiro**: tudo em centavos, inteiro. Nunca float.

Todo mapeador precisa de testes de fixture cobrindo pelo menos estes cenários (mesmos exigidos do mapeador do ML):

1. Pedido pago simples.
2. Pedido cancelado (com e sem pagamento aprovado antes do cancelamento).
3. Pedido devolvido (se a Shopee distinguir cancelamento de devolução).
4. Pedido dentro de um pacote/carrinho com outros.
5. Qualquer modalidade de fulfillment própria da Shopee (equivalente ao Full do ML), se existir.

Veja `src/modules/financeiro/canais/mercadoLivre/__tests__/mapeador.test.ts` como referência de como estruturar cada `describe`.

### 2.3 Cliente HTTP

`cliente.ts` cuida de autenticação (token da conta Shopee conectada), paginação e rate limit — e no final exporta o objeto que implementa a interface:

```ts
export const adaptadorShopee: AdaptadorCanalFinanceiro = {
  canal: CanalVenda.SHOPEE,
  listarPedidosAlterados: async (conta, desde, ate, cursor) => { /* ... */ },
  obterPedido: async (conta, pedidoExternoId) => { /* ... */ },
  // obterCustoEnvio, listarGastosAds, listarCobrancas, listarLiberacoes — só se a Shopee suportar
};
```

`ContaCanal.contaCanalId` é o id da conta Shopee conectada (equivalente a `MercadoLivreAccount.id`) — resolva token/credenciais a partir dele, igual o `MercadoLivreService.getValidToken` já faz para o ML.

### 2.4 Registro

Em `src/modules/financeiro/canais/registro.ts`, adicione uma linha:

```ts
export const ADAPTADORES_POR_CANAL: Partial<Record<CanalVenda, AdaptadorCanalFinanceiro>> = {
  [CanalVenda.MERCADO_LIVRE]: adaptadorMercadoLivre,
  [CanalVenda.SHOPEE]: adaptadorShopee,
};
```

A partir daqui, `obterAdaptador(CanalVenda.SHOPEE)` funciona em qualquer lugar da ingestão, do cron e dos relatórios — **nada mais precisa mudar** nessas camadas. DRE, lucro por venda/produto, fluxo de caixa, conciliação já filtram por `canal` genericamente.

## 3. O que fica de fora desta extensão (decisão deliberada)

- **Cron**: o cron único `financeiro-diario` hoje itera só `MercadoLivreAccount` (`prisma.mercadoLivreAccount.findMany`). Adicionar Shopee ao cron automático exige um pequeno ajuste ali (iterar a tabela de contas Shopee também) — não é parte do contrato do adaptador, é responsabilidade de quem liga o canal novo ao agendamento.
- **Webhook em tempo real**: o ML tem um webhook dedicado (`processOrderWebhookFinanceiro` em `mercadoLivreService.ts`) chamando a ingestão na hora. Um canal novo sem webhook próprio ainda funciona — só depende do reprocessamento do cron (atraso de até 1 dia) em vez de tempo real.
- **UI**: nenhuma tela precisa saber que a Shopee existe. Os filtros de canal nas telas do financeiro (`SeletorPeriodo` não filtra canal; DRE/fluxo de caixa aceitam `canal?: CanalVenda` opcional) já aceitam qualquer valor do enum sem código novo.
