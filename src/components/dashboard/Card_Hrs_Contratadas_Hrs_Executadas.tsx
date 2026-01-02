'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { FaCheckCircle, FaClock, FaExclamationTriangle } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { formatarHorasTotaisSufixo } from '../../formatters/formatar-hora';

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

interface ApiResponse {
    totalHorasContratadas: number;
    totalHorasExecutadas: number;
    detalhes: any[];
}

interface HorasBarProps {
    label: string;
    value: number;
    formattedValue: string;
    percentage: number;
    gradient: string;
    textColor: string;
    icon: React.ReactNode;
    statusIcon?: string;
    isOverLimit?: boolean;
}

// ==================== CONSTANTES ====================
const COLORS = {
    contratadas: {
        gradient: 'bg-gradient-to-r from-blue-500 to-indigo-600',
        text: 'text-blue-600',
    },
    executadasNormal: {
        gradient: 'bg-gradient-to-r from-blue-500 to-blue-600',
        text: 'text-blue-600',
    },
    executadasAbaixo: {
        gradient: 'bg-gradient-to-r from-emerald-500 to-emerald-600',
        text: 'text-emerald-600',
    },
    executadasAcima: {
        gradient: 'bg-gradient-to-r from-red-500 to-red-600',
        text: 'text-red-600',
    },
};

// ==================== COMPONENTE CONTADOR ANIMADO ====================
const AnimatedCounter = ({ value, duration = 1000 }: { value: number; duration?: number }) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let startTime: number | null = null;
        let animationFrame: number;

        const animate = (currentTime: number) => {
            if (!startTime) startTime = currentTime;
            const progress = Math.min((currentTime - startTime) / duration, 1);

            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            setCount(easeOutQuart * value);

            if (progress < 1) {
                animationFrame = requestAnimationFrame(animate);
            } else {
                setCount(value);
            }
        };

        animationFrame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrame);
    }, [value, duration]);

    return <>{formatarHorasTotaisSufixo(count)}</>;
};

// ==================== COMPONENTE BARRA DE HORAS ====================
const HorasBar = ({
    label,
    value,
    percentage,
    gradient,
    textColor,
    icon,
    statusIcon,
    isOverLimit = false,
}: HorasBarProps) => {
    return (
        <div className="group/bar w-full">
            {/* === Label e Valor === */}
            <div className="mb-2 flex items-center justify-between">
                {/* Label */}
                <div className="flex items-center gap-4">
                    <div className={`${gradient} rounded-full border p-2 text-white`}>{icon}</div>
                    {statusIcon && <span className="text-sm">{statusIcon}</span>}
                    <span className="text-sm font-semibold tracking-widest text-black uppercase select-none sm:text-sm">
                        {label}
                    </span>
                </div>
                {/* Valor */}
                <span className={`text-lg font-semibold tracking-widest select-none ${textColor}`}>
                    <AnimatedCounter value={value} />
                </span>
            </div>

            {/* === Barra de Progresso === */}
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-200 shadow-xs shadow-black transition-all group-hover/bar:h-3.5 sm:h-3.5">
                <div
                    className={`h-full rounded-full ${gradient} transition-all duration-1000 ease-out ${
                        isOverLimit ? 'animate-pulse' : ''
                    }`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                />
                {isOverLimit && (
                    <div className="absolute inset-0 animate-pulse rounded-full border-2 border-red-400"></div>
                )}
            </div>
        </div>
    );
};

// ==================== SKELETON LOADING ====================
const SkeletonLoadingCard = () => (
    <div className="flex h-32 flex-col overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-br from-white via-blue-50/30 to-blue-100/20 shadow-lg sm:h-36 lg:h-40">
        <div className="flex h-full items-center justify-center">
            <div className="relative h-20 w-20">
                {/* Círculo externo girando no sentido horário */}
                <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-blue-600 border-r-blue-400"></div>

                {/* Círculo interno girando no sentido anti-horário */}
                <div className="animate-spin-reverse absolute inset-2 rounded-full border-4 border-transparent border-b-indigo-600 border-l-indigo-400"></div>

                {/* Círculo central estático */}
                <div className="absolute inset-4 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-100">
                    <div className="h-6 w-6 animate-pulse rounded-full bg-gradient-to-br from-blue-500 to-indigo-500"></div>
                </div>
            </div>
        </div>

        {/* Adicionar animação CSS personalizada */}
        <style jsx>{`
            @keyframes spin-reverse {
                from {
                    transform: rotate(360deg);
                }
                to {
                    transform: rotate(0deg);
                }
            }
            .animate-spin-reverse {
                animation: spin-reverse 1s linear infinite;
            }
        `}</style>
    </div>
);

// ================================================================================
// COMPONENTE PRINCIPAL
// ================================================================================
export function CardHrsContratadasHrsExecutadas({ filters }: FilterProps) {
    const { isAdmin, codCliente } = useAuth();

    const fetchData = async (): Promise<ApiResponse> => {
        const params = new URLSearchParams();
        params.append('mes', filters.mes.toString());
        params.append('ano', filters.ano.toString());
        params.append('isAdmin', isAdmin.toString());

        if (!isAdmin && codCliente) {
            params.append('codCliente', codCliente);
        }

        if (filters.cliente) params.append('codClienteFilter', filters.cliente);
        if (filters.recurso) params.append('codRecursoFilter', filters.recurso);
        if (filters.status) params.append('status', filters.status);

        const response = await fetch(
            `/api/dashboard/hrs-contratadas-hrs-executadas?${params.toString()}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ [CARD HORAS] Erro na resposta:', response.status, errorText);
            throw new Error(`Erro na requisição: ${response.status}`);
        }

        return response.json();
    };

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['horasContratadasExecutadas', filters, isAdmin, codCliente],
        queryFn: fetchData,
        enabled: !!filters && (isAdmin || codCliente !== null),
        staleTime: 1000 * 60 * 5, // 5 minutos
        refetchOnWindowFocus: false,
    });

    if (isLoading) {
        return <SkeletonLoadingCard />;
    }

    if (isError || !data) {
        return (
            <div>
                <div className="flex h-32 cursor-not-allowed flex-col items-center justify-center rounded-xl border border-red-400 bg-red-100 shadow-md shadow-black sm:h-36 lg:h-40">
                    <div className="flex flex-col items-center justify-center gap-2 p-2">
                        <FaExclamationTriangle className="text-red-500" size={24} />
                        <span className="text-center text-sm font-semibold tracking-widest text-red-700 select-none sm:text-sm">
                            Erro ao carregar os dados
                        </span>
                        {error && (
                            <span className="max-w-xs text-center text-sm font-semibold tracking-widest text-red-700 select-none sm:text-xs">
                                {error instanceof Error ? error.message : 'Erro desconhecido'}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const totalHorasContratadas = data.totalHorasContratadas || 0;
    const totalHorasExecutadas = data.totalHorasExecutadas || 0;
    const percentual =
        totalHorasContratadas > 0 ? (totalHorasExecutadas / totalHorasContratadas) * 100 : 0;
    const diferenca = totalHorasExecutadas - totalHorasContratadas;

    const getExecutadasConfig = () => {
        if (diferenca > 0.5) {
            return {
                gradient: COLORS.executadasAcima.gradient,
                textColor: COLORS.executadasAcima.text,
                statusIcon: '⚠️',
                isOverLimit: true,
            };
        }
        if (diferenca < -0.5) {
            return {
                gradient: COLORS.executadasAbaixo.gradient,
                textColor: COLORS.executadasAbaixo.text,
                statusIcon: '✅',
                isOverLimit: false,
            };
        }
        return {
            gradient: COLORS.executadasNormal.gradient,
            textColor: COLORS.executadasNormal.text,
            statusIcon: '📊',
            isOverLimit: false,
        };
    };

    const executadasConfig = getExecutadasConfig();

    const horasData = [
        {
            label: 'Contratadas',
            value: totalHorasContratadas,
            formattedValue: formatarHorasTotaisSufixo(totalHorasContratadas),
            percentage: 100,
            gradient: COLORS.contratadas.gradient,
            textColor: COLORS.contratadas.text,
            icon: <FaClock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />,
        },
        {
            label: 'Executadas',
            value: totalHorasExecutadas,
            formattedValue: formatarHorasTotaisSufixo(totalHorasExecutadas),
            percentage: percentual,
            gradient: executadasConfig.gradient,
            textColor: executadasConfig.textColor,
            icon: <FaCheckCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3" />,
            isOverLimit: executadasConfig.isOverLimit,
        },
    ];

    // ================================================================================
    // RENDERIZAÇÃO PRINCIPAL
    // ================================================================================
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* === Título do Card === */}
            <div className="mb-2 flex items-center justify-between">
                <h1 className="text-base font-extrabold tracking-widest text-black select-none">
                    HORAS CONTRATADAS × EXECUTADAS
                </h1>
            </div>

            {/* === Container === */}
            <div className="group relative flex h-72 flex-col overflow-hidden rounded-xl bg-white shadow-md shadow-black">
                {/* Borda Superior */}
                <div className="absolute top-0 right-0 left-0 h-1 bg-cyan-500"></div>

                {/* Body do Card */}
                <div className="flex h-full flex-col justify-between gap-4 p-6">
                    {/* Barras de Horas */}
                    <div className="flex flex-col gap-10">
                        {horasData.map((hora, index) => (
                            <HorasBar key={index} {...hora} />
                        ))}
                    </div>

                    {/* Linha Divisória */}
                    <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-gray-400 to-transparent"></div>

                    {/* Label, Percentual e Diferença de Horas */}
                    <div className="flex items-center justify-between">
                        {/* Label */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold tracking-widest text-black uppercase select-none">
                                Utilização
                            </span>
                        </div>
                        {/* Percentual e Diferença de Horas */}
                        <div className="flex items-center gap-2">
                            {/* Percentual */}
                            <span
                                className={`text-base font-semibold tracking-widest select-none ${executadasConfig.textColor}`}
                            >
                                {percentual.toFixed(1)}%
                            </span>
                            {/* Diferença de horas */}
                            {diferenca !== 0 && (
                                <span
                                    className={`text-sm font-semibold tracking-widest select-none ${executadasConfig.textColor}`}
                                >
                                    ({diferenca > 0 ? '+' : ''}
                                    {formatarHorasTotaisSufixo(Math.abs(diferenca))})
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
