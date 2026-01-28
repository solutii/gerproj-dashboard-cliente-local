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
            border: 'border-green-700',
            icon: '✓',
            ring: 'ring-green-300',
        },
        ALERTA: {
            bg: 'bg-yellow-500',
            border: 'border-yellow-700',
            icon: '⚠',
            ring: 'ring-yellow-300',
        },
        CRITICO: {
            bg: 'bg-orange-500',
            border: 'border-orange-700',
            icon: '⚠',
            ring: 'ring-orange-300',
        },
        VENCIDO: {
            bg: 'bg-red-600',
            border: 'border-red-800',
            icon: '✗',
            ring: 'ring-red-300',
        },
    };

    const config = statusConfig[sla.status] || {
        bg: 'bg-gray-400',
        border: 'border-gray-600',
        icon: '?',
        ring: 'ring-gray-300',
    };

    return (
        <div className="group relative flex cursor-help items-center justify-center">
            {/* Badge Principal */}
            <div
                className={`${config.bg} ${config.border} flex items-center gap-2 rounded-lg border-2 px-3 py-1.5 shadow-sm transition-all group-hover:scale-110 group-hover:shadow-md group-hover:${config.ring} group-hover:ring-2`}
            >
                <span className="text-sm font-bold text-white select-none">{config.icon}</span>
                <span className="text-xs font-semibold text-white select-none">
                    {sla.percentualUsado.toFixed(0)}%
                </span>
            </div>

            {/* Tooltip Rico */}
            <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 rounded-lg bg-black p-3 text-xs whitespace-nowrap text-white shadow-xl group-hover:block">
                <div className="space-y-1">
                    <div className="mb-1 border-b border-gray-700 pb-1 font-bold">
                        Status SLA: {sla.status}
                    </div>
                    <div>
                        <strong>Tempo Decorrido:</strong> {sla.tempoDecorrido.toFixed(1)}h
                    </div>
                    <div>
                        <strong>Tempo Restante:</strong> {sla.tempoRestante.toFixed(1)}h
                    </div>
                    <div>
                        <strong>Prazo Total:</strong> {sla.prazoTotal}h
                    </div>
                    <div className="mt-1 border-t border-gray-700 pt-1">
                        <strong>Utilização:</strong> {sla.percentualUsado.toFixed(1)}%
                    </div>
                </div>
                {/* Seta do tooltip */}
                <div className="absolute top-full left-1/2 -mt-1 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
            </div>
        </div>
    );
};
