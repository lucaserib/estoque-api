import { test, expect, type Page } from "@playwright/test";
import { login } from "./helpers";

const ACESSO_SEM_IA = {
  configurada: true,
  desligada: false,
  liberada: false,
  origem: null,
  status: "INATIVA",
  testeAteEm: null,
  testeDisponivel: true,
  periodoFim: null,
  consumo: {
    base: "MENSAGENS",
    custoCentavos: null,
    mensagens: 0,
    orcamentoCentavos: 1000,
    limiteMensagens: 300,
    percentual: 0,
    esgotado: false,
    desde: new Date().toISOString(),
    renovaEm: new Date(Date.now() + 86_400_000).toISOString(),
  },
  adminPlataforma: false,
  podeAssinar: true,
  pagamentoConfigurado: false,
  precoMensal: 29.9,
};

async function abrirAssistente(page: Page) {
  await page.getByRole("button", { name: /Abrir Skubo IA/ }).click();
  const painel = page.getByRole("dialog", { name: "Skubo IA" });
  await expect(painel).toBeVisible();
  return painel;
}

test.beforeEach(async ({ page }) => {
  await login(page);
});

test("assistente: sugestão, ferramenta, resposta, 👍, histórico e apagar", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440x900", "Um viewport desktop basta para o fluxo completo");

  const painel = await abrirAssistente(page);
  const sugestoes = painel.getByRole("group", { name: "Sugestões de pergunta" }).getByRole("button");
  await expect(sugestoes).toHaveCount(4);
  await sugestoes.first().click();

  const resposta = painel.getByTestId("mensagem-assistente").last();
  await expect(resposta.getByTestId("chip-ferramenta").first()).toBeVisible();
  await expect(resposta).toContainText("Resposta de teste do Skubo IA");
  await expect(resposta.getByTestId("chip-ferramenta").first()).toHaveAttribute("data-estado", "fim");
  await expect(resposta.getByRole("link", { name: "Central de controle" })).toHaveAttribute("href", "/controle");

  const util = resposta.getByRole("button", { name: "Resposta útil" });
  await util.click();
  await expect(util).toHaveAttribute("aria-pressed", "true");

  await painel.getByRole("button", { name: "Histórico de conversas" }).click();
  const historico = painel.getByRole("region", { name: "Conversas anteriores" });
  await expect(historico.getByRole("listitem").first()).toBeVisible();
  const antes = await historico.getByRole("listitem").count();

  await historico.getByRole("button", { name: "Apagar conversa" }).first().click();
  await historico.getByRole("button", { name: "Confirmar: apagar conversa" }).click();
  await expect(page.getByText("Conversa apagada.")).toBeVisible();
  await expect(historico.getByRole("listitem")).toHaveCount(antes - 1);
});

test("assistente no celular abre em tela cheia com campo e botões acessíveis", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390x844", "Fluxo específico do celular");

  const painel = await abrirAssistente(page);
  const caixa = await painel.boundingBox();
  expect(caixa?.width).toBeGreaterThanOrEqual(388);
  expect(caixa?.height).toBeGreaterThanOrEqual(800);

  const campo = painel.getByRole("textbox", { name: "Pergunta para o Skubo IA" });
  await expect(campo).toBeVisible();
  await campo.fill("Quanto vendi este mês?");
  const enviar = painel.getByRole("button", { name: "Enviar pergunta" });
  await expect(enviar).toBeEnabled();
  await enviar.click();
  await expect(painel.getByTestId("mensagem-assistente").last()).toContainText("Resposta de teste do Skubo IA");

  await expect(painel.getByRole("button", { name: "Fechar assistente" })).toBeVisible();
  await painel.getByRole("button", { name: "Fechar assistente" }).click();
  await expect(painel).toBeHidden();
});

test("conta sem acesso à IA vê o cartão de venda do módulo", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1366x680", "Um viewport basta");
  await page.route("**/api/ia/acesso", (rota) => rota.fulfill({ json: ACESSO_SEM_IA }));
  await page.goto("/controle");

  const painel = await abrirAssistente(page);
  await expect(painel.getByRole("button", { name: "Testar grátis por 7 dias" })).toBeVisible();
  await expect(painel.getByRole("button", { name: /Assinar por R\$\s?29,90\/mês/ })).toBeVisible();
  await expect(painel.getByRole("textbox", { name: "Pergunta para o Skubo IA" })).toHaveCount(0);
});

test("Reposição: 'Por que essa sugestão?' mostra a explicação", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440x900", "Tabela completa só no desktop");
  const lista = await (await page.request.get("/api/produtos/lista?q=E2E-SKU-1&porPagina=20")).json();
  const produto = lista.itens.find((p: { sku: string }) => p.sku === "E2E-SKU-1");
  expect(produto).toBeTruthy();
  await page.route("**/api/replenishment/batch-analysis", (rota) =>
    rota.fulfill({
      json: {
        success: true,
        parcial: false,
        summary: { total: 1, critico: 1, atencao: 0, ok: 0, custoTotalCritico: 0, custoTotalAtencao: 0, custoTotalGeral: 0 },
        results: [
          {
            produtoId: produto.id,
            produtoNome: produto.nome,
            sku: produto.sku,
            custoMedio: 0,
            tipoAnuncio: "local",
            estoqueLocal: 2,
            estoqueFull: 0,
            estoqueFullDisponivel: 0,
            estoqueFullEmTransito: 0,
            estoqueFullIndisponivel: 0,
            estoqueTotal: 2,
            mediaVendasPeriodo: 90,
            mediaDiaria: 1,
            analysisPeriodDays: 90,
            statusGeral: "critico",
            dataRupturaPrevista: null,
            reposicaoFull: null,
            reposicaoLocal: { necessaria: true, quantidadeSugerida: 20, diasRestantes: 2, status: "critico", custoTotal: 0 },
            custoTotalReposicao: 0,
            custoIndefinido: false,
          },
        ],
      },
    })
  );
  await page.goto("/reposicao");

  const botao = page.getByRole("button", { name: "Por que essa sugestão?" }).first();
  await expect(botao).toBeVisible({ timeout: 20_000 });
  await botao.click();
  await expect(page.getByTestId("explicacao-ia")).toContainText("Explicação de teste");
});

test("Central de controle: 'Perguntar sobre isto' abre o assistente com a pergunta", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1366x680", "Um viewport basta");
  await page.goto("/controle");

  const perguntar = page.getByRole("button", { name: "Perguntar sobre isto" }).first();
  await expect(perguntar).toBeVisible({ timeout: 20_000 });
  await perguntar.click();

  const painel = page.getByRole("dialog", { name: "Skubo IA" });
  await expect(painel.getByText("na Central de controle: o que está acontecendo", { exact: false })).toBeVisible();
  await expect(painel.getByTestId("mensagem-assistente").last()).toContainText("Resposta de teste do Skubo IA");
});
