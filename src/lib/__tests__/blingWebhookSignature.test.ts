import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verificarAssinaturaBling } from "@/lib/blingWebhookSignature";

const SECRET = "segredo-do-app-bling";

function assinar(corpo: string, secret: string): string {
  return `sha256=${crypto.createHmac("sha256", secret).update(corpo, "utf8").digest("hex")}`;
}

describe("verificarAssinaturaBling", () => {
  it("aceita assinatura calculada corretamente com o mesmo segredo", () => {
    const corpo = JSON.stringify({ eventId: "evt-1", event: "product.updated" });
    const assinatura = assinar(corpo, SECRET);

    expect(verificarAssinaturaBling(corpo, assinatura, SECRET)).toBe(true);
  });

  it("rejeita assinatura calculada com segredo diferente", () => {
    const corpo = JSON.stringify({ eventId: "evt-1" });
    const assinatura = assinar(corpo, "outro-segredo");

    expect(verificarAssinaturaBling(corpo, assinatura, SECRET)).toBe(false);
  });

  it("rejeita corpo alterado depois da assinatura", () => {
    const assinatura = assinar(JSON.stringify({ eventId: "evt-1" }), SECRET);
    const corpoAlterado = JSON.stringify({ eventId: "evt-2" });

    expect(verificarAssinaturaBling(corpoAlterado, assinatura, SECRET)).toBe(false);
  });

  it("rejeita quando o header não tem o prefixo sha256=", () => {
    const corpo = JSON.stringify({ eventId: "evt-1" });
    const hashCrua = crypto.createHmac("sha256", SECRET).update(corpo, "utf8").digest("hex");

    expect(verificarAssinaturaBling(corpo, hashCrua, SECRET)).toBe(false);
  });

  it("rejeita quando não há header de assinatura", () => {
    expect(verificarAssinaturaBling("{}", null, SECRET)).toBe(false);
  });

  it("rejeita quando o segredo não está configurado", () => {
    const corpo = JSON.stringify({ eventId: "evt-1" });
    const assinatura = assinar(corpo, SECRET);

    expect(verificarAssinaturaBling(corpo, assinatura, undefined)).toBe(false);
  });
});
