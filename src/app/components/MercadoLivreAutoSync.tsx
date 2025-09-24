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
  Play,
  Pause,
  BarChart,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AutoSyncStats {
  synced?: number;
  error?: number;
  ignored?: number;
  pending?: number;
}

interface AutoSyncProps {
  accountId: string;
}

export default function MercadoLivreAutoSync({ accountId }: AutoSyncProps) {
  const [isEnabled, setIsEnabled] = useState(true);
  const [syncInterval, setSyncInterval] = useState<string>("15"); // minutos
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [lastSyncStatus, setLastSyncStatus] = useState<string | null>(null);
  const [stats, setStats] = useState<AutoSyncStats>({});
  const [staleProducts, setStaleProducts] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadAutoSyncStats();

    // Carregar configurações salvas
    const savedInterval = localStorage.getItem(`ml-sync-interval-${accountId}`);
    const savedEnabled = localStorage.getItem(`ml-sync-enabled-${accountId}`);

    if (savedInterval) setSyncInterval(savedInterval);
    if (savedEnabled !== null) setIsEnabled(savedEnabled === 'true');

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
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

    // Salvar configurações
    localStorage.setItem(`ml-sync-interval-${accountId}`, syncInterval);
    localStorage.setItem(`ml-sync-enabled-${accountId}`, isEnabled.toString());

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isEnabled, syncInterval, accountId]);

  const loadAutoSyncStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/mercadolivre/auto-sync?accountId=${accountId}`);
      if (!response.ok) throw new Error('Erro ao carregar estatísticas');

      const data = await response.json();
      setStats(data.stats || {});
      setLastSync(data.lastSync);
      setLastSyncStatus(data.lastSyncStatus);
      setStaleProducts(data.staleProducts || 0);
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
      const response = await fetch('/api/mercadolivre/auto-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, syncType: 'auto' }),
      });

      if (!response.ok) throw new Error('Erro na sincronização');

      const result = await response.json();

      if (result.success) {
        toast.success(
          `Sincronização concluída! ${result.syncedCount} produtos atualizados em ${result.duration}s`
        );
        loadAutoSyncStats(); // Recarregar estatísticas
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

  const getTotalProducts = () => {
    return Object.values(stats).reduce((sum, count) => sum + (count || 0), 0);
  };

  const getSyncProgress = () => {
    const total = getTotalProducts();
    if (total === 0) return 0;
    return Math.round(((stats.synced || 0) / total) * 100);
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'synced':
        return <Badge variant="success" className="gap-1"><CheckCircle className="h-3 w-3" />Sucesso</Badge>;
      case 'error':
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Erro</Badge>;
      default:
        return <Badge variant="secondary">Desconhecido</Badge>;
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
      {/* Configurações */}
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
              <p className="text-sm text-gray-500">
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

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Produtos Sincronizados</p>
                <p className="text-2xl font-bold text-green-600">{stats.synced || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Com Erro</p>
                <p className="text-2xl font-bold text-red-600">{stats.error || 0}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Ignorados</p>
                <p className="text-2xl font-bold text-gray-600">{stats.ignored || 0}</p>
              </div>
              <Pause className="h-8 w-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Desatualizados</p>
                <p className="text-2xl font-bold text-orange-600">{staleProducts}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status da Sincronização */}
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
              <p className="text-sm text-gray-500 mb-1">Última Sincronização</p>
              <p className="font-medium">{formatTimeAgo(lastSync)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Status</p>
              {getStatusBadge(lastSyncStatus)}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm text-gray-500">Progresso Geral</p>
              <span className="text-sm font-medium">{getSyncProgress()}%</span>
            </div>
            <Progress value={getSyncProgress()} className="h-2" />
          </div>

          {staleProducts > 0 && (
            <Alert>
              <Timer className="h-4 w-4" />
              <AlertDescription>
                {staleProducts} produto(s) precisam de atualização.
                {isEnabled ? ` Próxima sincronização em ${syncInterval} minutos.` : ' Ative a sincronização automática.'}
              </AlertDescription>
            </Alert>
          )}

          {isEnabled && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Zap className="h-4 w-4" />
              <span>
                Sincronização automática ativa - Intervalo: {syncInterval} minutos
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Informações sobre Webhooks */}
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
                ✅ Os produtos vinculados são atualizados automaticamente via webhooks.<br/>
                ⏰ A sincronização automática serve como backup e para produtos não vinculados.
              </p>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}