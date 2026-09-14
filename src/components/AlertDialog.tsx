// src/components/AlertDialog.tsx
//
// Renderiza o diálogo centralizado controlado por useAlertDialogStore.
// Montado uma única vez em ClientProvider — chame via alertSuccess/
// alertError/alertWarning/alertInfo/alertConfirm (src/store/useAlertDialogStore.ts),
// nunca renderize isso diretamente numa tela.
'use client';

import { useAlertDialogStore, type AlertDialogType } from '@/store/useAlertDialogStore';
import { IoAlertCircle, IoCheckmarkCircle, IoInformationCircle, IoWarning } from 'react-icons/io5';

const CONFIG: Record<
    AlertDialogType,
    { icon: typeof IoCheckmarkCircle; color: string; bg: string; button: string }
> = {
    success: {
        icon: IoCheckmarkCircle,
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
        button: 'from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600',
    },
    error: {
        icon: IoAlertCircle,
        color: 'text-red-600',
        bg: 'bg-red-50',
        button: 'from-red-600 to-red-700 hover:from-red-500 hover:to-red-600',
    },
    warning: {
        icon: IoWarning,
        color: 'text-amber-600',
        bg: 'bg-amber-50',
        button: 'from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600',
    },
    info: {
        icon: IoInformationCircle,
        color: 'text-blue-600',
        bg: 'bg-blue-50',
        button: 'from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600',
    },
};

export function AlertDialog() {
    const isOpen = useAlertDialogStore((state) => state.isOpen);
    const options = useAlertDialogStore((state) => state.options);
    const handleConfirm = useAlertDialogStore((state) => state.handleConfirm);
    const handleCancel = useAlertDialogStore((state) => state.handleCancel);

    if (!isOpen || !options) return null;

    const {
        type,
        title,
        message,
        confirmText = 'OK',
        cancelText = 'Cancelar',
        showCancel,
    } = options;
    const { icon: Icon, color, bg, button } = CONFIG[type];

    return (
        <div className="animate-in fade-in fixed inset-0 z-[200] flex items-center justify-center p-4 transition-all duration-200 ease-out">
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={showCancel ? handleCancel : handleConfirm}
            />

            <div className="animate-in slide-in-from-bottom-4 relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-xl transition-all duration-200 ease-out">
                <div className="flex flex-col items-center gap-3 px-6 pt-8 pb-4 text-center">
                    <div
                        className={`flex h-14 w-14 items-center justify-center rounded-full ${bg}`}
                    >
                        <Icon className={color} size={32} />
                    </div>
                    {title && (
                        <h2 className="text-lg font-extrabold tracking-wide text-black select-none">
                            {title}
                        </h2>
                    )}
                    <p className="text-sm font-medium text-gray-600">{message}</p>
                </div>

                <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
                    {showCancel && (
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="flex-1 cursor-pointer rounded-md bg-gray-100 px-4 py-2 text-sm font-bold text-gray-700 transition-all duration-150 select-none hover:bg-gray-200 active:scale-95"
                        >
                            {cancelText}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className={`flex-1 cursor-pointer rounded-md bg-gradient-to-br px-4 py-2 text-sm font-bold text-white shadow-sm shadow-black/20 transition-all duration-150 select-none active:scale-95 ${button}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
