import fs from "node:fs";
import path from "node:path";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { E2E_EMAIL, E2E_SENHA, login } from "./helpers";

const ARQUIVO_EMAILS = process.env.EMAIL_CONSOLE_ARQUIVO ?? path.resolve("playwright/.cache/emails-e2e.jsonl");
const SENHA = "senha-e2e-123";

interface EmailRegistrado {
  para: string;
  assunto: string;
  texto: string;
}

function emailsPara(destinatario: string): EmailRegistrado[] {
  if (!fs.existsSync(ARQUIVO_EMAILS)) return [];
  return fs
    .readFileSync(ARQUIVO_EMAILS, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((linha) => JSON.parse(linha) as EmailRegistrado)
    .filter((email) => email.para === destinatario.toLowerCase());
}

async function linkDoEmail(destinatario: string, padrao: RegExp): Promise<string> {
  await expect.poll(() => emailsPara(destinatario).some((e) => padrao.test(e.texto)), { timeout: 15_000 }).toBe(true);
  const email = emailsPara(destinatario).reverse().find((e) => padrao.test(e.texto))!;
  return email.texto.match(padrao)![0];
}

async function entrarComo(page: Page, email: string, senha: string, destino: RegExp = /\/(dashboard|comecar)?$/) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(senha);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(destino, { timeout: 20_000 });
}

async function novaPagina(browser: Browser) {
  const contexto = await browser.newContext({ baseURL: test.info().project.use.baseURL, viewport: test.info().project.use.viewport });
  return contexto.newPage();
}

function unico(prefixo: string) {
  return `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@e2e.test`;
}

const celular = () => (test.info().project.use.viewport?.width ?? 1440) < 640;

test("cadastro completo com UTM e código de indicação; o indicador vê a indicação", async ({ page, browser }) => {
  const email = unico("novo");
  await page.goto("/planos?utm_source=instagram&utm_campaign=lancamento&ref=SKU-E2E1");
  await page.getByRole("dialog", { name: "Aviso de cookies" }).getByRole("button", { name: "Só essenciais" }).click();
  await expect(page.getByRole("dialog", { name: "Aviso de cookies" })).toHaveCount(0);
  await expect(page.getByTestId("banner-convite")).toContainText("convidou você");
  await page.getByRole("link", { name: /Comece grátis/ }).first().click();
  await expect(page).toHaveURL(/\/register\?.*ref=SKU-E2E1/);
  await expect(page.getByTestId("banner-convite")).toContainText("perguntas extras");

  await page.locator("#email").fill(email);
  await page.locator("#name").fill("Novo Cliente");
  await page.locator("#password").fill(SENHA);
  await page.locator("#whatsapp").fill("(11) 98888-7777");
  if (celular()) {
    await expect(page.locator("#nomeLoja")).toBeHidden();
    await page.getByRole("button", { name: "Continuar" }).click();
  }
  await expect(page.locator("#codigoIndicacao")).toHaveValue("SKU-E2E1");
  await page.locator("#nomeLoja").fill("Loja do Novo");
  await page.locator("#faixaPedidosMes").selectOption("DE_31_A_200");
  await page.getByRole("button", { name: "Mercado Livre", exact: true }).click();
  await page.locator("#comoConheceu").selectOption("INSTAGRAM");
  await page.getByRole("checkbox", { name: /Li e aceito/ }).check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.waitForURL(/\/comecar/, { timeout: 20_000 });

  await expect.poll(() => emailsPara(email).length).toBeGreaterThan(0);

  const indicador = await novaPagina(browser);
  await entrarComo(indicador, E2E_EMAIL, E2E_SENHA);
  await indicador.goto("/indique");
  await expect(indicador.getByTestId("link-indicacao")).toContainText("/r/SKU-E2E1");
  await expect(indicador.getByText("No** Cl***").first()).toBeVisible();
  await indicador.context().close();
});

test("quem esqueceu o código no cadastro informa depois em /indique", async ({ page, request }) => {
  test.skip(test.info().project.name !== "desktop-1366x680", "Um viewport basta");
  const email = unico("tardio");
  const cadastro = await request.post("/api/register", {
    data: { email, name: "Loja Tardia", password: SENHA, aceitouTermos: true, nomeLoja: "Loja Tardia", faixaPedidosMes: "ATE_30" },
  });
  expect(cadastro.ok()).toBe(true);
  await entrarComo(page, email, SENHA);
  await page.goto("/indique");
  const pular = page.getByRole("button", { name: "Pular" });
  await pular.waitFor({ state: "visible", timeout: 5_000 }).then(() => pular.click()).catch(() => undefined);
  const cartao = page.getByTestId("informar-codigo");
  await cartao.getByRole("textbox", { name: "Código de indicação" }).fill("SKU-NAOEXISTE");
  await cartao.getByRole("button", { name: "Usar código" }).click();
  await expect(page.getByText("Código não encontrado. Confira com quem indicou.")).toBeVisible();
  await cartao.getByRole("textbox", { name: "Código de indicação" }).fill("SKU-E2E1");
  await cartao.getByRole("button", { name: "Usar código" }).click();
  await expect(page.getByText(/Você ganhou 5 perguntas extras/)).toBeVisible();
  await expect(page.getByTestId("informar-codigo")).toHaveCount(0);
});

test("convite por e-mail, aceite e remoção do membro", async ({ page, browser }) => {
  test.skip(test.info().project.name !== "desktop-1440x900", "Um viewport basta para o fluxo de equipe");
  const convidado = unico("membro");
  await login(page);
  await page.goto("/usuarios");
  await page.getByRole("button", { name: "Convidar usuário" }).click();
  await page.locator("#convite-email").fill(convidado);
  await page.getByRole("button", { name: "Gerar convite" }).click();
  await expect(page.getByText(/Mandamos o convite por e-mail/)).toBeVisible();

  const link = await linkDoEmail(convidado, /https?:\/\/[^\s)]+\/register\?invite=[a-f0-9]+/);
  const membro = await novaPagina(browser);
  await membro.goto(link.replace(/^https?:\/\/[^/]+/, ""));
  await expect(membro.locator("#email")).toHaveValue(convidado);
  await membro.locator("#name").fill("Membro Convidado");
  await membro.locator("#password").fill(SENHA);
  await membro.getByRole("checkbox", { name: /Li e aceito/ }).check();
  await membro.getByRole("button", { name: "Criar conta" }).click();
  await membro.waitForURL(/\/(dashboard)?$/, { timeout: 20_000 });
  await membro.context().close();

  await page.goto("/usuarios");
  page.once("dialog", (dialogo) => dialogo.accept());
  await page.getByRole("button", { name: `Remover ${convidado} da equipe` }).click();
  await expect(page.getByText("Pessoa removida da equipe")).toBeVisible();
  await expect(page.getByText(convidado)).toHaveCount(0);
});

test("esqueci a senha, redefini e entrei com a nova", async ({ page, request }) => {
  test.skip(test.info().project.name !== "desktop-1366x680", "Um viewport basta");
  const email = unico("senha");
  const cadastro = await request.post("/api/register", {
    data: { email, name: "Pessoa Senha", password: SENHA, aceitouTermos: true, nomeLoja: "Loja Senha", faixaPedidosMes: "ATE_30" },
  });
  expect(cadastro.ok()).toBe(true);

  await page.goto("/esqueci-senha");
  await page.locator("#email").fill(email);
  await page.getByRole("button", { name: "Enviar link" }).click();
  await expect(page.getByRole("status")).toContainText("Se houver uma conta");

  const link = await linkDoEmail(email, /https?:\/\/[^\s)]+\/redefinir-senha\?token=[\w%-]+/);
  await page.goto(link.replace(/^https?:\/\/[^/]+/, ""));
  await page.locator("#senha").fill("nova-senha-456");
  await page.locator("#confirmacao").fill("nova-senha-456");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page.getByRole("status")).toContainText("Senha alterada");

  await page.goto(link.replace(/^https?:\/\/[^/]+/, ""));
  await page.locator("#senha").fill("outra-senha-789");
  await page.locator("#confirmacao").fill("outra-senha-789");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /já foi usado/ })).toBeVisible();

  await entrarComo(page, email, "nova-senha-456");
});

test("teste vencido: dono vê os planos, membro vê o aviso e a API responde 402", async ({ browser }) => {
  test.skip(test.info().project.name !== "desktop-1440x900", "Um viewport basta");
  const dono = await novaPagina(browser);
  await entrarComo(dono, "e2e-vencida@skubo.test", E2E_SENHA, /\/assinatura/);
  await expect(dono.getByText(/Seu teste grátis terminou/)).toBeVisible();
  await expect(dono.getByRole("button", { name: "Assinar mensal" })).toBeVisible();
  await dono.context().close();

  const membro = await novaPagina(browser);
  await entrarComo(membro, "e2e-membro-vencida@skubo.test", E2E_SENHA, /\/assinatura/);
  await expect(membro.getByText(/Só Dona Vencida pode renovar/)).toBeVisible();
  const api = await membro.request.get("/api/produtos/lista");
  expect(api.status()).toBe(402);
  expect(await api.json()).toMatchObject({ codigo: "ASSINATURA_INATIVA" });
  await membro.getByRole("button", { name: "Avisar o responsável" }).click();
  await expect(membro.getByText("Avisamos o responsável pela assinatura.")).toBeVisible();
  await membro.context().close();
});

test("assistente sem perguntas mostra os pacotes e a compra aprovada credita 25", async ({ browser }) => {
  test.skip(test.info().project.name !== "desktop-1440x900", "A compra muda o saldo da conta: um viewport");
  const page = await novaPagina(browser);
  await entrarComo(page, "e2e-sem-ia@skubo.test", E2E_SENHA);
  await page.goto("/ia");
  await expect(page.getByTestId("sem-perguntas-ia")).toBeVisible();

  const [checkout] = await Promise.all([page.context().waitForEvent("page"), page.getByRole("button", { name: "Comprar" }).first().click()]);
  await checkout.waitForURL(/\/ia/, { timeout: 20_000 });
  await checkout.close();

  await expect(page.getByTestId("saldo-ia")).toHaveText("25 perguntas", { timeout: 30_000 });
  await page.context().close();
});

test("admin: muda o preço do mensal e vê em /planos; campanha com público e teste", async ({ browser }) => {
  test.skip(test.info().project.name !== "desktop-1440x900", "Admin em um viewport");
  const admin = await novaPagina(browser);
  await entrarComo(admin, "e2e-admin@skubo.test", E2E_SENHA);

  await admin.goto("/admin/precos");
  await admin.locator("#mensal").fill("41,90");
  await admin.locator("#mensal").blur();
  await admin.getByRole("button", { name: "Salvar nova versão" }).click();
  await admin.locator("#motivo-acao").fill("Teste e2e do preço");
  await admin.getByRole("button", { name: "Confirmar" }).click();
  await expect(admin.getByText("Nova versão salva.")).toBeVisible();

  await admin.goto("/planos");
  await expect(admin.getByText(/R\$\s?41,90/).first()).toBeVisible();

  await admin.goto("/admin/emails/campanhas/nova");
  await admin.locator("#nome").fill("Campanha e2e");
  await admin.locator("#assunto").fill("Novidade no Skubo");
  await admin.locator("#pre").fill("Uma coisa nova para a sua loja");
  await admin.locator("#corpo").fill("Olá, {{nome}}! Temos novidade.");
  await admin.getByLabel("Tipo").selectOption("CICLO_DE_VIDA");
  await expect(admin.getByTestId("tamanho-publico")).toContainText(/\d+ pessoa/);
  await admin.getByRole("button", { name: /Salvar rascunho/ }).click();
  await admin.waitForURL(/\/admin\/emails\/campanhas\/(?!nova)/);
  await admin.getByRole("button", { name: /Enviar teste para mim/ }).click();
  await expect(admin.getByText(/Teste enviado para e2e-admin@skubo.test/)).toBeVisible();
  await expect.poll(() => emailsPara("e2e-admin@skubo.test").some((e) => e.assunto.includes("[Teste] Novidade no Skubo"))).toBe(true);
  await admin.context().close();
});

test("celular: cadastro em 2 passos, /indique e cartão de créditos", async ({ page }) => {
  test.skip(!celular(), "Só no celular");
  await page.goto("/register");
  await expect(page.getByRole("button", { name: "Continuar" })).toBeVisible();
  await expect(page.locator("#nomeLoja")).toBeHidden();

  await login(page);
  await page.goto("/indique");
  await expect(page.getByRole("heading", { name: /dias grátis por indicação/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Enviar no WhatsApp" })).toBeVisible();
  const largura = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(largura).toBeLessThanOrEqual(392);

  await page.goto("/ajustes#ia");
  await expect(page.getByTestId("cartao-creditos-ia")).toBeVisible();
});
