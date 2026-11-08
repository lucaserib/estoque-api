import { afterEach, describe, expect, it } from "vitest";
import { ehAdminPlataforma } from "../adminPlataforma";

describe("ehAdminPlataforma", () => {
  afterEach(() => {
    delete process.env.PLATFORM_ADMIN_EMAILS;
  });

  it("libera só os e-mails configurados, sem diferenciar maiúsculas", () => {
    process.env.PLATFORM_ADMIN_EMAILS = " dono@skubo.com.br , Socio@Skubo.com.br";
    expect(ehAdminPlataforma("dono@skubo.com.br")).toBe(true);
    expect(ehAdminPlataforma("socio@skubo.com.br")).toBe(true);
    expect(ehAdminPlataforma("cliente@loja.com")).toBe(false);
    expect(ehAdminPlataforma(null)).toBe(false);
  });

  it("nega todo mundo quando a variável não existe", () => {
    expect(ehAdminPlataforma("dono@skubo.com.br")).toBe(false);
  });
});
