import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";

interface PerfilResponse {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  createdAt: string;
  provider: string;
  hasPassword: boolean;
}

interface PerfilError {
  error: string;
  code?: string;
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<PerfilResponse | PerfilError>> {
  try {
    const user = await verifyUser(request);

    const account = await prisma.account.findFirst({
      where: { userId: user.id },
      select: { provider: true },
    });

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      createdAt: user.createdAt.toISOString(),
      provider: account?.provider ?? "credentials",
      hasPassword: user.password !== null,
    });
  } catch (error) {
    console.error("Erro ao buscar perfil:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

const patchSchema = z.object({
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres").max(80, "Nome deve ter no máximo 80 caracteres"),
  image: z.string().url().nullable().optional(),
});

export async function PATCH(
  request: NextRequest
): Promise<NextResponse<Pick<PerfilResponse, "id" | "name" | "email" | "image"> | PerfilError>> {
  try {
    const user = await verifyUser(request);
    const parsed = patchSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, image } = parsed.data;

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        name,
        ...(image !== undefined ? { image } : {}),
      },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      image: updated.image,
    });
  } catch (error) {
    console.error("Erro ao atualizar perfil:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
