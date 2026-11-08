import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function RootGroupNotFound() {
  return (
    <div className="mx-auto w-full flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 text-center">
      <PackageSearch className="h-12 w-12 text-muted-foreground" />
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Página não encontrada</h1>
        <p className="text-muted-foreground">
          O endereço que você acessou não existe ou foi movido.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/dashboard">Voltar para o início</Link>
      </Button>
    </div>
  );
}
