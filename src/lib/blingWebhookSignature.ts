import crypto from "crypto";

export function verificarAssinaturaBling(
  corpoCru: string,
  assinaturaHeader: string | null,
  secret: string | undefined
): boolean {
  if (!assinaturaHeader?.startsWith("sha256=")) return false;
  if (!secret) return false;

  const esperado = crypto
    .createHmac("sha256", secret)
    .update(corpoCru, "utf8")
    .digest("hex");
  const recebido = assinaturaHeader.slice("sha256=".length);

  const esperadoBuffer = Buffer.from(esperado);
  const recebidoBuffer = Buffer.from(recebido);
  if (esperadoBuffer.length !== recebidoBuffer.length) return false;

  return crypto.timingSafeEqual(esperadoBuffer, recebidoBuffer);
}
