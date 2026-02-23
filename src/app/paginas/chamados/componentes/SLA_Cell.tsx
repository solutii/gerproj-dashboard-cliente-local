// src/app/paginas/chamados/componentes/SLA_Cell.tsx

'use client';

import { formatarHorasTotaisSufixo } from '@/formatters/formatar-hora';
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
        OK: 'bg-green-300 border border-green-500 text-black',
        ALERTA: 'bg-yellow-300 border border-yellow-500 text-black',
        CRITICO: 'bg-orange-300 border border-orange-500 text-black',
        VENCIDO: 'bg-red-300 border border-red-500 text-black',
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
    // Se não tiver data de início de atendimento, não mostra nada
    if (!dataInicioAtendimento) {
        return (
            <div className="text-center text-sm font-semibold tracking-widest text-black select-none">
                ==========
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
            <div className="text-center text-sm font-semibold tracking-widest text-black select-none">
                ==========
            </div>
        );
    }

    const badgeStyles = getSLABadgeStyles(sla.status);

    return (
        <div className="flex items-center justify-center">
            <div
                className={`w-full cursor-help rounded py-1.5 text-center text-sm font-extrabold tracking-widest select-none ${badgeStyles}`}
                title="Tempo decorrido, do momento que o chamado é aberto, até o início do atendimento."
            >
                {formatarHorasTotaisSufixo(sla.tempoDecorrido)}
            </div>
        </div>
    );
};
