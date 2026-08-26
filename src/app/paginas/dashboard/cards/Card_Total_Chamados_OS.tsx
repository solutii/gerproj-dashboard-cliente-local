'use client';

import { LoadingRingSpinner } from '@/components/LoadingRingSpinner';
import { getClienteTokenHeaders } from '@/lib/auth/cliente-token-client';
import { useAuthStore } from '@/store/useAuthStore';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
    FaCheckCircle,
    FaClock,
    FaExclamationTriangle,
    FaHourglassHalf,
    FaInfoCircle,
    FaPlay,
} from 'react-icons/fa';

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

interface TotalizadoresAPIResponse {
    TOTAL_CHAMADOS: number;
    TOTAL_OS: number;
    CHAMADOS_FINALIZADO: number;
    CHAMADOS_STANDBY: number;
    CHAMADOS_EM_ATENDIMENTO: number;
    CHAMADOS_AGUARDANDO_VALIDACAO: number;
    CHAMADOS_ATRIBUIDO: number;
}

interface StatusCardProps {
    label: string;
    value: number;
    gradient: string;
    textGradient: string;
    icon: React.ReactNode;
    isHighlight?: boolean;
}

// ==================== CONSTANTES ====================
const COLORS = {
    finalizado: {
        gradient: 'bg-gradient-to-r from-green-600 to-emerald-600',
        text: 'bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent',
        hover: 'hover:from-green-700 hover:to-emerald-700',
    },
    total: {
        gradient: 'bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600',
        text: 'bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600 bg-clip-text text-transparent',
        hover: 'hover:from-purple-700 hover:via-blue-700 hover:to-purple-700',
    },
    atendimento: {
        gradient: 'bg-gradient-to-r from-blue-600 to-cyan-600',
        text: 'bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent',
        hover: 'hover:from-blue-700 hover:to-cyan-700',
    },
    standby: {
        gradient: 'bg-gradient-to-r from-yellow-600 to-amber-600',
        text: 'bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent',
        hover: 'hover:from-yellow-700 hover:to-amber-700',
    },
    validacao: {
        gradient: 'bg-gradient-to-r from-orange-600 to-red-600',
        text: 'bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent',
        hover: 'hover:from-orange-700 hover:to-red-700',
    },
    atribuido: {
        gradient: 'bg-gradient-to-r from-purple-600 to-pink-600',
        text: 'bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent',
        hover: 'hover:from-purple-700 hover:to-pink-700',
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
            setCount(Math.floor(easeOutQuart * value));

            if (progress < 1) {
                animationFrame = requestAnimationFrame(animate);
            } else {
                setCount(value);
            }
        };

        animationFrame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrame);
    }, [value, duration]);

    return <>{count}</>;
};

// ==================== COMPONENTE STATUS CARD ====================
const StatusCard = ({
    label,
    value,
    gradient,
    textGradient,
    icon,
    isHighlight = false,
}: StatusCardProps) => {
    return (
        <div className="flex w-full min-w-0 flex-col items-center gap-1 rounded-xl p-2">
            {/* === Ícone e Label === */}
            <div className="flex w-full min-w-0 items-center justify-center gap-2">
                {/* Ícone */}
                <div className={`${gradient} shrink-0 rounded-full border p-2 text-white`}>
                    {icon}
                </div>
                {/* Label */}
                <span className="min-w-0 truncate text-xs font-semibold tracking-widest text-black uppercase select-none sm:text-sm">
                    {label}
                </span>
            </div>

            {/* === Valor === */}
            <div className="flex flex-col items-center gap-1">
                <span
                    className={`text-xl font-extrabold tracking-widest select-none ${textGradient} ${
                        isHighlight ? 'text-2xl sm:text-4xl' : ''
                    }`}
                >
                    <AnimatedCounter value={value} />
                </span>
            </div>
        </div>
    );
};

// ==================== SKELETON LOADING ====================
const SkeletonLoadingCard = () => (
    <div className="flex h-56 flex-col overflow-hidden rounded-xl border border-purple-200 bg-gradient-to-br from-white via-purple-50/30 to-purple-100/20 shadow-lg sm:h-64 lg:h-72">
        <div className="flex h-full items-center justify-center">
            <LoadingRingSpinner palette="purple-blue" />
        </div>
    </div>
);

// ================================================================================
// COMPONENTE PRINCIPAL
// ================================================================================
export function CardTotalChamadosOS({ filters }: FilterProps) {
    const { codCliente } = useAuthStore();

    const fetchData = async (): Promise<TotalizadoresAPIResponse> => {
        const params = new URLSearchParams();
        params.append('mes', filters.mes.toString());
        params.append('ano', filters.ano.toString());

        if (codCliente) {
            params.append('codCliente', codCliente);
        }

        if (filters.cliente) params.append('codClienteFilter', filters.cliente);
        if (filters.recurso) params.append('codRecursoFilter', filters.recurso);
        if (filters.status) params.append('status', filters.status);

        const response = await fetch(`/api/dashboard/total-chamados-os?${params.toString()}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...getClienteTokenHeaders(),
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ [CARD TOTALIZADORES] Erro na resposta:', response.status, errorText);
            throw new Error(`Erro na requisição: ${response.status}`);
        }

        return response.json();
    };

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['totalizadoresChamados', filters, codCliente],
        queryFn: fetchData,
        enabled: !!filters && !!codCliente,
        staleTime: 1000 * 60 * 5, // 5 minutos
        refetchOnWindowFocus: false,
    });

    if (isLoading) {
        return <SkeletonLoadingCard />;
    }

    if (isError || !data) {
        return (
            <div>
                <div className="flex h-32 cursor-not-allowed flex-col items-center justify-center rounded-xl border border-red-400 bg-red-100 shadow-md shadow-black">
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

    const statusDataTop = [
        {
            label: 'Total Chamados',
            value: data.TOTAL_CHAMADOS ?? 0,
            gradient: COLORS.total.gradient,
            textGradient: COLORS.total.text,
            icon: <FaInfoCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />,
            isHighlight: true,
        },
        {
            label: 'Atribuídos',
            value: data.CHAMADOS_ATRIBUIDO ?? 0,
            gradient: COLORS.atribuido.gradient,
            textGradient: COLORS.atribuido.text,
            icon: <FaExclamationTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />,
        },
        {
            label: 'Em Atendimento',
            value: data.CHAMADOS_EM_ATENDIMENTO ?? 0,
            gradient: COLORS.atendimento.gradient,
            textGradient: COLORS.atendimento.text,
            icon: <FaPlay className="h-3 w-3 sm:h-3.5 sm:w-3.5" />,
        },
    ];

    const statusDataBottom = [
        {
            label: 'Standby',
            value: data.CHAMADOS_STANDBY ?? 0,
            gradient: COLORS.standby.gradient,
            textGradient: COLORS.standby.text,
            icon: <FaHourglassHalf className="h-3 w-3 sm:h-3.5 sm:w-3.5" />,
        },
        {
            label: 'Aguard. Validação',
            value: data.CHAMADOS_AGUARDANDO_VALIDACAO ?? 0,
            gradient: COLORS.validacao.gradient,
            textGradient: COLORS.validacao.text,
            icon: <FaClock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />,
        },
        {
            label: 'Finalizados',
            value: data.CHAMADOS_FINALIZADO ?? 0,
            gradient: COLORS.finalizado.gradient,
            textGradient: COLORS.finalizado.text,
            icon: <FaCheckCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />,
        },
    ];

    // ================================================================================
    // RENDERIZAÇÃO PRINCIPAL
    // ================================================================================
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* === Título do Card  === */}
            <div className="mb-2 flex items-center justify-between">
                <h1 className="text-base font-extrabold tracking-widest text-black select-none">
                    TOTAL DE CHAMADOS POR STATUS
                </h1>
            </div>

            {/* === Container === */}
            <div className="group relative flex h-56 flex-col overflow-hidden rounded-xl bg-white shadow-md shadow-black sm:h-64 lg:h-72">
                {/* Borda Superior */}
                <div className="absolute top-0 right-0 left-0 h-1 bg-lime-500"></div>

                {/* Body do Card */}
                <div className="flex h-full flex-col justify-between gap-3 px-4 pt-4 pb-5">
                    {/* Linha Superior: Total Chamados | Atribuídos | Em Atendimento */}
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {statusDataTop.map((status, index) => (
                            <StatusCard key={index} {...status} />
                        ))}
                    </div>

                    {/* Linha Divisória */}
                    <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-gray-400 to-transparent"></div>

                    {/* Linha Inferior: Standby | Aguard. Validação | Finalizados */}
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {statusDataBottom.map((status, index) => (
                            <StatusCard key={index} {...status} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
