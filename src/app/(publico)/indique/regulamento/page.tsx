import type { Metadata } from "next";
import { DocumentoMarkdown } from "@/components/publico/DocumentoMarkdown";
import { lerDocumentoJuridico } from "@/modules/clientes/documentosJuridicos";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "Regulamento do Indique e ganhe · Skubo" };

export default function Pagina() {
  return (
    <div className="mx-auto max-w-3xl">
      <DocumentoMarkdown texto={lerDocumentoJuridico("regulamento-indicacao")} />
    </div>
  );
}
