// src/hooks/useSLADinamico.ts
'use client';

import { calcularStatusSLA, isDentroHorarioComercial, SLAStatus } from '@/lib/sla/sla-utils';
import { useEffect, useState } from 'react';

// ==================== CACHE DE FERIADOS ====================
// Cache em módulo para não refazer fetch a cada instância do hook

interface FeriadosCache {
    feriados: string[];
    year: number;
    fetchedAt: number;
}

const feriadosCacheRef: { current: FeriadosCache | null } = { current: null };
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

async function getFeriados(year: number): Promise<string[]> {
    const cache = feriadosCacheRef.current;

    // Retorna cache se ainda válido e mesmo ano
    if (cache && cache.year === year && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
        return cache.feriados;
    }

    try {
        const response = await fetch(`/api/feriados?year=${year}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data: { year: number; feriados: string[] } = await response.json();

        feriadosCacheRef.current = {
            feriados: data.feriados,
            year: data.year,
            fetchedAt: Date.now(),
        };

        return data.feriados;
    } catch (error) {
        console.warn('[useSLADinamico] Falha ao buscar feriados, usando lista vazia:', error);
        return [];
    }
}

// ==================== HOOK PRINCIPAL ====================

/**
 * Hook para calcular SLA com atualização automática e suporte a feriados.
 *
 * Os feriados são buscados uma vez via /api/feriados e cacheados em memória
 * por 24h para não sobrecarregar a API.
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
    // Estado (não ref) — precisa disparar o recálculo do SLA abaixo assim
    // que os feriados chegarem, senão o primeiro cálculo de cada chamado
    // roda com a lista vazia e só corrige no próximo tick do intervalo.
    const [feriados, setFeriados] = useState<string[]>([]);

    // Carrega feriados do ano do chamado
    useEffect(() => {
        if (!dataChamado) return;

        let cancelado = false;
        const data = typeof dataChamado === 'string' ? new Date(dataChamado) : dataChamado;
        const year = data.getFullYear();

        getFeriados(year).then((feriadosCarregados) => {
            if (!cancelado) setFeriados(feriadosCarregados);
        });

        return () => {
            cancelado = true;
        };
    }, [dataChamado]);

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
                    'resolucao',
                    feriados // ✅ passa feriados carregados
                );

                setSLA(slaCalculado);
            } catch (error) {
                console.error('[useSLADinamico] Erro ao calcular SLA:', error);
                setSLA(null);
            }
        };

        atualizarSLA();

        // Se tem data de conclusão, não precisa de intervalo
        if (dataInicioAtendimento) return;

        const agora = new Date();

        if (isDentroHorarioComercial(agora, undefined, feriados)) {
            // Dentro do horário comercial: atualiza no intervalo definido
            const intervalo = setInterval(atualizarSLA, intervalMs);
            return () => clearInterval(intervalo);
        }

        // Fora do horário: verifica a cada 5min se voltou ao horário comercial
        const intervaloChecagem = setInterval(
            () => {
                const agora = new Date();
                if (isDentroHorarioComercial(agora, undefined, feriados)) {
                    atualizarSLA();
                }
            },
            5 * 60 * 1000
        );

        return () => clearInterval(intervaloChecagem);
    }, [
        dataChamado,
        horaChamado,
        prioridade,
        statusChamado,
        dataInicioAtendimento,
        intervalMs,
        feriados,
    ]);

    return sla;
}
