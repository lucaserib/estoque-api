import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";

interface SenhaError {
  error: string;
  code?: string;
}

const senhaSchema = z.object({
  senhaAtual: z.string().min(1, "Informe a senha atual"),
  novaSenha: z
    .string()
    .regex(
      /^(?=.*[A-Za-z])(?=.*\d).{8,}$/,
      "A nova senha deve ter pelo menos 8 caracteres, com letra e número"
    ),
});

export async function POST(
  request: NextRequest
): Promise<NextResponse<{ success: true } | SenhaError>> {
  try {
    const user = await verifyUser(request);

    if (!user.password) {
      return NextResponse.json(
        {
          error:
            "Esta conta entra apenas com o Google e não tem senha para alterar",
          code: "OAUTH_SEM_SENHA",
        },
        { status: 400 }
      );
    }

    const parsed = senhaSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { senhaAtual, novaSenha } = parsed.data;

    const senhaValida = await bcrypt.compare(senhaAtual, user.password);
    if (!senhaValida) {
      return NextResponse.json(
        { error: "Senha atual incorreta" },
        { status: 400 }
      );
    }

    const novaSenhaHash = await bcrypt.hash(novaSenha, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: novaSenhaHash },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao alterar senha:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
