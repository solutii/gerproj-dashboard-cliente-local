// src/store/useAlertDialogStore.ts
//
// Store global do <AlertDialog /> (mensagem centralizada na tela, com ou
// sem confirmação) — substitui toast/window.confirm nos fluxos que
// precisam de uma resposta mais explícita do usuário do que um toast
// passageiro. O componente que renderiza fica em
// src/components/AlertDialog.tsx, montado uma única vez em ClientProvider.
import { create } from 'zustand';

export type AlertDialogType = 'success' | 'error' | 'warning' | 'info';

export interface AlertDialogOptions {
    type: AlertDialogType;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    showCancel?: boolean;
}

interface AlertDialogStore {
    isOpen: boolean;
    options: AlertDialogOptions | null;
    // Resolve a Promise devolvida por `open()` — só é usado de fato pelos
    // diálogos de confirmação (showCancel: true); nos demais, o valor
    // resolvido é sempre `true` e ninguém aguarda a Promise.
    resolver: ((confirmed: boolean) => void) | null;
    open: (options: AlertDialogOptions) => Promise<boolean>;
    handleConfirm: () => void;
    handleCancel: () => void;
}

export const useAlertDialogStore = create<AlertDialogStore>((set, get) => ({
    isOpen: false,
    options: null,
    resolver: null,

    open: (options) => {
        return new Promise<boolean>((resolve) => {
            set({ isOpen: true, options, resolver: resolve });
        });
    },

    handleConfirm: () => {
        const { resolver } = get();
        set({ isOpen: false });
        resolver?.(true);
    },

    handleCancel: () => {
        const { resolver } = get();
        set({ isOpen: false });
        resolver?.(false);
    },
}));

// ==================== API imperativa (uso fora de componentes React) ====================
// Mesmo espírito do `toast.success(...)` do react-hot-toast: chama de
// qualquer lugar (handler, função utilitária), sem precisar de hook.

// Retornam a Promise de fechamento — útil quando a tela precisa fazer algo
// só depois do usuário clicar OK (ex: fechar o próprio modal de origem),
// mas ignorar o retorno (fire-and-forget) também é válido.

export function alertSuccess(message: string, title = 'Sucesso'): Promise<boolean> {
    return useAlertDialogStore
        .getState()
        .open({ type: 'success', title, message, showCancel: false });
}

export function alertError(message: string, title = 'Erro'): Promise<boolean> {
    return useAlertDialogStore
        .getState()
        .open({ type: 'error', title, message, showCancel: false });
}

export function alertWarning(message: string, title = 'Atenção'): Promise<boolean> {
    return useAlertDialogStore
        .getState()
        .open({ type: 'warning', title, message, showCancel: false });
}

export function alertInfo(message: string, title = 'Informação'): Promise<boolean> {
    return useAlertDialogStore.getState().open({ type: 'info', title, message, showCancel: false });
}

/** Substitui window.confirm — resolve `true` (confirmou) ou `false` (cancelou/fechou fora). */
export function alertConfirm(
    message: string,
    opts?: {
        title?: string;
        type?: AlertDialogType;
        confirmText?: string;
        cancelText?: string;
    }
): Promise<boolean> {
    return useAlertDialogStore.getState().open({
        type: opts?.type ?? 'warning',
        title: opts?.title ?? 'Confirmação',
        message,
        confirmText: opts?.confirmText ?? 'Confirmar',
        cancelText: opts?.cancelText ?? 'Cancelar',
        showCancel: true,
    });
}
