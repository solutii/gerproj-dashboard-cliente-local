// src/hooks/useSLADinamico.ts
'use client';

import { calcularStatusSLA, isDentroHorarioComercial, SLAStatus } from '@/lib/sla/sla-utils';
import { useEffect, useState } from 'react';

/**
 * Hook para calcular SLA com atualização automática
 */
export function useSLADinamico(
    dataChamado: Date | string | null,
    horaChamado: string | null,
    prioridade: number,
    statusChamado: string,
    dataInicioAtendimento?: Date | string | null,
    intervalMs: number = 60000
): SLAStatus | null {
    const [sla, setSLA] = useState<SLAStatus | null>(null);

    useEffect(() => {
        if (!dataChamado || !horaChamado) {
            setSLA(null);
            return;
        }

        const atualizarSLA = () => {
            try {
                const data = typeof dataChamado === 'string' ? new Date(dataChamado) : dataChamado;

                const inicioAtendimento = dataInicioAtendimento
                    ? typeof dataInicioAtendimento === 'string'
                        ? new Date(dataInicioAtendimento)
                        : dataInicioAtendimento
                    : null;

                const slaCalculado = calcularStatusSLA(
                    data,
                    horaChamado,
                    prioridade,
                    statusChamado,
                    inicioAtendimento,
                    'resolucao'
                );

                setSLA(slaCalculado);
            } catch (error) {
                console.error('[useSLADinamico] Erro ao calcular SLA:', error);
                setSLA(null);
            }
        };

        atualizarSLA();

        if (dataInicioAtendimento) {
            return;
        }

        const agora = new Date();
        if (isDentroHorarioComercial(agora)) {
            const intervalo = setInterval(atualizarSLA, intervalMs);
            return () => clearInterval(intervalo);
        }

        const intervaloChecagem = setInterval(
            () => {
                const agora = new Date();
                if (isDentroHorarioComercial(agora)) {
                    atualizarSLA();
                }
            },
            5 * 60 * 1000
        );

        return () => clearInterval(intervaloChecagem);
    }, [dataChamado, horaChamado, prioridade, statusChamado, dataInicioAtendimento, intervalMs]);

    return sla;
}

export function useDeveMostrarSLA(
    statusChamado: string,
    dataInicioAtendimento?: Date | string | null
): boolean {
    return true;
}
