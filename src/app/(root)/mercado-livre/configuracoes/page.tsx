"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Store,
  Settings,
  Trash2,
  Plus,
  CheckCircle,
  Loader2,
  ExternalLink,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import Header from "@/app/components/Header";
import Link from "next/link";

interface MLAccount {
  id: string;
  nickname: string;
  siteId: string;
  isActive: boolean;
  userInfo?: {
    email: string;
    countryId: string;
    userType: string;
    points: number;
    permalink: string;
  };
}

export default function MercadoLivreConfiguracoesPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<MLAccount[]>([]);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      loadAccounts();
    }
  }, [status]);

  const loadAccounts = async () => {
    try {
      const response = await fetch('/api/mercadolivre/auth?action=accounts');
      if (!response.ok) throw new Error('Erro ao carregar contas');

      const accountsData = await response.json();

      // Handle both response formats
      const accountsList = Array.isArray(accountsData) ? accountsData : accountsData.accounts || [];

      setAccounts(accountsList);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar contas do Mercado Livre');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      const response = await fetch('/api/mercadolivre/auth?action=connect');
      if (!response.ok) throw new Error('Erro ao gerar URL de conexão');

      const data = await response.json();
      window.location.href = data.authUrl;
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao conectar conta do Mercado Livre');
    }
  };

  const handleDisconnect = async (accountId: string) => {
    if (!confirm('Tem certeza que deseja desconectar esta conta?')) {
      return;
    }

    setDisconnecting(accountId);
    try {
      const response = await fetch(`/api/mercadolivre/auth?accountId=${accountId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Erro ao desconectar conta');

      toast.success('Conta desconectada com sucesso');
      loadAccounts();
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao desconectar conta');
    } finally {
      setDisconnecting(null);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="container mx-auto p-6">
        <Header title="Configurações Mercado Livre" subtitle="Gerencie suas contas conectadas" />
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Header title="Configurações Mercado Livre" subtitle="Gerencie suas contas conectadas">
        <Link href="/mercado-livre">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
        </Link>
      </Header>

      {/* Botão Conectar Nova Conta */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Conectar Nova Conta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Conecte uma nova conta do Mercado Livre para gerenciar mais lojas.
          </p>
          <Button onClick={handleConnect}>
            <Store className="h-4 w-4 mr-2" />
            Conectar Conta
          </Button>
        </CardContent>
      </Card>

      {/* Lista de Contas Conectadas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Contas Conectadas ({accounts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="text-center py-8">
              <Store className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma conta conectada</h3>
              <p className="text-muted-foreground">
                Conecte sua primeira conta do Mercado Livre para começar.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                      <Store className="h-6 w-6 text-yellow-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{account.nickname}</h3>
                        {account.isActive && (
                          <Badge variant="success">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Ativa
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Site: {account.siteId?.toUpperCase() || 'MLB'}
                      </p>
                      {account.userInfo?.email && (
                        <p className="text-sm text-muted-foreground">
                          {account.userInfo.email}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {account.userInfo?.permalink && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(account.userInfo!.permalink, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDisconnect(account.id)}
                      disabled={disconnecting === account.id}
                    >
                      {disconnecting === account.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Informações Importantes */}
      <Alert>
        <Settings className="h-4 w-4" />
        <AlertDescription>
          <strong>Importante:</strong> Ao desconectar uma conta, todos os produtos vinculados
          serão mantidos no sistema, mas não será mais possível sincronizar com o Mercado Livre
          até reconectar a conta.
        </AlertDescription>
      </Alert>
    </div>
  );
}