// hooks/useHorasPorMes.ts

import type { HorasMes, HorasPorChamadoMap } from '@/app/api/chamados/horas-por-mes/route';
import { useEffect, useRef, useState } from 'react';

interface UseHorasPorMesOptions {
    /** IDs dos chamados visíveis na tabela */
    codChamados: number[];
    /** Não dispara o fetch se false (ex: chamado sem OS) */
    enabled?: boolean;
}

interface UseHorasPorMesReturn {
    /** Map completo: { [codChamado]: HorasMes[] } */
    horasMap: HorasPorChamadoMap;
    /** Retorna os meses de um chamado específico */
    getHoras: (codChamado: number) => HorasMes[];
    isLoading: boolean;
    error: string | null;
}

/**
 * Busca horas faturadas por mês para todos os chamados da tabela de uma vez.
 * Mantém cache entre re-renders e só re-fetcha se os IDs mudarem.
 */
export function useHorasPorMes({
    codChamados,
    enabled = true,
}: UseHorasPorMesOptions): UseHorasPorMesReturn {
    const [horasMap, setHorasMap] = useState<HorasPorChamadoMap>({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Cache persistente entre re-renders — não limpo em re-fetch
    // Acumula IDs já buscados para evitar requests duplicados
    const cacheRef = useRef<HorasPorChamadoMap>({});
    const fetchedIdsRef = useRef<Set<number>>(new Set());
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (!enabled || codChamados.length === 0) return;

        // Filtra apenas IDs ainda não buscados
        const novoIds = codChamados.filter((id) => !fetchedIdsRef.current.has(id));

        if (novoIds.length === 0) return;

        // Cancela fetch anterior se ainda estiver pendente
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const fetchHoras = async () => {
            setIsLoading(true);
            setError(null);

            try {
                // Processa em batches de 500 (limite da API)
                const BATCH_SIZE = 500;
                const batches: number[][] = [];
                for (let i = 0; i < novoIds.length; i += BATCH_SIZE) {
                    batches.push(novoIds.slice(i, i + BATCH_SIZE));
                }

                const results = await Promise.all(
                    batches.map((batch) =>
                        fetch(`/api/chamados/horas-por-mes?ids=${batch.join(',')}`, {
                            signal: controller.signal,
                        }).then((res) => {
                            if (!res.ok) throw new Error(`HTTP ${res.status}`);
                            return res.json() as Promise<{
                                success: boolean;
                                data: HorasPorChamadoMap;
                            }>;
                        })
                    )
                );

                // Mescla todos os batches no cache
                for (const result of results) {
                    if (result.success) {
                        Object.assign(cacheRef.current, result.data);
                    }
                }

                // Marca IDs como fetched (inclusive os que não tinham OS — ficam vazios no map)
                novoIds.forEach((id) => fetchedIdsRef.current.add(id));

                // Atualiza state com cópia do cache completo
                setHorasMap({ ...cacheRef.current });
            } catch (err) {
                if ((err as Error).name === 'AbortError') return;
                console.error('[useHorasPorMes] Erro:', err);
                setError(err instanceof Error ? err.message : 'Erro desconhecido');
            } finally {
                setIsLoading(false);
            }
        };

        fetchHoras();

        return () => {
            abortRef.current?.abort();
        };
    }, [
        // Reexecuta apenas se o conjunto de IDs mudar (ex: virar de página)
        // eslint-disable-next-line react-hooks/exhaustive-deps
        codChamados.join(','),
        enabled,
    ]);

    const getHoras = (codChamado: number): HorasMes[] => horasMap[codChamado] ?? [];

    return { horasMap, getHoras, isLoading, error };
}
