// src/app/paginas/sla/page.tsx

'use client';

import SLAConfigPanel from '@/components/sla/Painel_Configuracao';
import { useAuth } from '@/context/AuthContext';
import {
    AlertCircle,
    AlertTriangle,
    BarChart3,
    CheckCircle,
    Clock,
    Settings,
    TrendingUp,
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface MetricasSLA {
    totalChamados: number;
    dentroSLA: number;
    foraSLA: number;
    percentualCumprimento: number;
    tempoMedioResolucao: number;
    porPrioridade: Record<
        number,
        {
            total: number;
            dentroSLA: number;
            percentual: number;
        }
    >;
    resumoPorStatus?: {
        OK: number;
        ALERTA: number;
        CRITICO: number;
        VENCIDO: number;
    };
}

const SLADashboard = () => {
    const { isLoggedIn, isAdmin, loginType, codCliente } = useAuth();
    const [activeTab, setActiveTab] = useState<'dashboard' | 'config'>('dashboard');

    const [metricas, setMetricas] = useState<MetricasSLA | null>(null);
    const [loading, setLoading] = useState(true);
    const [mes, setMes] = useState(new Date().getMonth() + 1);
    const [ano, setAno] = useState(new Date().getFullYear());
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isLoggedIn || activeTab !== 'dashboard') {
            setLoading(false);
            return;
        }

        const fetchMetricas = async () => {
            setLoading(true);
            setError(null);

            try {
                const params = new URLSearchParams({
                    mes: String(mes),
                    ano: String(ano),
                    isAdmin: String(isAdmin),
                    tipo: 'detalhado',
                });

                if (!isAdmin && loginType === 'cliente' && codCliente) {
                    params.append('codCliente', codCliente);
                }

                console.log('[SLA Dashboard] Buscando dados:', {
                    url: `/api/chamados/sla?${params}`,
                    mes,
                    ano,
                    isAdmin,
                    codCliente,
                });

                const response = await fetch(`/api/chamados/sla?${params}`);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[SLA Dashboard] Erro HTTP:', response.status, errorText);
                    throw new Error(`Erro HTTP ${response.status}: ${errorText}`);
                }

                const result = await response.json();

                console.log('[SLA Dashboard] Resposta da API:', result);

                if (!result.success) {
                    throw new Error(result.error || result.message || 'Erro desconhecido');
                }

                const resumoPorStatus = {
                    OK: 0,
                    ALERTA: 0,
                    CRITICO: 0,
                    VENCIDO: 0,
                };

                if (result.data && Array.isArray(result.data)) {
                    result.data.forEach((chamado: any) => {
                        const status = chamado.sla?.resolucao?.status;
                        if (status && resumoPorStatus.hasOwnProperty(status)) {
                            resumoPorStatus[status as keyof typeof resumoPorStatus]++;
                        }
                    });
                }

                console.log('[SLA Dashboard] Resumo calculado:', resumoPorStatus);

                if (!result.metricas) {
                    console.warn('[SLA Dashboard] Métricas ausentes');
                    setMetricas({
                        totalChamados: result.totalChamados || 0,
                        dentroSLA: 0,
                        foraSLA: 0,
                        percentualCumprimento: 0,
                        tempoMedioResolucao: 0,
                        porPrioridade: {},
                        resumoPorStatus,
                    });
                } else {
                    setMetricas({
                        ...result.metricas,
                        resumoPorStatus,
                    });
                }
            } catch (err) {
                console.error('[SLA Dashboard] Erro:', err);
                setError(err instanceof Error ? err.message : 'Erro ao carregar métricas');
            } finally {
                setLoading(false);
            }
        };

        fetchMetricas();
    }, [mes, ano, isAdmin, loginType, codCliente, isLoggedIn, activeTab]);

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            OK: 'bg-green-500',
            ALERTA: 'bg-yellow-500',
            CRITICO: 'bg-orange-500',
            VENCIDO: 'bg-red-600',
        };
        return colors[status] || 'bg-gray-500';
    };

    const getPrioridadeLabel = (prior: number) => {
        const labels: Record<number, string> = {
            1: 'Crítica',
            2: 'Alta',
            3: 'Média',
            4: 'Baixa',
        };
        return labels[prior] || 'Normal';
    };

    if (!isLoggedIn) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50">
                <div className="max-w-md rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-center">
                    <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-yellow-500" />
                    <h2 className="mb-2 text-lg font-semibold text-gray-900">
                        Autenticação Necessária
                    </h2>
                    <p className="text-gray-700">
                        Você precisa estar logado para acessar as métricas de SLA.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Navegação por Abas */}
            <div className="border-b border-gray-200 bg-white shadow-sm">
                <div className="mx-auto max-w-7xl px-6">
                    <div className="flex gap-1">
                        <button
                            onClick={() => setActiveTab('dashboard')}
                            className={`flex items-center gap-2 border-b-2 px-6 py-4 font-medium transition-colors ${
                                activeTab === 'dashboard'
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <BarChart3 className="h-5 w-5" />
                            Dashboard
                        </button>
                        {isAdmin && (
                            <button
                                onClick={() => setActiveTab('config')}
                                className={`flex items-center gap-2 border-b-2 px-6 py-4 font-medium transition-colors ${
                                    activeTab === 'config'
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                <Settings className="h-5 w-5" />
                                Configurações
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Conteúdo */}
            {activeTab === 'config' ? (
                <SLAConfigPanel />
            ) : (
                <div className="p-6">
                    <div className="mx-auto max-w-7xl">
                        {/* Cabeçalho */}
                        <div className="mb-8">
                            <h1 className="mb-2 text-3xl font-bold text-gray-900">
                                Métricas de SLA
                            </h1>
                            <p className="text-gray-600">
                                Acompanhamento de Service Level Agreement
                                {!isAdmin && loginType === 'cliente' && ' - Visão do Cliente'}
                            </p>
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="text-center">
                                    <Clock className="mx-auto mb-4 h-12 w-12 animate-spin text-blue-500" />
                                    <p className="text-gray-600">Carregando métricas...</p>
                                </div>
                            </div>
                        ) : error ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6">
                                    <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
                                    <p className="mb-4 text-center text-red-700">{error}</p>
                                    <button
                                        onClick={() => window.location.reload()}
                                        className="w-full rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                                    >
                                        Tentar Novamente
                                    </button>
                                </div>
                            </div>
                        ) : !metricas || metricas.totalChamados === 0 ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="max-w-md rounded-lg border border-gray-200 bg-white p-6 text-center">
                                    <Clock className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                                    <h2 className="mb-2 text-lg font-semibold text-gray-900">
                                        Nenhum Dado Disponível
                                    </h2>
                                    <p className="text-gray-600">
                                        Não há chamados registrados para o período selecionado.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Filtros */}
                                <div className="mb-6 flex gap-4 rounded-lg bg-white p-4 shadow-sm">
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-gray-700">
                                            Mês
                                        </label>
                                        <select
                                            value={mes}
                                            onChange={(e) => setMes(Number(e.target.value))}
                                            className="rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                                        >
                                            {Array.from({ length: 12 }, (_, i) => i + 1).map(
                                                (m) => (
                                                    <option key={m} value={m}>
                                                        {new Date(2024, m - 1).toLocaleString(
                                                            'pt-BR',
                                                            {
                                                                month: 'long',
                                                            }
                                                        )}
                                                    </option>
                                                )
                                            )}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-gray-700">
                                            Ano
                                        </label>
                                        <select
                                            value={ano}
                                            onChange={(e) => setAno(Number(e.target.value))}
                                            className="rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                                        >
                                            {[2024, 2025, 2026].map((a) => (
                                                <option key={a} value={a}>
                                                    {a}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Cards principais */}
                                <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                                    <div className="rounded-lg bg-white p-6 shadow-sm">
                                        <div className="mb-2 flex items-center justify-between">
                                            <h3 className="text-sm font-medium text-gray-600">
                                                Total de Chamados
                                            </h3>
                                            <Clock className="h-5 w-5 text-gray-400" />
                                        </div>
                                        <p className="text-3xl font-bold text-gray-900">
                                            {metricas.totalChamados}
                                        </p>
                                    </div>

                                    <div className="rounded-lg bg-white p-6 shadow-sm">
                                        <div className="mb-2 flex items-center justify-between">
                                            <h3 className="text-sm font-medium text-gray-600">
                                                Dentro do SLA
                                            </h3>
                                            <CheckCircle className="h-5 w-5 text-green-500" />
                                        </div>
                                        <p className="text-3xl font-bold text-green-600">
                                            {metricas.dentroSLA}
                                        </p>
                                        <p className="mt-1 text-sm text-gray-500">
                                            {metricas.percentualCumprimento.toFixed(1)}% de
                                            cumprimento
                                        </p>
                                    </div>

                                    <div className="rounded-lg bg-white p-6 shadow-sm">
                                        <div className="mb-2 flex items-center justify-between">
                                            <h3 className="text-sm font-medium text-gray-600">
                                                Fora do SLA
                                            </h3>
                                            <AlertCircle className="h-5 w-5 text-red-500" />
                                        </div>
                                        <p className="text-3xl font-bold text-red-600">
                                            {metricas.foraSLA}
                                        </p>
                                        <p className="mt-1 text-sm text-gray-500">
                                            {metricas.totalChamados > 0
                                                ? (
                                                      (metricas.foraSLA / metricas.totalChamados) *
                                                      100
                                                  ).toFixed(1)
                                                : 0}
                                            % do total
                                        </p>
                                    </div>

                                    <div className="rounded-lg bg-white p-6 shadow-sm">
                                        <div className="mb-2 flex items-center justify-between">
                                            <h3 className="text-sm font-medium text-gray-600">
                                                Tempo Médio
                                            </h3>
                                            <TrendingUp className="h-5 w-5 text-blue-500" />
                                        </div>
                                        <p className="text-3xl font-bold text-gray-900">
                                            {metricas.tempoMedioResolucao.toFixed(1)}h
                                        </p>
                                        <p className="mt-1 text-sm text-gray-500">
                                            Resolução média
                                        </p>
                                    </div>
                                </div>

                                {/* Distribuição por Status */}
                                {metricas.resumoPorStatus && (
                                    <div className="mb-8 rounded-lg bg-white p-6 shadow-sm">
                                        <h3 className="mb-6 text-lg font-semibold text-gray-900">
                                            Distribuição por Status
                                        </h3>
                                        <div className="space-y-4">
                                            {Object.entries(metricas.resumoPorStatus).map(
                                                ([status, count]) => {
                                                    const percentual =
                                                        metricas.totalChamados > 0
                                                            ? (
                                                                  (count / metricas.totalChamados) *
                                                                  100
                                                              ).toFixed(1)
                                                            : '0.0';
                                                    return (
                                                        <div key={status}>
                                                            <div className="mb-2 flex items-center justify-between">
                                                                <span className="text-sm font-medium text-gray-700">
                                                                    {status}
                                                                </span>
                                                                <span className="text-sm text-gray-600">
                                                                    {count} ({percentual}%)
                                                                </span>
                                                            </div>
                                                            <div className="h-3 w-full rounded-full bg-gray-200">
                                                                <div
                                                                    className={`${getStatusColor(status)} h-3 rounded-full transition-all duration-500`}
                                                                    style={{
                                                                        width: `${percentual}%`,
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Métricas por Prioridade */}
                                <div className="rounded-lg bg-white p-6 shadow-sm">
                                    <h3 className="mb-6 text-lg font-semibold text-gray-900">
                                        Desempenho por Prioridade
                                    </h3>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                                        {Object.entries(metricas.porPrioridade).map(
                                            ([prior, dados]) => (
                                                <div
                                                    key={prior}
                                                    className="rounded-lg border border-gray-200 p-4"
                                                >
                                                    <div className="mb-3 flex items-center justify-between">
                                                        <h4 className="font-medium text-gray-900">
                                                            {getPrioridadeLabel(Number(prior))}
                                                        </h4>
                                                        {dados.percentual >= 90 ? (
                                                            <CheckCircle className="h-5 w-5 text-green-500" />
                                                        ) : dados.percentual >= 75 ? (
                                                            <AlertTriangle className="h-5 w-5 text-yellow-500" />
                                                        ) : (
                                                            <AlertCircle className="h-5 w-5 text-red-500" />
                                                        )}
                                                    </div>
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-gray-600">
                                                                Total:
                                                            </span>
                                                            <span className="font-medium">
                                                                {dados.total}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-gray-600">
                                                                Dentro SLA:
                                                            </span>
                                                            <span className="font-medium text-green-600">
                                                                {dados.dentroSLA}
                                                            </span>
                                                        </div>
                                                        <div className="mt-3 border-t border-gray-100 pt-3">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs text-gray-600">
                                                                    Taxa de sucesso
                                                                </span>
                                                                <span
                                                                    className={`text-lg font-bold ${
                                                                        dados.percentual >= 90
                                                                            ? 'text-green-600'
                                                                            : dados.percentual >= 75
                                                                              ? 'text-yellow-600'
                                                                              : 'text-red-600'
                                                                    }`}
                                                                >
                                                                    {dados.percentual.toFixed(1)}%
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>

                                {/* Legenda */}
                                <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
                                    <h4 className="mb-3 font-medium text-blue-900">
                                        Níveis de SLA
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                                        <div className="flex items-center gap-2">
                                            <div className="h-3 w-3 rounded-full bg-green-500" />
                                            <span className="text-gray-700">OK: &lt; 75%</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="h-3 w-3 rounded-full bg-yellow-500" />
                                            <span className="text-gray-700">Alerta: 75-90%</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="h-3 w-3 rounded-full bg-orange-500" />
                                            <span className="text-gray-700">Crítico: 90-100%</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="h-3 w-3 rounded-full bg-red-600" />
                                            <span className="text-gray-700">
                                                Vencido: &gt; 100%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SLADashboard;
