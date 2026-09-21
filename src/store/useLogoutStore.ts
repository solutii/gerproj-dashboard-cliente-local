import { create } from 'zustand';

// Sinaliza que um logout iniciado pelo usuário está em andamento, para o
// overlay de "Encerrando sessão" (montado na raiz do app) ficar visível até a
// tela de login carregar. Fica fora do useAuthStore de propósito: o logout()
// zera o estado de auth e as páginas logadas somem na hora, mas o overlay
// precisa sobreviver a isso.
interface LogoutStore {
    saindo: boolean;
    setSaindo: (saindo: boolean) => void;
}

export const useLogoutStore = create<LogoutStore>((set) => ({
    saindo: false,
    setSaindo: (saindo) => set({ saindo }),
}));
