'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { FaExclamationTriangle, FaTasks, FaTicketAlt } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { formatarHorasTotaisSufixo } from '../../formatters/formatar-hora';

interface FilterProps {
    filters: {
        ano: number;
        mes: number;
        cliente: string;
        recurso: string;
        status: string;
    };
}

interface MediasResponse {
    MEDIA_HRS_POR_CHAMADO: number;
    MEDIA_HRS_POR_TAREFA: number;
    TOTAL_CHAMADOS_COM_HORAS: number;
    TOTAL_TAREFAS_COM_HORAS: number;
}

interface MediaCardProps {
    label: string;
    value: number;
    icon: React.ReactNode;
    gradient: string;
    textGradient: string;
    total: number;
    totalLabel: string;
}

// =================== CONSTANTES ====================
const COLORS = {
    chamado: {
        gradient: 'bg-gradient-to-r from-cyan-500 to-blue-500',
        text: 'bg-gradient-to-r from-cyan-600 via-blue-600 to-cyan-600 bg-clip-text text-transparent',
        accent: 'from-cyan-500 via-blue-500 to-cyan-500',
    },
    tarefa: {
        gradient: 'bg-gradient-to-r from-purple-500 to-pink-500',
        text: 'bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 bg-clip-text text-transparent',
        accent: 'from-purple-500 via-pink-500 to-purple-500',
    },
};

// =================== COMPONENTE CONTADOR ANIMADO ====================
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

// =================== COMPONENTE NÚMERO ANIMADO ====================
const AnimatedNumber = ({ value, duration = 1000 }: { value: number; duration?: number }) => {
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

// =================== COMPONENTE CARD DE MÉDIA ====================
const MediaCard = ({
    label,
    value,
    icon,
    gradient,
    textGradient,
    total,
    totalLabel,
}: MediaCardProps) => {
    return (
        <div className="flex w-full flex-col items-center gap-2">
            {/* Ícone e Label */}
            <div className="flex items-center gap-2">
                <div className={`${gradient} rounded-full border p-2 text-white`}>{icon}</div>
                <span className="text-sm font-semibold tracking-widest text-black uppercase select-none">
                    {label}
                </span>
            </div>

            {/* Valor Principal */}
            <div className="flex flex-col items-center">
                <span
                    className={`text-2xl font-black tracking-widest select-none sm:text-3xl ${textGradient}`}
                >
                    {value !== null && value !== undefined ? (
                        <AnimatedCounter value={value} />
                    ) : (
                        '--'
                    )}
                </span>
            </div>
        </div>
    );
};

// =================== SKELETON LOADING ====================
const SkeletonLoadingCard = () => (
    <div className="flex h-32 flex-col overflow-hidden rounded-xl border border-cyan-200 bg-gradient-to-br from-white via-cyan-50/30 to-cyan-100/20 shadow-lg sm:h-36 lg:h-40">
        <div className="flex h-full items-center justify-center">
            <div className="relative h-20 w-20">
                {/* Círculo externo girando no sentido horário */}
                <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-cyan-600 border-r-cyan-400"></div>

                {/* Círculo interno girando no sentido anti-horário */}
                <div className="animate-spin-reverse absolute inset-2 rounded-full border-4 border-transparent border-b-blue-600 border-l-blue-400"></div>

                {/* Círculo central estático */}
                <div className="absolute inset-4 flex items-center justify-center rounded-full bg-gradient-to-br from-cyan-100 to-blue-100">
                    <div className="h-6 w-6 animate-pulse rounded-full bg-gradient-to-br from-cyan-500 to-blue-500"></div>
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
export function CardMediaHorasChamado({ filters }: FilterProps) {
    const { isAdmin, codCliente } = useAuth();

    const fetchData = async (): Promise<MediasResponse> => {
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
            `/api/dashboard/media-hrs-chamado-tarefa?${params.toString()}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ [CARD MÉDIAS] Erro na resposta:', response.status, errorText);
            throw new Error(`Erro na requisição: ${response.status}`);
        }

        return response.json();
    };

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['mediasHoras', filters, isAdmin, codCliente],
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

    const mediasData = [
        {
            label: 'Média por Chamado',
            value: data.MEDIA_HRS_POR_CHAMADO || 0,
            icon: <FaTicketAlt className="h-2.5 w-2.5 sm:h-3 sm:w-3" />,
            gradient: COLORS.chamado.gradient,
            textGradient: COLORS.chamado.text,
            total: data.TOTAL_CHAMADOS_COM_HORAS || 0,
            totalLabel: 'Chamados',
        },
        {
            label: 'Média por Tarefa',
            value: data.MEDIA_HRS_POR_TAREFA || 0,
            icon: <FaTasks className="h-2.5 w-2.5 sm:h-3 sm:w-3" />,
            gradient: COLORS.tarefa.gradient,
            textGradient: COLORS.tarefa.text,
            total: data.TOTAL_TAREFAS_COM_HORAS || 0,
            totalLabel: 'Tarefas',
        },
    ];

    // ================================================================================
    // RENDERIZAÇÃO PRINCIPAL
    // ================================================================================
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-2 flex items-center justify-between">
                <h1 className="text-base font-semibold tracking-widest text-black select-none">
                    MÉDIA DE HORAS
                </h1>
            </div>

            <div className="group relative flex h-70 flex-col overflow-hidden rounded-xl bg-white shadow-md shadow-black">
                {/* Gradient accent line */}
                <div className="absolute top-0 right-0 left-0 h-1 bg-purple-500"></div>

                {/* Container Principal */}
                <div className="flex h-full items-center justify-center gap-4 p-4">
                    {/* Grid com duas colunas */}
                    <div className="grid w-full grid-cols-2 gap-4">
                        {mediasData.map((media, index) => (
                            <div key={index} className="flex flex-col items-center">
                                <MediaCard {...media} />
                            </div>
                        ))}
                    </div>

                    {/* Divider vertical no meio */}
                    <div className="absolute top-4 bottom-4 left-1/2 w-[2px] -translate-x-1/2 bg-gradient-to-b from-transparent via-gray-400 to-transparent"></div>
                </div>
            </div>
        </div>
    );
}
