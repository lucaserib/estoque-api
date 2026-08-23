"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import Header from "@/app/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

interface LinhaPlanilha {
  sku: string;
  quantidade: number;
  custoMedio?: number;
  armazem: string;
  valida: boolean;
  motivoInvalida?: string;
}

interface RejeitadaResposta {
  linha: number;
  sku: string;
  motivo: string;
}

function normalizarCabecalho(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function extrairLinhas(rows: Record<string, unknown>[]): LinhaPlanilha[] {
  return rows.map((row) => {
    const mapa = new Map<string, unknown>();
    Object.entries(row).forEach(([chave, valor]) => {
      mapa.set(normalizarCabecalho(chave), valor);
    });

    const sku = String(mapa.get("sku") ?? "").trim();
    const quantidadeBruta = mapa.get("quantidade");
    const custoBruto = mapa.get("customedio") ?? mapa.get("custo");
    const armazem = String(mapa.get("armazem") ?? "").trim();

    const quantidade = Number(quantidadeBruta);
    const custoMedio =
      custoBruto !== undefined && custoBruto !== ""
        ? Math.round(Number(custoBruto) * 100)
        : undefined;

    let valida = true;
    let motivoInvalida: string | undefined;

    if (!sku) {
      valida = false;
      motivoInvalida = "SKU vazio";
    } else if (!Number.isFinite(quantidade) || quantidade < 0) {
      valida = false;
      motivoInvalida = "Quantidade inválida";
    } else if (!armazem) {
      valida = false;
      motivoInvalida = "Armazém vazio";
    } else if (custoBruto !== undefined && custoBruto !== "" && (!Number.isFinite(Number(custoBruto)) || Number(custoBruto) < 0)) {
      valida = false;
      motivoInvalida = "Custo médio inválido";
    }

    return { sku, quantidade, custoMedio, armazem, valida, motivoInvalida };
  });
}

export default function ImportarEstoquePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [linhas, setLinhas] = useState<LinhaPlanilha[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<{
    aceitas: number;
    rejeitadas: RejeitadaResposta[];
  } | null>(null);

  const handleFile = async (file: File) => {
    setResultado(null);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        worksheet,
        { defval: "" }
      );

      if (rows.length === 0) {
        toast.error("A planilha não tem linhas de dados");
        return;
      }

      setLinhas(extrairLinhas(rows));
    } catch (error) {
      console.error("Erro ao ler planilha:", error);
      toast.error(
        "Não foi possível ler o arquivo. Verifique se é um .xlsx, .xls ou .csv válido."
      );
    }
  };

  const linhasValidas = linhas.filter((linha) => linha.valida);
  const linhasInvalidas = linhas.filter((linha) => !linha.valida);

  const handleImportar = async () => {
    if (linhasValidas.length === 0) return;

    setImportando(true);
    try {
      const response = await fetch("/api/estoque/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linhas: linhasValidas.map(({ sku, quantidade, custoMedio, armazem }) => ({
            sku,
            quantidade,
            custoMedio,
            armazem,
          })),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "Erro ao importar planilha");
      }

      const data = await response.json();
      setResultado({ aceitas: data.aceitas, rejeitadas: data.rejeitadas });

      if (data.aceitas > 0) {
        toast.success(`${data.aceitas} linha(s) importada(s) com sucesso`);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao importar planilha"
      );
    } finally {
      setImportando(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl p-6 space-y-6">
      <Header
        title="Importar Estoque"
        subtitle="Suba uma planilha com sku, quantidade, custoMedio e armazem"
      >
        <Button variant="outline" onClick={() => router.push("/produtos")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </Header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Planilha</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Colunas esperadas: <strong>sku</strong>, <strong>quantidade</strong>,{" "}
            <strong>custoMedio</strong> (em reais, opcional) e{" "}
            <strong>armazem</strong> (nome — criado automaticamente se não
            existir). O SKU precisa já existir em Produtos.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            {fileName || "Selecionar arquivo"}
          </Button>
        </CardContent>
      </Card>

      {linhas.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Pré-visualização ({linhas.length} linha(s))
            </CardTitle>
            <div className="flex gap-2">
              <Badge variant="outline">{linhasValidas.length} válidas</Badge>
              {linhasInvalidas.length > 0 && (
                <Badge variant="destructive">
                  {linhasInvalidas.length} com erro
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Custo médio</TableHead>
                    <TableHead>Armazém</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map((linha, index) => (
                    <TableRow key={index} className={!linha.valida ? "bg-destructive/5" : undefined}>
                      <TableCell>{linha.sku || "—"}</TableCell>
                      <TableCell>{linha.quantidade}</TableCell>
                      <TableCell>
                        {linha.custoMedio !== undefined
                          ? (linha.custoMedio / 100).toFixed(2)
                          : "—"}
                      </TableCell>
                      <TableCell>{linha.armazem || "—"}</TableCell>
                      <TableCell>
                        {linha.valida ? (
                          <span className="text-success text-xs">OK</span>
                        ) : (
                          <span className="text-destructive text-xs">
                            {linha.motivoInvalida}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {linhas.length > 0 && (
        <div className="flex justify-end">
          <Button
            onClick={handleImportar}
            disabled={importando || linhasValidas.length === 0}
          >
            {importando ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Importar {linhasValidas.length} linha(s)
          </Button>
        </div>
      )}

      {resultado && (
        <Alert variant={resultado.rejeitadas.length > 0 ? "warning" : "success"}>
          {resultado.rejeitadas.length > 0 ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          <AlertDescription>
            <p>
              {resultado.aceitas} linha(s) importada(s) com sucesso.{" "}
              {resultado.rejeitadas.length > 0 &&
                `${resultado.rejeitadas.length} linha(s) rejeitada(s) pelo servidor.`}
            </p>
            {resultado.rejeitadas.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {resultado.rejeitadas.map((rejeitada) => (
                  <li key={rejeitada.linha}>
                    Linha {rejeitada.linha} ({rejeitada.sku}): {rejeitada.motivo}
                  </li>
                ))}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
