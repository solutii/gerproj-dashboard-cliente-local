// src/app/paginas/chamados/componentes/SLA_Cell.tsx

'use client';

import { useSLADinamico } from '@/hooks/useSLADinamico';
import React from 'react';

interface SLACellProps {
    dataChamado: Date | string;
    horaChamado: string;
    prioridade: number;
    statusChamado: string;
    dataInicioAtendimento?: Date | string | null;
}

/**
 * Formata horas decimais para o formato "Xh:Ymin"
 * @param horas - Valor em horas (exemplo: 1.5 = 1h:30min)
 * @returns String formatada (exemplo: "1h:30min")
 */
const formatarTempoHorasMinutos = (horas: number): string => {
    const horasInteiras = Math.floor(horas);
    const minutos = Math.round((horas - horasInteiras) * 60);

    if (horasInteiras === 0 && minutos === 0) {
        return '0min';
    }

    if (horasInteiras === 0) {
        return `${minutos}min`;
    }

    if (minutos === 0) {
        return `${horasInteiras}h`;
    }

    return `${horasInteiras}h:${minutos}min`;
};

export const SLACell: React.FC<SLACellProps> = ({
    dataChamado,
    horaChamado,
    prioridade,
    statusChamado,
    dataInicioAtendimento,
}) => {
    // Hook que atualiza automaticamente a cada 1 minuto (apenas se não tiver início de atendimento)
    const sla = useSLADinamico(
        dataChamado,
        horaChamado,
        prioridade,
        statusChamado,
        dataInicioAtendimento,
        60000
    );

    if (!sla) {
        return (
            <div className="text-center text-sm font-semibold tracking-widest text-gray-400 select-none">
                ---------------
            </div>
        );
    }

    // Configuração de cores por status
    const statusConfig = {
        OK: {
            bg: 'bg-green-500',
            border: 'border border-green-600',
            shadow: 'shadow-sm shadow-black',
            textTooltip: 'text-green-600',
            text: 'text-black',
        },
        ALERTA: {
            bg: 'bg-yellow-500',
            border: 'border border-yellow-600',
            shadow: 'shadow-sm shadow-black',
            textTooltip: 'text-yellow-600',
            text: 'text-black',
        },
        CRITICO: {
            bg: 'bg-orange-500',
            border: 'border border-orange-600',
            shadow: 'shadow-sm shadow-black',
            textTooltip: 'text-orange-600',
            text: 'text-white',
        },
        VENCIDO: {
            bg: 'bg-red-500',
            border: 'border border-red-600',
            shadow: 'shadow-sm shadow-black',
            textTooltip: 'text-red-600',
            text: 'text-white',
        },
    };

    const config = statusConfig[sla.status] || {
        bg: 'bg-gray-500',
        border: 'border border-gray-600',
        shadow: 'shadow-sm shadow-black',
        textTooltip: 'text-gray-600',
        text: 'text-black',
    };

    const slaCongelado = !!dataInicioAtendimento;

    return (
        <div className="group relative flex cursor-help items-center justify-center">
            {/* Badge Principal */}
            <div
                className={`${config.bg} ${config.border} rounded px-4 py-0.5 ${config.shadow} relative`}
            >
                <span
                    className={`${config.text} text-center font-extrabold tracking-widest select-none`}
                >
                    {sla.percentualUsado.toFixed(0)}%
                </span>
                {/* Indicador visual de SLA congelado */}
                {slaCongelado && (
                    <div
                        className="absolute -top-1 -right-1 h-2 w-2 rounded-full border border-white bg-blue-500"
                        title="SLA calculado até o início do atendimento"
                    />
                )}
            </div>

            {/* Tooltip Rico */}
            <div className="pointer-events-none absolute bottom-full left-3/2 z-50 hidden -translate-x-1/2 space-y-1 rounded-lg border bg-white px-4 py-2 text-sm tracking-widest whitespace-nowrap text-slate-800 shadow-xl shadow-black select-none group-hover:block">
                <div
                    className={`mb-1 border-b border-black pb-1 text-center text-base font-extrabold ${config.textTooltip}`}
                >
                    {sla.status}
                    {slaCongelado && ' (Atendido)'}
                </div>
                <div className="font-semibold">
                    Tempo Decorrido: {formatarTempoHorasMinutos(sla.tempoDecorrido)}
                </div>
                <div className="font-semibold">
                    Tempo Restante: {formatarTempoHorasMinutos(sla.tempoRestante)}
                </div>
                <div className="font-semibold">
                    Prazo Total: {formatarTempoHorasMinutos(sla.prazoTotal)}
                </div>
                {slaCongelado && (
                    <div className="mt-2 border-t border-gray-300 pt-1 text-xs font-semibold text-blue-600">
                        ✓ Calculado até início do atendimento
                    </div>
                )}
            </div>
        </div>
    );
};
