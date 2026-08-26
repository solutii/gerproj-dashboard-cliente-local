// hooks/useClienteIA.ts

import { getClienteTokenHeaders } from '@/lib/auth/cliente-token-client';
import { useQuery } from '@tanstack/react-query';

interface ClienteIAResponse {
    success: boolean;
    exibe: boolean;
    conteudo: string | null;
}

const fetchClienteIA = async (codCliente: string): Promise<ClienteIAResponse> => {
    const response = await fetch(`/api/cliente-ia?codCliente=${encodeURIComponent(codCliente)}`, {
        headers: getClienteTokenHeaders(),
    });

    if (!response.ok) {
        throw new Error('Erro ao carregar dados de IA do cliente');
    }

    return response.json();
};

/**
 * Verifica se o cliente logado tem a IA habilitada (CLIENTE_EXIBE_IA) e busca
 * o conteúdo (CLIENTE_IA). Usa a mesma queryKey no Sidebar e na página de IA,
 * então o conteúdo já vem do cache do React Query ao navegar entre os dois.
 */
export function useClienteIA(codCliente: string | null) {
    return useQuery({
        queryKey: ['cliente-ia', codCliente],
        queryFn: () => fetchClienteIA(codCliente!),
        enabled: !!codCliente,
        staleTime: 5 * 60 * 1000,
    });
}
