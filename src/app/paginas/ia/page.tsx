// src/app/paginas/ia/page.tsx

'use client';

import { useClienteIA } from '@/hooks/useClienteIA';
import { useAuthStore } from '@/store/useAuthStore';
import DOMPurify from 'dompurify';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { LayoutPaginaIA } from './Layout_Pagina_IA';

// O conteúdo vem de um campo administrado no Firebird (CLIENTE.CLIENTE_IA)
// e pode conter <iframe> propositalmente (embeds de dashboards externos) —
// por isso a allowlist inclui iframe/atributos de embed, além dos padrões
// do DOMPurify.
const SANITIZE_CONFIG = {
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'target'],
};

export default function IAPage() {
    const { codCliente } = useAuthStore();
    const router = useRouter();
    const { data, isLoading, isError } = useClienteIA(codCliente);

    const conteudoSeguro = useMemo(() => {
        // DOMPurify precisa de um DOM real — no SSR (typeof window === 'undefined')
        // não roda; o conteúdo só existe após o fetch client-side de qualquer forma.
        if (!data?.conteudo || typeof window === 'undefined') return null;
        return DOMPurify.sanitize(data.conteudo, SANITIZE_CONFIG);
    }, [data?.conteudo]);

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
            {conteudoSeguro ? (
                <div
                    className="h-full w-full [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:rounded-xl [&_iframe]:border-0"
                    dangerouslySetInnerHTML={{ __html: conteudoSeguro }}
                />
            ) : (
                <div className="flex h-full w-full items-center justify-center text-lg font-semibold tracking-widest text-gray-500 select-none">
                    Conteúdo não configurado.
                </div>
            )}
        </LayoutPaginaIA>
    );
}
