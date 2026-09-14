// src/components/providers/AuthProvider.tsx
'use client';

import { useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const hydrate = useAuthStore((state) => state.hydrate);

    useEffect(() => {
        hydrate();
    }, [hydrate]);

    // Sem cookie de sessão válido, toda rota de API (exceto as públicas)
    // responde 401 agora (ver middleware.ts). Sem esse handler, uma sessão
    // expirada vira erros soltos na tela em vez de cair no login. Não existe
    // um wrapper de fetch compartilhado no projeto — o app inteiro usa
    // fetch() direto — então o jeito de cobrir todo chamado existente sem
    // editar dezenas de arquivos é interceptar window.fetch uma vez aqui.
    useEffect(() => {
        const fetchOriginal = window.fetch;

        window.fetch = async (...args) => {
            const response = await fetchOriginal(...args);

            const input = args[0];
            const url = typeof input === 'string' ? input : (input as Request).url;

            if (response.status === 401 && url.includes('/api/') && !url.includes('/api/login')) {
                window.location.href = '/paginas/login';
            }

            return response;
        };

        return () => {
            window.fetch = fetchOriginal;
        };
    }, []);

    return <>{children}</>;
}
