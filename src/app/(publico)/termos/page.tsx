import type { Metadata } from "next";
import { DocumentoMarkdown } from "@/components/publico/DocumentoMarkdown";
import { lerDocumentoJuridico } from "@/modules/clientes/documentosJuridicos";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "Termos de uso · Skubo" };

export default function Pagina() {
  return (
    <div className="mx-auto max-w-3xl">
      <DocumentoMarkdown texto={lerDocumentoJuridico("termos")} />
    </div>
  );
}
