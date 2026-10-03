export interface BlingSyncHistoryStatus {
  id: string;
  status: string;
  totalItems: number;
  syncedItems: number;
  newItems: number;
  updatedItems: number;
  errorItems: number;
  errors: string[] | null;
  completedAt: string | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pollBlingSyncHistory(
  syncHistoryId: string,
  options: { intervalMs?: number; maxAttempts?: number } = {}
): Promise<BlingSyncHistoryStatus> {
  const intervalMs = options.intervalMs ?? 2000;
  const maxAttempts = options.maxAttempts ?? 90;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(
      `/api/bling/produtos/importar?syncHistoryId=${syncHistoryId}`
    );

    if (response.ok) {
      const data: BlingSyncHistoryStatus = await response.json();
      if (data.status !== "processing") {
        return data;
      }
    }

    await sleep(intervalMs);
  }

  throw new Error("Tempo limite esperando a sincronização do Bling");
}
