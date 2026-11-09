import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErroAdmin, respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { auditar, exigirMotivo, ipDoAdmin } from "@/modules/admin/auditoria";
import { normalizarCodigoCupom } from "@/modules/comercial/cupons";

const cupomSchema = z
  .object({
    codigo: z.string().trim().min(3).max(30),
    descricao: z.string().trim().max(200).nullish(),
    tipo: z.enum(["PERCENTUAL", "FIXO"]),
    valor: z.number().int().positive(),
    alvo: z.enum(["PRIMEIRA_COBRANCA_MENSAL", "ANUAL", "PACOTE_IA"]),
    usosMaximos: z.number().int().positive().nullish(),
    validoAte: z.string().datetime().nullish(),
    motivo: z.string().optional(),
  })
  .refine((c) => c.tipo !== "PERCENTUAL" || c.valor <= 100, { message: "Desconto percentual vai até 100%.", path: ["valor"] });

export async function GET(request: NextRequest) {
  try {
    await verifyAdminPlataforma(request);
    return NextResponse.json({ cupons: await prisma.cupom.findMany({ orderBy: { createdAt: "desc" }, take: 200 }) });
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao listar cupons");
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdminPlataforma(request);
    const lido = cupomSchema.safeParse(await request.json().catch(() => ({})));
    if (!lido.success) return NextResponse.json({ error: lido.error.issues[0].message }, { status: 400 });
    const motivo = exigirMotivo(lido.data.motivo);
    const codigo = normalizarCodigoCupom(lido.data.codigo);
    if (!/^[A-Z0-9_-]{3,30}$/.test(codigo)) throw new ErroAdmin("Use só letras, números, hífen e sublinhado no código.");
    try {
      const cupom = await prisma.cupom.create({
        data: {
          codigo,
          descricao: lido.data.descricao || null,
          tipo: lido.data.tipo,
          valor: lido.data.valor,
          alvo: lido.data.alvo,
          usosMaximos: lido.data.usosMaximos ?? null,
          validoAte: lido.data.validoAte ? new Date(lido.data.validoAte) : null,
          criadoPor: admin.email,
        },
      });
      await auditar({ adminEmail: admin.email, acao: "CUPOM_CRIADO", alvoTipo: "CUPOM", alvoId: cupom.id, depois: cupom, motivo, ip: ipDoAdmin(request.headers) });
      return NextResponse.json({ cupom }, { status: 201 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ErroAdmin("Já existe um cupom com esse código.", 409);
      throw error;
    }
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao criar o cupom");
  }
}
