"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { ErrorState } from "@/components/ui/error-state";

export default function RootGroupError({
  error,
  reset,
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
    <div className="container mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center p-6">
      <ErrorState
        title="Essa tela não carregou"
        description="Nossa equipe já foi notificada — tente de novo ou volte para o início."
        onRetry={reset}
        actionHref="/dashboard"
        actionLabel="Voltar para o início →"
      />
    </div>
  );
}
