"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  HelpCircle,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const MercadoLivreConfigHelp = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="mb-6 border-blue-200 bg-blue-50">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-blue-100 transition-colors">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-blue-600" />
                <span className="text-blue-800">
                  Configuração do Mercado Livre
                </span>
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-blue-600" />
              ) : (
                <ChevronDown className="h-4 w-4 text-blue-600" />
              )}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Importante:</strong> O Mercado Livre só aceita URLs
                HTTPS. Para desenvolvimento local, você precisa usar ngrok ou
                similar.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-800">
                  1. Criar Aplicação
                </h3>
                <ul className="text-sm space-y-1 text-gray-600">
                  <li>• Acesse developers.mercadolivre.com.br</li>
                  <li>• Crie uma nova aplicação</li>
                  <li>• Configure a URL de callback</li>
                  <li>• Anote o APP_ID e SECRET_KEY</li>
                </ul>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href="https://developers.mercadolivre.com.br/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gap-2"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Portal de Desenvolvedores
                  </a>
                </Button>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-gray-800">
                  2. Configurar Variávei
                </h3>
                <div className="bg-gray-100 p-3 rounded-md text-sm font-mono">
                  <div className="text-gray-600">
                    ML_CLIENT_ID=seu_app_id
                    <br />
                    ML_CLIENT_SECRET=sua_secret_key
                    <br />
                    ML_REDIRECT_URI=https://seu-dominio.com/configuracoes
                  </div>
                </div>
                <div className="text-xs text-gray-600 space-y-1">
                  <p>
                    <strong>Importante-</strong>
                  </p>
                  <p>• Use HTTPS (obrigatório para produção)</p>
                  <p>
                    • Para desenvolvimento local, use ngrok ou túnel similar
                  </p>
                  <p>• Endpoint de autorização: auth.mercadolivre.com.br</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-100 p-3 rounded-md">
              <CheckCircle className="h-4 w-4" />
              <span>
                Após a configuração, clique em &quot;Conectar Conta&quot; para
                autorizar a integração.
              </span>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default MercadoLivreConfigHelp;
