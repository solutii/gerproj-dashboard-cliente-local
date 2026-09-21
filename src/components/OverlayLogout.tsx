'use client';

import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useLogoutStore } from '@/store/useLogoutStore';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { IoLogOut } from 'react-icons/io5';
import { IsLoading } from './IsLoading';
import { ZOOM_PAGINAS } from './loading-titles';

// Montado na raiz do app (ClientProviders): sobrevive à troca de página. Fica
// visível do clique em "Sair" até a tela de login de fato aparecer.
export function OverlayLogout() {
    const saindo = useLogoutStore((state) => state.saindo);
    const setSaindo = useLogoutStore((state) => state.setSaindo);
    const pathname = usePathname();
    const isDesktop = useIsDesktop();

    useEffect(() => {
        if (saindo && pathname === '/paginas/login') setSaindo(false);
    }, [saindo, pathname, setSaindo]);

    if (!saindo) return null;

    return (
        <div style={{ zoom: isDesktop ? ZOOM_PAGINAS : 1 }}>
            <IsLoading
                isLoading
                title="Encerrando sessão..."
                icon={<IoLogOut className="text-blue-600" size={60} />}
                fade={false}
            />
        </div>
    );
}
