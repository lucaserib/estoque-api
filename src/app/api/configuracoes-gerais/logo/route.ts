import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";

interface LogoResponse {
  logoUrl: string;
}

interface LogoError {
  error: string;
}

const MAX_SIZE_BYTES = 2 * 1024 * 1024;
const BLOB_HOST_FRAGMENT = ".public.blob.vercel-storage.com";

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function detectImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<LogoResponse | LogoError>> {
  try {
    const user = await verifyUser(request);

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "O arquivo deve ter no máximo 2 MB" },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const tipoReal = detectImageType(bytes);

    if (!tipoReal) {
      return NextResponse.json(
        { error: "Formato de imagem inválido. Envie um arquivo JPG, PNG ou WEBP." },
        { status: 400 }
      );
    }

    const extensao = EXTENSION_BY_TYPE[tipoReal];
    const blob = await put(
      `logos-loja/${user.contaId}-${Date.now()}.${extensao}`,
      new Blob([bytes], { type: tipoReal }),
      { access: "public", contentType: tipoReal }
    );

    const configAnterior = await prisma.configuracaoGeral.findUnique({
      where: { userId: user.contaId },
    });

    await prisma.configuracaoGeral.upsert({
      where: { userId: user.contaId },
      update: { logoUrl: blob.url },
      create: { userId: user.contaId, logoUrl: blob.url },
    });

    if (configAnterior?.logoUrl && configAnterior.logoUrl.includes(BLOB_HOST_FRAGMENT)) {
      try {
        await del(configAnterior.logoUrl);
      } catch (deleteError) {
        console.error("Erro ao remover logo anterior:", deleteError);
      }
    }

    return NextResponse.json({ logoUrl: blob.url });
  } catch (error) {
    console.error("Erro ao enviar logo da loja:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
