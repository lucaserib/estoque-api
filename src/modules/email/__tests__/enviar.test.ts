import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  emailEnviado: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
  supressaoEmail: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { definirProvedorEmail, type MensagemEmail, type ProvedorEmail } from "../provedor";
import { enviarEmail } from "../enviar";
import { processarFilaEmails } from "../fila";

const enviados: MensagemEmail[] = [];
const provedor: ProvedorEmail = {
  nome: "console",
  enviar: vi.fn(async (m: MensagemEmail) => {
    enviados.push(m);
    return { id: `prov-${enviados.length}`, erro: null };
  }),
  enviarLote: vi.fn(async (lista: MensagemEmail[]) => lista.map((m) => (enviados.push(m), { id: `prov-${enviados.length}`, erro: null }))),
};

function registro(dados: Record<string, unknown>) {
  return { id: "e1", tentativas: 0, status: "ENFILEIRADO", campanhaId: null, ...dados };
}

beforeEach(() => {
  vi.clearAllMocks();
  enviados.length = 0;
  definirProvedorEmail(provedor);
  process.env.DESCADASTRO_SEGREDO = "segredo-de-teste";
  process.env.NEXT_PUBLIC_APP_URL = "https://app.skubo.test";
  prismaMock.emailEnviado.findUnique.mockResolvedValue(null);
  prismaMock.supressaoEmail.findUnique.mockResolvedValue(null);
  prismaMock.user.findUnique.mockResolvedValue({ preferencias: { cicloDeVida: true, marketingEmail: false } });
  prismaMock.emailEnviado.create.mockImplementation(async ({ data }) => registro(data));
  prismaMock.emailEnviado.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.emailEnviado.update.mockImplementation(async ({ data }) => ({ id: "e1", ...data }));
});

describe("enviarEmail", () => {
  it("mesma chave de idempotência não envia de novo", async () => {
    prismaMock.emailEnviado.findUnique.mockResolvedValue({ id: "e0", status: "ENVIADO" });
    const resultado = await enviarEmail({
      para: "ana@loja.com",
      modelo: "redefinir-senha",
      dados: { nome: "Ana", link: "https://app.skubo.test/x" },
      chaveIdempotencia: "redefinir:1",
    });
    expect(resultado).toEqual({ id: "e0", status: "ENVIADO", novo: false });
    expect(prismaMock.emailEnviado.create).not.toHaveBeenCalled();
    expect(provedor.enviar).not.toHaveBeenCalled();
  });

  it("transacional urgente sai na hora, sem cabeçalho de descadastro e sem guardar os dados", async () => {
    const resultado = await enviarEmail({
      para: " Ana@Loja.com ",
      modelo: "redefinir-senha",
      dados: { nome: "Ana", link: "https://app.skubo.test/redefinir-senha?token=abc" },
      chaveIdempotencia: "redefinir:2",
      userId: "u1",
    });
    expect(resultado.status).toBe("ENVIADO");
    expect(prismaMock.emailEnviado.create.mock.calls[0][0].data).toMatchObject({ para: "ana@loja.com", categoria: "TRANSACIONAL" });
    expect(String(prismaMock.emailEnviado.create.mock.calls[0][0].data.dados)).not.toContain("token=abc");
    expect(enviados[0].cabecalhos?.["List-Unsubscribe"]).toBeUndefined();
    expect(enviados[0].texto).toContain("redefinir-senha?token=abc");
    expect(enviados[0].html).toContain("Criar nova senha");
  });

  it("transacional passa por descadastro total, mas não por devolução ou reclamação", async () => {
    prismaMock.supressaoEmail.findUnique.mockResolvedValueOnce({ motivo: "DESCADASTRO_TOTAL" });
    expect(
      (await enviarEmail({ para: "a@b.com", modelo: "confirmar-email", dados: { nome: null, link: "https://x" }, chaveIdempotencia: "c:1" })).status
    ).toBe("ENVIADO");

    prismaMock.supressaoEmail.findUnique.mockResolvedValueOnce({ motivo: "DEVOLUCAO" });
    expect(
      (await enviarEmail({ para: "a@b.com", modelo: "confirmar-email", dados: { nome: null, link: "https://x" }, chaveIdempotencia: "c:2" })).status
    ).toBe("SUPRIMIDO");
  });

  it("marketing sem consentimento é suprimido; com consentimento vai para a fila", async () => {
    const pedido = {
      para: "ana@loja.com",
      modelo: "campanha" as const,
      dados: { assunto: "Novidade", preCabecalho: "Oi", corpo: "Texto" },
      userId: "u1",
    };
    expect((await enviarEmail({ ...pedido, chaveIdempotencia: "camp:1" })).status).toBe("SUPRIMIDO");

    prismaMock.user.findUnique.mockResolvedValue({ preferencias: { cicloDeVida: true, marketingEmail: true } });
    const resultado = await enviarEmail({ ...pedido, chaveIdempotencia: "camp:2" });
    expect(resultado.status).toBe("ENFILEIRADO");
    expect(prismaMock.emailEnviado.create.mock.calls[1][0].data.dados).toMatchObject({ assunto: "Novidade" });
    expect(provedor.enviar).not.toHaveBeenCalled();
  });

  it("ciclo de vida respeita quem saiu dessa categoria", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ preferencias: { cicloDeVida: false } });
    const resultado = await enviarEmail({
      para: "ana@loja.com",
      modelo: "automacao",
      dados: { assunto: "Conecte o ML", preCabecalho: "", corpo: "Oi" },
      userId: "u1",
      chaveIdempotencia: "conectar-ml:c1",
    });
    expect(resultado.status).toBe("SUPRIMIDO");
  });
});

describe("fila de e-mails", () => {
  it("envia em lote com cabeçalhos de descadastro de um clique e marca como enviado", async () => {
    prismaMock.emailEnviado.findMany.mockResolvedValue([
      registro({
        id: "e7",
        para: "ana@loja.com",
        modelo: "automacao",
        categoria: "CICLO_DE_VIDA",
        userId: "u1",
        chaveIdempotencia: "conectar-ml:c1",
        dados: { assunto: "Conecte o ML", preCabecalho: "", corpo: "Oi" },
      }),
    ]);
    const resultado = await processarFilaEmails();
    expect(resultado).toMatchObject({ pendentes: 1, enviados: 1 });
    expect(enviados[0].cabecalhos?.["List-Unsubscribe"]).toMatch(/^<https:\/\/app\.skubo\.test\/api\/descadastro\?t=/);
    expect(enviados[0].cabecalhos?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(enviados[0].html).toContain("Não quero mais receber estes e-mails");
    expect(prismaMock.emailEnviado.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "e7" }, data: expect.objectContaining({ status: "ENVIADO", provedorId: "prov-1" }) })
    );
  });

  it("falha do provedor volta para a fila até a terceira tentativa", async () => {
    vi.mocked(provedor.enviarLote).mockResolvedValueOnce([{ id: null, erro: "limite" }]);
    prismaMock.emailEnviado.findMany.mockResolvedValue([
      registro({ id: "e8", tentativas: 0, para: "a@b.com", modelo: "convite-aceito", categoria: "TRANSACIONAL", chaveIdempotencia: "k", dados: { nomeConvidado: "A", emailConvidado: "a@b.com", papel: "Compras" } }),
    ]);
    const resultado = await processarFilaEmails();
    expect(resultado.reenfileirados).toBe(1);
    expect(prismaMock.emailEnviado.update).toHaveBeenCalledWith({ where: { id: "e8" }, data: { status: "ENFILEIRADO", erro: "limite" } });
  });
});
