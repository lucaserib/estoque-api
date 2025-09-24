"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, AlertCircle } from "lucide-react";
import Link from "next/link";
import { RestockAnalytics } from "@/types/ml-analytics";

interface MLRestockSuggestionsProps {
  restockData: RestockAnalytics;
}

export default function MLRestockSuggestions({
  restockData,
}: MLRestockSuggestionsProps) {
  if (!restockData || restockData.summary.needsAttention === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-green-500" />
            Estoque Saudável
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <p className="text-muted-foreground">
              Todos os produtos estão com estoque adequado
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Sugestões de Reposição
          <Badge variant="destructive" className="ml-2">
            {restockData.summary.needsAttention}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Recomendações Gerais */}
        {restockData.summary.recommendations &&
          restockData.summary.recommendations.length > 0 && (
            <div className="space-y-2 mb-4">
              {restockData.summary.recommendations.map((rec, index) => (
                <Alert key={index} className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{rec}</AlertDescription>
                </Alert>
              ))}
            </div>
          )}

        {/* Lista de Produtos */}
        <div className="space-y-3">
          {restockData.suggestions
            .filter((s) => s.priority === "critical" || s.priority === "high")
            .slice(0, 5)
            .map((suggestion) => (
              <div
                key={suggestion.sku}
                className={`p-3 rounded-lg border transition-colors hover:bg-muted/50 ${
                  suggestion.priority === "critical"
                    ? "border-red-200 bg-red-50"
                    : "border-orange-200 bg-orange-50"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        variant={
                          suggestion.priority === "critical"
                            ? "destructive"
                            : "default"
                        }
                        className="text-xs"
                      >
                        {suggestion.priority.toUpperCase()}
                      </Badge>
                      <p className="font-medium text-sm truncate">
                        {suggestion.productName}
                      </p>
                    </div>

                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>
                        SKU: {suggestion.sku} | Estoque ML:{" "}
                        {suggestion.currentMLStock}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {suggestion.reasons.map((reason, idx) => (
                          <span key={idx} className="text-blue-600">
                            {reason}
                            {idx < suggestion.reasons.length - 1 && " • "}
                          </span>
                        ))}
                      </div>

                      {/* Ações sugeridas */}
                      {suggestion.actions && suggestion.actions.length > 0 && (
                        <div className="mt-2">
                          <p className="font-medium text-xs text-gray-700">
                            Ações:
                          </p>
                          <ul className="list-disc list-inside text-xs space-y-1">
                            {suggestion.actions.map((action, idx) => (
                              <li key={idx} className="text-gray-600">
                                {action}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right ml-4">
                    <p className="font-semibold text-sm text-purple-600">
                      Sugestão: {suggestion.suggestedRestock}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Velocidade: {suggestion.salesVelocity.toFixed(1)}/dia
                    </p>
                    {suggestion.daysUntilStockout < 30 && (
                      <p className="text-xs text-red-600 font-medium">
                        Esgota em {suggestion.daysUntilStockout} dias
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>

        {/* Resumo da Reposição */}
        {restockData.summary && (
          <div className="mt-4 pt-4 border-t bg-muted/30 rounded-lg p-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-lg font-bold text-red-600">
                  {restockData.summary.critical || 0}
                </p>
                <p className="text-xs text-muted-foreground">Críticos</p>
              </div>
              <div>
                <p className="text-lg font-bold text-orange-600">
                  {restockData.summary.high || 0}
                </p>
                <p className="text-xs text-muted-foreground">Alta prioridade</p>
              </div>
              <div>
                <p className="text-lg font-bold text-yellow-600">
                  {restockData.summary.medium || 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  Média prioridade
                </p>
              </div>
              <div>
                <p className="text-lg font-bold text-purple-600">
                  {restockData.summary.totalPotentialRevenue
                    ? `R$ ${(
                        restockData.summary.totalPotentialRevenue / 100
                      ).toFixed(0)}k`
                    : "N/A"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Receita potencial
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Botão para ver todos */}
        {restockData.suggestions.length > 5 && (
          <div className="mt-4 text-center">
            <Link href="/mercado-livre/produtos">
              <Button variant="outline" size="sm">
                Ver Todos os Produtos ({restockData.suggestions.length})
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
