import { Suspense } from "react";
import { ConfirmacaoEmail } from "./ConfirmacaoEmail";

export default function ConfirmarEmailPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmacaoEmail />
    </Suspense>
  );
}
