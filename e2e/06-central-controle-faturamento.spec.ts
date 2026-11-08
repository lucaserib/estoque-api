import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("Central de controle mostra a nota da loja e os pontos a resolver", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440x900", "Um viewport basta para o fluxo");
  await login(page);
  await page.goto("/controle");

  await expect(page.getByRole("heading", { name: "Central de controle" })).toBeVisible();
  await expect(page.getByText("Saúde da loja")).toBeVisible();
  await expect(page.getByText("Análise com IA")).toBeVisible();

  const nota = await page.locator("text=de 100").first().locator("xpath=..").locator("span").first().innerText();
  expect(Number(nota)).toBeGreaterThanOrEqual(0);
  expect(Number(nota)).toBeLessThanOrEqual(100);
});

test("faturamento com frete soma produtos e frete e alterna a visão", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440x900", "Um viewport basta para o fluxo");
  await login(page);

  const resposta = await page.request.get("/api/financeiro/faturamento-com-frete?periodo=30");
  expect(resposta.ok()).toBeTruthy();
  const dados = await resposta.json();
  expect(dados.totais.comFrete).toBe(dados.totais.produtos + dados.totais.freteComprador + dados.totais.freteVendedor);

  await page.goto("/");
  const cartao = page.locator("section", { has: page.getByRole("heading", { name: "Quanto foi faturado de verdade" }) });
  await expect(cartao).toBeVisible();
  await cartao.getByRole("tab", { name: "Só produtos" }).click();
  await expect(cartao.getByRole("tab", { name: "Só produtos" })).toHaveAttribute("aria-selected", "true");
  await cartao.getByRole("button", { name: /Ver por dia/ }).click();
  await expect(cartao.locator("table")).toBeVisible();
});

test("painel admin fica fechado para quem não é administrador da plataforma", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440x900", "Um viewport basta para o fluxo");
  test.skip(Boolean(process.env.PLATFORM_ADMIN_EMAILS?.includes("e2e@skubo.test")), "Conta de teste configurada como admin");
  await login(page);
  const resposta = await page.request.get("/api/admin/metricas");
  expect(resposta.status()).toBe(403);
});
