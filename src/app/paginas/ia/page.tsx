// src/app/paginas/ia/page.tsx

'use client';

import { useClienteIA } from '@/hooks/useClienteIA';
import { useAuthStore } from '@/store/useAuthStore';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LayoutPaginaIA } from './Layout_Pagina_IA';

export default function IAPage() {
    const { codCliente } = useAuthStore();
    const router = useRouter();
    const { data, isLoading, isError } = useClienteIA(codCliente);

    useEffect(() => {
        // Guarda contra acesso direto pela URL quando a IA não está habilitada
        if (!isLoading && (isError || !data?.exibe)) {
            router.replace('/paginas/dashboard');
        }
    }, [isLoading, isError, data, router]);

    if (isLoading || !data?.exibe) {
        return (
            <LayoutPaginaIA>
                <div className="flex h-full w-full items-center justify-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-200 border-t-purple-700" />
                </div>
            </LayoutPaginaIA>
        );
    }

    return (
        <LayoutPaginaIA>
            {data.conteudo ? (
                <div
                    className="h-full w-full [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:rounded-xl [&_iframe]:border-0"
                    dangerouslySetInnerHTML={{ __html: data.conteudo }}
                />
            ) : (
                <div className="flex h-full w-full items-center justify-center text-lg font-semibold tracking-widest text-gray-500 select-none">
                    Conteúdo não configurado.
                </div>
            )}
        </LayoutPaginaIA>
    );
}
