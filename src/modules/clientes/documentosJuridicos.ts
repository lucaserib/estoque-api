import fs from "node:fs";
import path from "node:path";

export type DocumentoJuridico = "termos" | "privacidade" | "regulamento-indicacao";

export function lerDocumentoJuridico(documento: DocumentoJuridico): string {
  return fs.readFileSync(path.join(process.cwd(), "docs", "juridico", `${documento}.md`), "utf8");
}
