// hooks/useHorasAdicionais.ts

import type {
    HorasAdicionaisChamado,
    HorasAdicionaisMap,
} from '@/app/api/chamados/horas-adicionais/route';
import { useEffect, useRef, useState } from 'react';

interface UseHorasAdicionaisOptions {
    codChamados: number[];
    enabled?: boolean;
}

interface UseHorasAdicionaisReturn {
    horasAdicionaisMap: HorasAdicionaisMap;
    getHorasAdicionais: (codChamado: number) => HorasAdicionaisChamado | null;
    isLoading: boolean;
    error: string | null;
}

/**
 * Busca horas adicionais agregadas (adicional gerado + total equivalente)
 * para todos os chamados da tabela de uma vez.
 * Mesmo padrão de cache e batching do useHorasPorMes.
 */
export function useHorasAdicionais({
    codChamados,
    enabled = true,
}: UseHorasAdicionaisOptions): UseHorasAdicionaisReturn {
    const [horasAdicionaisMap, setHorasAdicionaisMap] = useState<HorasAdicionaisMap>({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const cacheRef = useRef<HorasAdicionaisMap>({});
    const fetchedIdsRef = useRef<Set<number>>(new Set());
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (!enabled || codChamados.length === 0) return;

        const novoIds = codChamados.filter((id) => !fetchedIdsRef.current.has(id));
        if (novoIds.length === 0) return;

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const fetchHoras = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const BATCH_SIZE = 500;
                const batches: number[][] = [];
                for (let i = 0; i < novoIds.length; i += BATCH_SIZE) {
                    batches.push(novoIds.slice(i, i + BATCH_SIZE));
                }

                const results = await Promise.all(
                    batches.map((batch) =>
                        fetch(`/api/chamados/horas-adicionais?ids=${batch.join(',')}`, {
                            signal: controller.signal,
                        }).then((res) => {
                            if (!res.ok) throw new Error(`HTTP ${res.status}`);
                            return res.json() as Promise<{
                                success: boolean;
                                data: HorasAdicionaisMap;
                            }>;
                        })
                    )
                );

                for (const result of results) {
                    if (result.success) {
                        Object.assign(cacheRef.current, result.data);
                    }
                }

                novoIds.forEach((id) => fetchedIdsRef.current.add(id));
                setHorasAdicionaisMap({ ...cacheRef.current });
            } catch (err) {
                if ((err as Error).name === 'AbortError') return;
                console.error('[useHorasAdicionais] Erro:', err);
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
        codChamados.join(','),
        enabled,
    ]);

    const getHorasAdicionais = (codChamado: number): HorasAdicionaisChamado | null =>
        horasAdicionaisMap[codChamado] ?? null;

    return { horasAdicionaisMap, getHorasAdicionais, isLoading, error };
}
