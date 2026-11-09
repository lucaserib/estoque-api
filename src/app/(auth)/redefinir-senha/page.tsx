import { Suspense } from "react";
import { FormularioRedefinirSenha } from "./FormularioRedefinirSenha";

export default function RedefinirSenhaPage() {
  return (
    <Suspense fallback={null}>
      <FormularioRedefinirSenha />
    </Suspense>
  );
}
