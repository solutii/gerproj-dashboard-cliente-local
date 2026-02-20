import { AlertCircle } from 'lucide-react';
import { BsFillXOctagonFill } from 'react-icons/bs';
import { MdHome, MdRefresh } from 'react-icons/md';

interface ErrorOverlayProps {
    isError: boolean;
    error: Error;
    title: string;
    onRetry?: () => void; // Função para tentar novamente
    showHomeButton?: boolean; // Mostrar botão de voltar ao início
}

export function IsError({
    isError,
    error,
    title,
    onRetry,
    showHomeButton = true,
}: ErrorOverlayProps) {
    if (!isError) return null;

    const mensagem = error.message || 'Erro desconhecido';

    const handleGoHome = () => {
        window.location.href = '/';
    };

    const handleRetry = () => {
        if (onRetry) {
            onRetry();
        } else {
            window.location.reload();
        }
    };

    return (
        <div className="animate-in fade-in fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm duration-200">
            <div className="flex flex-col items-center justify-center gap-6">
                <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-200 via-red-400 to-red-600 opacity-20 blur-xl"></div>

                    <div className="relative flex items-center justify-center">
                        <AlertCircle className="text-red-600" size={160} />

                        <div className="absolute inset-0 flex items-center justify-center">
                            <BsFillXOctagonFill className="text-red-600" size={60} />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col items-center justify-center gap-4">
                    <h1 className="text-3xl font-extrabold tracking-widest text-white select-none">
                        {title}
                    </h1>

                    <div className="flex flex-col items-center justify-center gap-2">
                        <span className="text-xl font-semibold tracking-widest text-white select-none">
                            Oops... Algo deu errado!
                        </span>
                        <span className="text-lg font-bold tracking-wider text-red-400 italic select-none">
                            {mensagem}
                        </span>
                    </div>
                </div>

                {/* Botões de Ação */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleRetry}
                        className="flex items-center gap-2 rounded-md border border-blue-900 bg-blue-600 px-6 py-3 text-base font-bold tracking-widest text-white shadow-lg shadow-black transition-all duration-200 hover:scale-105 hover:bg-blue-700 active:scale-95"
                    >
                        <MdRefresh size={24} />
                        Tentar Novamente
                    </button>

                    {showHomeButton && (
                        <button
                            onClick={handleGoHome}
                            className="flex items-center gap-2 rounded-md border border-gray-600 bg-gray-700 px-6 py-3 text-base font-bold tracking-widest text-white shadow-lg shadow-black transition-all duration-200 hover:scale-105 hover:bg-gray-600 active:scale-95"
                        >
                            <MdHome size={24} />
                            Voltar ao Início
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
