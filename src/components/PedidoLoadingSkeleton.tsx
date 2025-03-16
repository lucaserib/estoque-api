"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export function PedidoLoadingSkeleton() {
  return (
    <div className="space-y-3">
      <Card className="w-full border-gray-200 dark:border-gray-800">
        <CardContent className="p-6">
          <div className="flex flex-col space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <div className="flex items-center justify-center my-4">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
              <span className="ml-2 text-gray-600 dark:text-gray-400">
                Carregando pedidos...
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
