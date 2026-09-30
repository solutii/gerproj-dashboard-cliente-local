// src/app/paginas/chamados/componentes/SLA_Cell.tsx

'use client';

import { formatarHorasRelogio } from '@/formatters/formatar-hora';
import { useSLADinamico } from '@/hooks/useSLADinamico';
import React from 'react';

interface SLACellProps {
    dataChamado: Date | string;
    horaChamado: string;
    prioridade: number;
    statusChamado: string;
    dataInicioAtendimento?: Date | string | null;
}

const getSLABadgeStyles = (status: 'OK' | 'ALERTA' | 'CRITICO' | 'VENCIDO'): string => {
    const styles = {
        OK: 'border-green-500 bg-green-500 text-green-950 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.7),inset_0_-2px_2px_rgba(21,128,61,0.35),0_1px_1px_rgba(21,128,61,0.3),0_8px_20px_-5px_rgba(21,128,61,0.6)]',
        ALERTA: 'border-yellow-500 bg-yellow-500 text-yellow-950 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.7),inset_0_-2px_2px_rgba(161,98,7,0.35),0_1px_1px_rgba(161,98,7,0.3),0_8px_20px_-5px_rgba(161,98,7,0.6)]',
        CRITICO:
            'border-orange-500 bg-orange-500 text-orange-950 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.7),inset_0_-2px_2px_rgba(194,65,12,0.35),0_1px_1px_rgba(194,65,12,0.3),0_8px_20px_-5px_rgba(194,65,12,0.6)]',
        VENCIDO:
            'border-red-500 bg-red-500 text-white shadow-[inset_0_1.5px_0_rgba(255,255,255,0.7),inset_0_-2px_2px_rgba(185,28,28,0.35),0_1px_1px_rgba(185,28,28,0.3),0_8px_20px_-5px_rgba(185,28,28,0.6)]',
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
    // Hook deve ser chamado antes de qualquer return condicional (Rules of Hooks)
    const sla = useSLADinamico(
        dataChamado,
        horaChamado,
        prioridade,
        statusChamado,
        dataInicioAtendimento,
        60000
    );

    if (!dataInicioAtendimento) {
        return (
            <div className="text-center text-base font-extrabold tracking-wide text-black select-none">
                ==========
            </div>
        );
    }

    if (!sla) {
        return (
            <div className="text-center text-base font-extrabold tracking-wide text-black select-none">
                ==========
            </div>
        );
    }

    const badgeStyles = getSLABadgeStyles(sla.status);

    return (
        <div className="flex items-center justify-center">
            <div
                className={`w-full cursor-help rounded border py-1.5 text-center text-base font-extrabold tracking-wide select-none ${badgeStyles}`}
                title="Tempo decorrido, do momento que o chamado é aberto, até o início do atendimento."
            >
                {formatarHorasRelogio(sla.tempoDecorrido)}
            </div>
        </div>
    );
};
