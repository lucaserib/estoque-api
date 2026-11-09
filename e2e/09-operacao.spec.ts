import { test, expect, type Page } from "@playwright/test";
import { login } from "./helpers";

const projeto = () => test.info().project.name;
const celular = () => (test.info().project.use.viewport?.width ?? 1440) < 640;

async function semRolagemHorizontal(page: Page) {
  const largura = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(largura).toBeLessThanOrEqual((test.info().project.use.viewport?.width ?? 1440) + 2);
}

function abrirCartao(titulo: string) {
  return { name: new RegExp(`^#\\d+.*${titulo}`) };
}

function cartao(page: Page, titulo: string) {
  return page.getByTestId("cartao-tarefa").filter({ hasText: titulo });
}

test("Meu dia: captura rápida entende prazo, etiqueta e prioridade", async ({ page }) => {
  const titulo = `Conferir notas fiscais ${projeto()}`;
  await login(page);
  await page.goto("/operacao");
  await expect(page.getByRole("link", { name: "Meu dia" })).toHaveAttribute("aria-current", "page");
  const campo = page.getByRole("textbox", { name: "Nova tarefa" });
  await campo.fill(`${titulo} amanhã #fiscal !alta`);
  await expect(page.getByTestId("captura-rapida")).toContainText("Fiscal");
  await expect(page.getByTestId("captura-rapida")).toContainText("Alta");
  await page.getByRole("button", { name: "Criar tarefa" }).click();
  await expect(page.getByText(/Tarefa #\d+ criada/)).toBeVisible();
  const secao = page.getByRole("region", { name: "Próximos 7 dias" });
  await expect(secao.getByTestId("cartao-tarefa").filter({ hasText: titulo })).toBeVisible();
  await expect(secao.getByText("Amanhã").first()).toBeVisible();
  await semRolagemHorizontal(page);
});

test("quadro: adicionar na coluna, arrastar e concluir pelo menu", async ({ page }) => {
  test.skip(projeto() !== "desktop-1440x900", "Arrastar com mouse no desktop");
  const titulo = "Separar pedido do atacado";
  await login(page);
  await page.goto("/operacao/quadros");
  await page.waitForURL(/\/operacao\/quadros\/[\w-]+/);
  const aFazer = page.getByRole("region", { name: "Coluna A fazer" });
  await aFazer.getByRole("button", { name: "Adicionar tarefa" }).click();
  await aFazer.getByRole("textbox", { name: "Nova tarefa" }).fill(titulo);
  await aFazer.getByRole("button", { name: "Criar tarefa" }).click();
  await expect(cartao(page, titulo)).toBeVisible();

  const origem = await cartao(page, titulo).boundingBox();
  const destino = await page.getByRole("region", { name: "Coluna Fazendo" }).boundingBox();
  if (!origem || !destino) throw new Error("Sem posição para arrastar");
  await page.mouse.move(origem.x + origem.width / 2, origem.y + 20);
  await page.mouse.down();
  await page.mouse.move(origem.x + origem.width / 2 + 12, origem.y + 24, { steps: 4 });
  await page.mouse.move(destino.x + destino.width / 2, destino.y + 80, { steps: 18 });
  await page.mouse.up();
  await expect(page.getByRole("region", { name: "Coluna Fazendo" }).getByTestId("cartao-tarefa").filter({ hasText: titulo })).toBeVisible();

  await page.getByRole("button", { name: `Mover ${titulo}` }).click();
  await page.getByRole("menuitem", { name: "Feito" }).click();
  const feito = page.getByRole("region", { name: "Coluna Feito" });
  await expect(feito.getByTestId("cartao-tarefa").filter({ hasText: titulo })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: "Coluna Feito" }).getByTestId("cartao-tarefa").filter({ hasText: titulo })).toBeVisible();
});

test("detalhe: checklist, comentário, prazo e concluir", async ({ page }) => {
  test.skip(projeto() !== "desktop-1366x680", "Um viewport desktop basta");
  const titulo = "Negociar frete com a transportadora";
  await login(page);
  await page.goto("/operacao?nova=1");
  await page.getByRole("textbox", { name: "Título da tarefa" }).fill(titulo);
  await page.getByTestId("criar-tarefa").click();
  await expect(page.getByText(/Tarefa #\d+ criada/)).toBeVisible();

  await page.goto("/operacao/lista");
  await page.getByRole("button", abrirCartao(titulo)).first().click();
  const detalhe = page.getByTestId("detalhe-tarefa");
  await expect(detalhe).toBeVisible();
  await detalhe.getByRole("textbox", { name: "Novo item do checklist" }).fill("Pedir 3 cotações");
  await detalhe.getByRole("button", { name: "Adicionar item" }).click();
  await detalhe.getByRole("checkbox", { name: "Pedir 3 cotações" }).check();
  await expect(detalhe.getByText("1/1")).toBeVisible();

  await detalhe.getByRole("textbox", { name: "Enviar comentário" }).fill("Cotação da Jadlog chega amanhã");
  await detalhe.getByRole("button", { name: "Enviar comentário" }).click();
  await expect(detalhe.getByText("Cotação da Jadlog chega amanhã")).toBeVisible();

  await detalhe.getByLabel("Prioridade").selectOption("URGENTE");
  await detalhe.getByLabel("Data do prazo").fill("2030-01-15");
  await expect(detalhe.getByText(/15\/01\/2030/).first()).toBeVisible();

  await page.getByTestId("botao-concluir").click();
  await expect(page.getByTestId("botao-concluir")).toHaveText(/Reabrir/);
  await detalhe.getByText("Histórico").click();
  await expect(detalhe.getByText("concluiu")).toBeVisible();
});

test("celular: menu Tarefas, nova tarefa em tela cheia, concluir e mover pelo menu", async ({ page }) => {
  test.skip(!celular(), "Fluxo do celular");
  const titulo = "Responder perguntas do ML";
  await login(page);
  await page.getByRole("link", { name: "Tarefas", exact: true }).click();
  await page.waitForURL(/\/operacao$/);
  await semRolagemHorizontal(page);

  await page.getByRole("button", { name: "Nova tarefa", exact: true }).last().click();
  await page.getByRole("textbox", { name: "Título da tarefa" }).fill(`${titulo} hoje`);
  await page.getByTestId("criar-tarefa").click();
  await expect(page.getByText(/Tarefa #\d+ criada/)).toBeVisible();

  const hoje = page.getByRole("region", { name: "Para hoje" });
  await hoje.getByRole("button", abrirCartao(titulo)).click();
  const concluir = page.getByTestId("botao-concluir");
  await expect(concluir).toBeInViewport();
  await concluir.click();
  await expect(concluir).toHaveText(/Reabrir/);
  await concluir.click();
  await expect(concluir).toHaveText(/Concluir/);
  await page.getByRole("button", { name: "Voltar" }).click();
  await expect(page.getByTestId("detalhe-tarefa")).toHaveCount(0);

  await page.getByRole("link", { name: "Quadros" }).click();
  await page.waitForURL(/\/operacao\/quadros\/[\w-]+/);
  await expect(page.getByRole("navigation", { name: "Colunas do quadro" })).toBeVisible();
  await page.getByRole("button", { name: `Mover ${titulo}` }).click();
  await page.getByRole("menuitem", { name: "Fazendo" }).click();
  await expect(page.getByRole("region", { name: "Coluna Fazendo" }).getByTestId("cartao-tarefa").filter({ hasText: titulo })).toHaveCount(1);
  await semRolagemHorizontal(page);

  await page.getByRole("link", { name: "Ideias e notas" }).click();
  await page.getByRole("button", { name: "Nova ideia ou nota" }).click();
  await page.getByRole("textbox", { name: "Conteúdo" }).fill("Kit com 2 unidades do borrifador");
  await page.getByTestId("salvar-nota").click();
  await expect(page.getByTestId("nota").filter({ hasText: "Kit com 2 unidades" })).toBeVisible();
  await semRolagemHorizontal(page);
});

test("ideias: apoiar e virar tarefa", async ({ page }) => {
  test.skip(projeto() !== "desktop-1440x900", "Um viewport basta");
  await login(page);
  await page.goto("/operacao/ideias");
  await page.getByTestId("nova-ideia").click();
  await page.getByRole("textbox", { name: "Título", exact: true }).fill("Vender na Shopee");
  await page.getByRole("textbox", { name: "Conteúdo" }).fill("Testar os 10 mais vendidos na Shopee em dezembro");
  await page.getByTestId("salvar-nota").click();
  const nota = page.getByTestId("nota").filter({ hasText: "Vender na Shopee" });
  await expect(nota).toBeVisible();
  await nota.getByRole("button", { name: "Apoiar ideia" }).click();
  await expect(nota.getByRole("button", { name: "Tirar apoio" })).toContainText("1");

  await nota.getByRole("button", { name: "Ações da nota" }).click();
  await page.getByRole("menuitem", { name: "Virar tarefa" }).click();
  await expect(page.getByRole("textbox", { name: "Título da tarefa" })).toHaveValue("Vender na Shopee");
  await page.getByTestId("criar-tarefa").click();
  await expect(nota.getByText(/Virou a tarefa #\d+/)).toBeVisible();
});

test("integrações: criar tarefa pela Central de controle sem duplicar e rotinas sugeridas", async ({ page }) => {
  test.skip(projeto() !== "desktop-1440x900", "Um viewport basta");
  await login(page);
  await page.goto("/controle");
  const botao = page.getByRole("button", { name: "Criar tarefa" }).first();
  await botao.click();
  await expect(page.getByTestId("nova-tarefa")).toContainText("Ligada a");
  await page.getByTestId("criar-tarefa").click();
  await expect(page.getByText(/Tarefa #\d+ criada/)).toBeVisible();
  await expect(page.getByTestId("nova-tarefa")).toHaveCount(0);
  await botao.click();
  await expect(page.getByTestId("nova-tarefa")).toContainText("Ligada a");
  await page.getByTestId("criar-tarefa").click();
  await expect(page.getByText(/Já existe uma tarefa aberta para isso/)).toBeVisible();

  await page.goto("/operacao");
  await page.getByRole("button", { name: "Ver rotinas sugeridas" }).click();
  await page.getByTestId("criar-rotinas").click();
  await expect(page.getByText(/rotinas? criadas?/)).toBeVisible();
  await page.goto("/operacao/lista?situacao=todas");
  await expect(page.getByText("Enviar reposição para o Full").first()).toBeVisible();

  await page.goto("/");
  await expect(page.getByTestId("cartao-minhas-tarefas")).toBeVisible();
});
