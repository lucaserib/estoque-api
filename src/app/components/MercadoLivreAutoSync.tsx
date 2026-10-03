"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle,
  Zap,
  Timer,
  Activity,
  Settings,
  Pause,
  BarChart,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AutoSyncStats {
  healthy: number;
  error: number;
  needsSync: number;
  total: number;
}

interface AutoSyncProps {
  accountId: string;
}

export default function MercadoLivreAutoSync({ accountId }: AutoSyncProps) {
  const [isEnabled, setIsEnabled] = useState(true);
  const [syncInterval, setSyncInterval] = useState<string>("15");
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [lastSyncStatus, setLastSyncStatus] = useState<string | null>(null);
  const [syncHealthPercentage, setSyncHealthPercentage] = useState(0);
  const [stats, setStats] = useState<AutoSyncStats>({
    healthy: 0,
    error: 0,
    needsSync: 0,
    total: 0,
  });
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadAutoSyncStats();

    const savedInterval = localStorage.getItem(`ml-sync-interval-${accountId}`);
    const savedEnabled = localStorage.getItem(`ml-sync-enabled-${accountId}`);

    if (savedInterval) setSyncInterval(savedInterval);
    if (savedEnabled !== null) setIsEnabled(savedEnabled === 'true');

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setup na montagem/conta; intervalId é gerenciado dentro do efeito
  }, [accountId]);

  useEffect(() => {
    if (intervalId) {
      clearInterval(intervalId);
    }

    if (isEnabled && syncInterval) {
      const minutes = parseInt(syncInterval);
      const id = setInterval(() => {
        runAutoSync();
      }, minutes * 60 * 1000);

      setIntervalId(id);
    }

    localStorage.setItem(`ml-sync-interval-${accountId}`, syncInterval);
    localStorage.setItem(`ml-sync-enabled-${accountId}`, isEnabled.toString());

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- (re)cria o intervalo; incluir intervalId/runAutoSync causaria loop de setInterval
  }, [isEnabled, syncInterval, accountId]);

  const loadAutoSyncStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/mercadolivre/sync/auto-stock?accountId=${accountId}`
      );
      if (!response.ok) throw new Error('Erro ao carregar estatísticas');

      const data = await response.json();
      setStats({
        healthy: data.healthy || 0,
        error: data.errorProducts || 0,
        needsSync: data.needsSync || 0,
        total: data.totalProducts || 0,
      });
      setLastSync(data.lastAutoSync || null);
      setLastSyncStatus(data.lastSyncStatus || null);
      setSyncHealthPercentage(data.syncHealthPercentage || 0);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar dados de sincronização');
    } finally {
      setLoading(false);
    }
  };

  const runAutoSync = async () => {
    if (isRunning) return;

    setIsRunning(true);
    try {
      const response = await fetch('/api/mercadolivre/sync/auto-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, syncAll: false }),
      });

      if (!response.ok) throw new Error('Erro na sincronização');

      const result = await response.json();

      if (result.success) {
        toast.success(
          `${result.updatedItems} produto(s) atualizados de ${result.totalProcessed} verificados`
        );
        loadAutoSyncStats();
      } else {
        throw new Error(result.error || 'Erro desconhecido');
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro na sincronização automática');
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'success':
        return <Badge variant="success" className="gap-1"><CheckCircle className="h-3 w-3" />Sucesso</Badge>;
      case 'partial':
        return <Badge variant="warning" className="gap-1"><AlertCircle className="h-3 w-3" />Parcial</Badge>;
      case 'error':
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Erro</Badge>;
      default:
        return <Badge variant="secondary">Nunca sincronizado</Badge>;
    }
  };

  const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return 'Nunca';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return 'Agora mesmo';
    if (diffMins < 60) return `${diffMins}min atrás`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h atrás`;

    return format(date, 'dd/MM/yyyy HH:mm', { locale: ptBR });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Carregando configurações...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Sincronização Automática
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Ativar Sincronização Automática</h4>
              <p className="text-sm text-muted-foreground">
                Mantém produtos atualizados automaticamente em tempo real
              </p>
            </div>
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>

          {isEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Intervalo de Sincronização</label>
                <Select value={syncInterval} onValueChange={setSyncInterval}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 minutos</SelectItem>
                    <SelectItem value="15">15 minutos</SelectItem>
                    <SelectItem value="30">30 minutos</SelectItem>
                    <SelectItem value="60">1 hora</SelectItem>
                    <SelectItem value="120">2 horas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  onClick={runAutoSync}
                  disabled={isRunning}
                  className="w-full"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sincronizar Agora
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {!isEnabled && (
            <Alert>
              <Pause className="h-4 w-4" />
              <AlertDescription>
                Sincronização automática está desabilitada. Os produtos só serão atualizados manualmente ou via webhooks.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Saudáveis</p>
                <p className="text-2xl font-bold text-success">{stats.healthy}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Com Erro</p>
                <p className="text-2xl font-bold text-destructive">{stats.error}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Precisam Sincronizar</p>
                <p className="text-2xl font-bold text-warning">{stats.needsSync}</p>
              </div>
              <Clock className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Vinculados</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <BarChart className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Status da Sincronização
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Última Sincronização</p>
              <p className="font-medium">{formatTimeAgo(lastSync)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Status</p>
              {getStatusBadge(lastSyncStatus)}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm text-muted-foreground">Progresso Geral</p>
              <span className="text-sm font-medium">{syncHealthPercentage}%</span>
            </div>
            <Progress value={syncHealthPercentage} className="h-2" />
          </div>

          {stats.needsSync > 0 && (
            <Alert>
              <Timer className="h-4 w-4" />
              <AlertDescription>
                {stats.needsSync} produto(s) precisam de atualização.
                {isEnabled
                  ? ` Próxima sincronização neste navegador em ${syncInterval} minutos, enquanto esta página ficar aberta.`
                  : " Ative a sincronização automática ou use o botão \"Sincronizar Agora\"."}
              </AlertDescription>
            </Alert>
          )}

          {isEnabled && (
            <div className="flex items-center gap-2 text-sm text-success">
              <Zap className="h-4 w-4" />
              <span>
                Sincronização automática ativa neste navegador - intervalo: {syncInterval} minutos
              </span>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart className="h-5 w-5" />
            Sincronização em Tempo Real
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Webhooks Ativos:</strong> Seu sistema recebe notificações automáticas do Mercado Livre quando há mudanças em:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Preços dos produtos</li>
                <li>Quantidades em estoque</li>
                <li>Status dos produtos (ativo/pausado)</li>
                <li>Informações gerais dos produtos</li>
              </ul>
              <p className="mt-2 text-sm">
                Os produtos vinculados são atualizados automaticamente via webhooks.<br/>
                A sincronização automática serve como backup e para produtos não vinculados.
              </p>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}