import { put } from "@vercel/blob";

export async function rehostTemporaryImage(
  url: string,
  filenameHint: string
): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = await response.arrayBuffer();
    const extensao = contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
      ? "webp"
      : "jpg";

    const blob = await put(
      `bling-produtos/${filenameHint}-${Date.now()}.${extensao}`,
      new Blob([buffer], { type: contentType }),
      { access: "public", contentType }
    );

    return blob.url;
  } catch (error) {
    console.error("Erro ao re-hospedar imagem temporária do Bling:", error);
    return null;
  }
}
