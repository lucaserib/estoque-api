"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  ExternalLink,
  ChevronDown,
  CheckCircle2,
  Copy,
  Info,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function MercadoLivreConfigHelp() {
  const [isOpen, setIsOpen] = useState(false);
  const redirectUri = `${
    typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000"
  }/configuracoes`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência!");
  };

  const configSteps = [
    {
      title: "1. Acesse o Painel de Desenvolvedor",
      description:
        "Faça login em sua conta do Mercado Livre e acesse o painel de desenvolvedor",
      action: (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            window.open("https://developers.mercadolivre.com.br/", "_blank")
          }
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Acessar Painel
        </Button>
      ),
    },
    {
      title: "2. Crie uma Nova Aplicação",
      description:
        "No painel, clique em 'Criar nova aplicação' e preencha os dados necessários",
      details: [
        "Nome da aplicação: Sistema de Estoque",
        "Categoria: Integração",
        "Descrição: Sistema para gestão de estoque integrado ao ML",
      ],
    },
    {
      title: "3. ⚠️ Configure HTTPS (Obrigatório)",
      description:
        "O Mercado Livre só aceita URLs HTTPS. Para desenvolvimento local, use ngrok:",
      action: (
        <div className="space-y-3">
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm font-medium text-yellow-800 mb-2">
              🚨 O ML não aceita HTTP - apenas HTTPS
            </p>
            <div className="space-y-2 text-sm text-yellow-700">
              <p>
                <strong>Opção 1 - ngrok (Recomendado):</strong>
              </p>
              <div className="bg-gray-900 text-green-400 p-2 rounded font-mono text-xs">
                <div>npm run dev</div>
                <div>ngrok http 3000</div>
              </div>
              <p>Use a URl HTTPS do ngrok (ex: https://abc123.ngrok.io)</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open("https://ngrok.com/download", "_blank")}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Download ngrok.io
          </Button>
        </div>
      ),
    },
    {
      title: "4. Configure a URL de Redirecionamento",
      description: "Use a URL HTTPS obtida no passo anterior:",
      action: (
        <div className="space-y-2">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm font-medium text-blue-800 mb-2">
              Exemplos de URLs válidas:
            </p>
            <div className="space-y-1 text-sm font-mono">
              <div className="text-green-700">
                ✅ https://abc123.ngrok.io/configuracoes
              </div>
              <div className="text-green-700">
                ✅ https://seu-dominio.com/configuracoes
              </div>
              <div className="text-red-700">
                ❌ http://localhost:3000/configuracoes
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-600">
            ⚠️ A URL deve ser copiada exatamente como está, incluindo
            /configuracoes
          </p>
        </div>
      ),
    },
    {
      title: "5. Obtenha as Credenciais",
      description: "Após criar a aplicação, você receberá:",
      details: [
        "APP ID (Client ID) - Configure como ML_CLIENT_ID",
        "Secret Key (Client Secret) - Configure como ML_CLIENT_SECRET",
      ],
    },
    {
      title: "6. Configure as Variáveis de Ambiente",
      description: "Adicione as credenciais no seu arquivo .env:",
      action: (
        <div className="space-y-2">
          <div className="p-3 bg-gray-900 text-green-400 rounded text-sm font-mono">
            <div>ML_CLIENT_ID="seu_app_id_aqui"</div>
            <div>ML_CLIENT_SECRET="sua_secret_key_aqui"</div>
            <div>ML_REDIRECT_URI="https://abc123.ngrok.io/configuracoes"</div>
          </div>
          <div className="p-2 bg-amber-50 border border-amber-200 rounded">
            <p className="text-xs text-amber-700">
              💡 <strong>Lembre-se:</strong> Use a URL HTTPS real do ngrok, não
              o exemplo acima
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              copyToClipboard(
                `ML_CLIENT_ID="seu_app_id_aqui"\nML_CLIENT_SECRET="sua_secret_key_aqui"\nML_REDIRECT_URI="https://sua-url-https.ngrok.io/configuracoes"`
              )
            }
          >
            <Copy className="h-4 w-4 mr-2" />
            Copiar Template
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <Button
          variant="outline"
          className="w-full justify-between"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            Como Configurar a Integração com Mercado Livre
          </span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${
              isOpen ? "transform rotate-180" : ""
            }`}
          />
        </Button>

        {isOpen && (
          <div className="space-y-4 mt-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Esta configuração precisa ser feita apenas uma vez. Siga os
                passos abaixo para conectar sua conta do Mercado Livre.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              {configSteps.map((step, index) => (
                <Card key={index}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="w-6 h-6 rounded-full p-0 flex items-center justify-center"
                      >
                        {index + 1}
                      </Badge>
                      {step.title}
                    </CardTitle>
                    <CardDescription>{step.description}</CardDescription>
                  </CardHeader>

                  {(step.details || step.action) && (
                    <CardContent className="pt-0">
                      {step.details && (
                        <ul className="space-y-1 text-sm text-gray-600">
                          {step.details.map((detail, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                              {detail}
                            </li>
                          ))}
                        </ul>
                      )}
                      {step.action && <div className="mt-3">{step.action}</div>}
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Importante:</strong> Após configurar as variáveis de
                ambiente, reinicie sua aplicação para que as alterações tenham
                efeito.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() =>
                  window.open(
                    "https://developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao",
                    "_blank"
                  )
                }
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Documentação Oficial
              </Button>

              <Button
                variant="outline"
                onClick={() =>
                  window.open(
                    "https://developers.mercadolivre.com.br/",
                    "_blank"
                  )
                }
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Painel de Desenvolvedor
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
