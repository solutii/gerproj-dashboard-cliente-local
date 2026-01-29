// src/components/chamados/SLACell.tsx
'use client';

import { useSLADinamico } from '@/hooks/useSLADinamico';
import React from 'react';

interface SLACellProps {
    dataChamado: Date | string;
    horaChamado: string;
    prioridade: number;
    statusChamado: string;
    dataConclusao?: Date | string | null;
}

export const SLACell: React.FC<SLACellProps> = ({
    dataChamado,
    horaChamado,
    prioridade,
    statusChamado,
    dataConclusao,
}) => {
    // Hook que atualiza automaticamente a cada 1 minuto
    const sla = useSLADinamico(
        dataChamado,
        horaChamado,
        prioridade,
        statusChamado,
        dataConclusao,
        60000 // 1 minuto
    );

    // Não mostra SLA para chamados finalizados
    if (statusChamado?.toUpperCase() === 'FINALIZADO' || !sla) {
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
    };

    return (
        <div className="group relative flex cursor-help items-center justify-center">
            {/* Badge Principal */}
            <div className={`${config.bg} ${config.border} rounded px-4 py-0.5 ${config.shadow}`}>
                <span
                    className={`${config.text} text-center font-extrabold tracking-widest select-none`}
                >
                    {sla.percentualUsado.toFixed(0)}%
                </span>
            </div>

            {/* Tooltip Rico */}
            <div className="pointer-events-none absolute bottom-full left-3/2 z-50 hidden -translate-x-1/2 space-y-1 rounded-lg border bg-white px-4 py-2 text-sm tracking-widest whitespace-nowrap text-slate-800 shadow-xl shadow-black select-none group-hover:block">
                <div
                    className={`mb-1 border-b border-black pb-1 text-center text-base font-extrabold ${config.textTooltip}`}
                >
                    {sla.status}
                </div>
                <div className="font-semibold">
                    Tempo Decorrido: {sla.tempoDecorrido.toFixed(1)}h
                </div>
                <div className="font-semibold">Tempo Restante: {sla.tempoRestante.toFixed(1)}h</div>
                <div className="font-semibold">Prazo Total: {sla.prazoTotal}h</div>
            </div>
        </div>
    );
};
