"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-2 p-6">
          <h1 className="text-xl font-semibold">Algo deu errado</h1>
          <p className="text-muted-foreground text-sm">
            Nossa equipe já foi notificada. Tente recarregar a página.
          </p>
        </div>
      </body>
    </html>
  );
}
