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

/**
 * Retorna as classes CSS para o badge do SLA baseado no status
 */
const getSLABadgeStyles = (status: 'OK' | 'ALERTA' | 'CRITICO' | 'VENCIDO'): string => {
    const styles = {
        OK: 'bg-green-500 border border-green-600 text-black shadow-sm shadow-black',
        ALERTA: 'bg-yellow-500 border border-yellow-600 text-black shadow-sm shadow-black',
        CRITICO: 'bg-orange-500 border border-orange-600 text-white shadow-sm shadow-black',
        VENCIDO: 'bg-red-500 border border-red-600 text-white shadow-sm shadow-black',
    };

    return styles[status];
};

export const SLACell: React.FC<SLACellProps> = ({
    dataChamado,
    horaChamado,
    prioridade,
    statusChamado,
    dataInicioAtendimento,
}) => {
    // Se não tiver início de atendimento, não mostra nada
    if (!dataInicioAtendimento) {
        return (
            <div className="text-center text-sm font-semibold tracking-widest text-gray-400 select-none">
                ---------------
            </div>
        );
    }

    // Hook mantido com toda a lógica original intacta
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

    const badgeStyles = getSLABadgeStyles(sla.status);

    return (
        <div className="flex items-center justify-center">
            <div
                className={`w-full rounded px-3 py-1.5 text-center text-sm font-extrabold tracking-widest select-none ${badgeStyles}`}
                title={`Status: ${sla.status} | Percentual: ${sla.percentualUsado.toFixed(1)}% | Tempo Restante: ${formatarTempoHorasMinutos(sla.tempoRestante)}`}
            >
                {formatarTempoHorasMinutos(sla.tempoDecorrido)}
            </div>
        </div>
    );
};
