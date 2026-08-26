'use client';

import { LoadingRingSpinner } from '@/components/LoadingRingSpinner';
import { MetricInfoTooltip } from '@/components/MetricInfoTooltip';
import { formatarHoras } from '@/lib/sla/sla-utils';
import { useAuthStore } from '@/store/useAuthStore';
import { useQuery } from '@tanstack/react-query';
import { FaCheckCircle, FaClock, FaExclamationTriangle } from 'react-icons/fa';

// ==================== INTERFACES ====================
interface FilterProps {
    filters: {
        ano: number;
        mes: number;
        cliente: string;
        recurso: string;
        status: string;
    };
}

interface MetricasSLAResponse {
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
}

// ==================== SKELETON LOADING ====================
const SkeletonLoadingCard = () => (
    <div className="flex h-56 flex-col overflow-hidden rounded-xl border border-teal-200 bg-gradient-to-br from-white via-teal-50/30 to-teal-100/20 shadow-lg sm:h-64 lg:h-72">
        <div className="flex h-full items-center justify-center">
            <LoadingRingSpinner palette="teal-cyan" />
        </div>
    </div>
);

// ==================== COR POR PERCENTUAL ====================
function corCumprimento(percentual: number): { text: string; bar: string } {
    if (percentual >= 90) return { text: 'text-emerald-600', bar: 'bg-emerald-500' };
    if (percentual >= 70) return { text: 'text-amber-600', bar: 'bg-amber-500' };
    return { text: 'text-red-600', bar: 'bg-red-500' };
}

// ================================================================================
// COMPONENTE PRINCIPAL
// ================================================================================
export function CardSLAMetricas({ filters }: FilterProps) {
    const { codCliente } = useAuthStore();

    const fetchData = async (): Promise<MetricasSLAResponse> => {
        const params = new URLSearchParams();
        params.append('mes', filters.mes.toString());
        params.append('ano', filters.ano.toString());

        if (codCliente) params.append('codCliente', codCliente);
        if (filters.cliente) params.append('codClienteFilter', filters.cliente);
        if (filters.recurso) params.append('codRecursoFilter', filters.recurso);

        const response = await fetch(`/api/dashboard/sla-metricas?${params.toString()}`);

        if (!response.ok) {
            throw new Error(`Erro na requisição: ${response.status}`);
        }

        return response.json();
    };

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['slaMetricas', filters, codCliente],
        queryFn: fetchData,
        enabled: !!filters && codCliente !== null,
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false,
    });

    if (isLoading) return <SkeletonLoadingCard />;

    if (isError || !data) {
        return (
            <div className="flex h-56 cursor-not-allowed flex-col items-center justify-center rounded-xl border border-red-400 bg-red-100 shadow-md shadow-black sm:h-64 lg:h-72">
                <div className="flex flex-col items-center justify-center gap-2 p-2">
                    <FaExclamationTriangle className="text-red-500" size={24} />
                    <span className="text-center text-sm font-semibold tracking-widest text-red-700 select-none">
                        Erro ao carregar SLA
                    </span>
                    {error && (
                        <span className="max-w-xs text-center text-xs font-semibold tracking-widest text-red-700 select-none">
                            {error instanceof Error ? error.message : 'Erro desconhecido'}
                        </span>
                    )}
                </div>
            </div>
        );
    }

    const cor = corCumprimento(data.percentualCumprimento);
    const prioridades = Object.entries(data.porPrioridade).sort(
        ([a], [b]) => Number(a) - Number(b)
    );

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 relative duration-500">
            {/* === Título do Card === */}
            <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h1 className="text-base font-extrabold tracking-widest text-black select-none">
                        SLA — CUMPRIMENTO DE PRAZO
                    </h1>
                    <MetricInfoTooltip
                        accentColor="text-teal-600"
                        title="SLA — Cumprimento de Prazo"
                        description="Cada chamado tem um prazo de resolução definido pela prioridade, contado em horário comercial (dias úteis, sem feriados). 'Dentro do prazo' são os chamados resolvidos antes desse prazo vencer; o percentual mostra a proporção do total que cumpriu o prazo. O tempo médio de resolução considera só o tempo útil decorrido entre abertura e finalização. O detalhamento por prioridade mostra o mesmo cálculo separado por nível de urgência."
                    />
                </div>
            </div>

            {/* === Container === */}
            <div className="group relative flex h-56 flex-col overflow-hidden rounded-xl bg-white shadow-md shadow-black sm:h-64 lg:h-72">
                {/* Borda Superior */}
                <div className="absolute top-0 right-0 left-0 h-1 bg-teal-500" />

                <div className="flex h-full flex-col gap-4 p-4">
                    {data.totalChamados === 0 ? (
                        <div className="flex flex-1 items-center justify-center">
                            <span className="text-sm font-semibold tracking-widest text-gray-400 select-none">
                                Nenhum chamado no período
                            </span>
                        </div>
                    ) : (
                        <>
                            {/* Percentual principal */}
                            <div className="flex items-center gap-4">
                                <div className={`rounded-full border p-3 text-white ${cor.bar}`}>
                                    <FaCheckCircle size={20} />
                                </div>
                                <div className="flex flex-col">
                                    <span
                                        className={`text-3xl font-extrabold tracking-widest select-none ${cor.text}`}
                                    >
                                        {data.percentualCumprimento.toFixed(1)}%
                                    </span>
                                    <span className="text-xs font-semibold tracking-widest text-black select-none">
                                        {data.dentroSLA} de {data.totalChamados} dentro do prazo
                                    </span>
                                </div>
                            </div>

                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 shadow-xs shadow-black">
                                <div
                                    className={`h-full ${cor.bar} transition-all duration-1000 ease-out`}
                                    style={{
                                        width: `${Math.min(data.percentualCumprimento, 100)}%`,
                                    }}
                                />
                            </div>

                            {/* Tempo médio de resolução */}
                            <div className="flex items-center gap-3 rounded-md border-t border-gray-200 bg-gray-50 p-2">
                                <FaClock className="text-teal-600" size={16} />
                                <span className="text-sm font-semibold tracking-widest text-black select-none">
                                    Tempo médio de resolução:{' '}
                                    <span className="font-extrabold">
                                        {formatarHoras(data.tempoMedioResolucao)}
                                    </span>
                                </span>
                            </div>

                            {/* Breakdown por prioridade */}
                            {prioridades.length > 0 && (
                                <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto">
                                    {prioridades.map(([prioridade, info]) => (
                                        <div
                                            key={prioridade}
                                            className="flex items-center justify-between text-xs font-semibold tracking-widest text-black select-none"
                                        >
                                            <span>Prioridade {prioridade}</span>
                                            <span>
                                                {info.dentroSLA}/{info.total} (
                                                {info.percentual.toFixed(0)}%)
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
