'use client';

import { useAuthStore } from '@/store/useAuthStore';
import { useFiltersStore } from '@/store/useFiltersStore';
import { useLogoutStore } from '@/store/useLogoutStore';
import { useRouter } from 'next/navigation';

/** Encerra a sessão e leva para o login, mostrando o overlay até a tela carregar. */
export function useSair() {
    const router = useRouter();
    const logout = useAuthStore((state) => state.logout);
    const clearFilters = useFiltersStore((state) => state.clearFilters);
    const setSaindo = useLogoutStore((state) => state.setSaindo);

    return () => {
        setSaindo(true);
        logout();
        clearFilters();
        router.push('/paginas/login');
    };
}
