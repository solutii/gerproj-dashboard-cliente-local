// src/components/chamados/modais/Modal_Avaliar_Chamado.tsx

'use client';

import { Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { IoClose } from 'react-icons/io5';
import { MdMiscellaneousServices, MdSend } from 'react-icons/md';

interface ModalAvaliacaoChamadoProps {
    isOpen: boolean;
    onClose: () => void;
    codChamado: number;
    assuntoChamado: string | null;
    solicitacaoChamado: string | null;
    observacaoChamado?: string | null;
    onSave: () => void;
}

// Função para remover acentos
export const removerAcentos = (texto: string): string => {
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

// Função para capitalizar a primeira letra
const capitalizarPrimeiraLetra = (texto: string): string => {
    if (!texto) return texto;
    return texto.charAt(0).toUpperCase() + texto.slice(1);
};

// ================================================================================
// COMPONENTE PRINCIPAL
// ================================================================================
export function ModalAvaliarChamado({
    isOpen,
    onClose,
    codChamado,
    assuntoChamado,
    solicitacaoChamado,
    observacaoChamado,
    onSave,
}: ModalAvaliacaoChamadoProps) {
    const [nota, setNota] = useState(0);
    const [hoveredStar, setHoveredStar] = useState(0);
    const [observacao, setObservacao] = useState(observacaoChamado || '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && observacaoChamado) {
            setObservacao(capitalizarPrimeiraLetra(observacaoChamado));
        }
    }, [isOpen, observacaoChamado]);

    const handleSubmit = async () => {
        if (nota === 0) {
            setError('Por favor, selecione uma nota');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            // Remove acentos da observação antes de enviar
            const observacaoSemAcentos = observacao.trim()
                ? removerAcentos(observacao.trim())
                : null;

            const response = await fetch(`/api/chamados/${codChamado}/avaliacao`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    avaliacao: nota,
                    observacao: observacaoSemAcentos,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro ao salvar avaliação');
            }

            onSave();
            toast.success('Avaliação salva com sucesso!', { duration: 3000 });
            setTimeout(() => {
                handleClose();
            }, 3500);
        } catch (err) {
            console.error('Erro ao salvar avaliação:', err);
            setError(err instanceof Error ? err.message : 'Erro ao salvar avaliação');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setNota(0);
        setHoveredStar(0);
        setObservacao('');
        setError(null);
        onClose();
    };

    // Handler para capitalizar a primeira letra ao digitar
    const handleObservacaoChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const texto = e.target.value;
        setObservacao(capitalizarPrimeiraLetra(texto));
    };

    const getNotaTexto = (n: number) => {
        switch (n) {
            case 1:
                return 'Muito Insatisfeito';
            case 2:
                return 'Insatisfeito';
            case 3:
                return 'Regular';
            case 4:
                return 'Satisfeito';
            case 5:
                return 'Muito Satisfeito';
            default:
                return 'Selecione uma nota';
        }
    };

    if (!isOpen) return null;

    // ================================================================================
    // RENDERIZAÇÃO PRINCIPAL
    // ================================================================================
    return (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center p-2 transition-all duration-200 ease-out">
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* Modal Content */}
            <div className="animate-in slide-in-from-bottom-4 relative z-10 flex w-7xl flex-col overflow-hidden rounded-xl bg-white transition-all duration-200 ease-out">
                {/* Header */}
                <header className="relative flex flex-shrink-0 items-center justify-between bg-teal-700 p-4 shadow-md shadow-black">
                    <div className="flex items-center gap-6">
                        <MdMiscellaneousServices className="flex-shrink-0 text-white" size={60} />
                        <div className="flex flex-col gap-1 tracking-widest text-white select-none">
                            <h1 className="text-2xl font-extrabold">AVALIAR ATENDIMENTO</h1>
                            <p className="text-base font-semibold">
                                {`Chamado #${codChamado}`} - Sua opinião é muito importante para
                                nós!
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="group flex-shrink-0 cursor-pointer rounded-full border border-red-700 bg-red-500 p-2 shadow-md shadow-black transition-all duration-200 hover:scale-125 hover:shadow-xl hover:shadow-black active:scale-95"
                        aria-label="Fechar modal"
                    >
                        <IoClose
                            className="text-white group-hover:scale-125 group-active:scale-95"
                            size={20}
                        />
                    </button>
                </header>

                {/* Body */}
                <div className="flex flex-col gap-6 px-6 py-6 pb-10">
                    {/* Informações do Chamado */}
                    <div className="mb-10 flex flex-col gap-6">
                        <div className="flex max-h-32 flex-col gap-2 overflow-y-auto rounded-md border bg-gray-200 p-4 text-justify text-base tracking-widest text-black shadow-sm shadow-black select-none">
                            <p className="font-bold">Assunto:</p>
                            <p className="ml-4 text-sm font-semibold">
                                {assuntoChamado || 'Sem assunto'}
                            </p>
                        </div>
                        <div className="flex max-h-32 flex-col gap-2 overflow-y-auto rounded-md border bg-gray-200 p-4 text-justify text-base tracking-widest text-black shadow-sm shadow-black select-none">
                            <p className="font-bold">Solicitação:</p>
                            <p className="ml-4 text-sm font-semibold">
                                {solicitacaoChamado || 'Sem solicitação'}
                            </p>
                        </div>
                    </div>

                    {/* Avaliação por Estrelas */}
                    <div className="mb-10 flex flex-col gap-3">
                        <h2 className="block text-center text-xl font-extrabold tracking-widest text-black select-none">
                            Como você avalia o atendimento?
                        </h2>
                        <div className="flex justify-center gap-4">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onMouseEnter={() => setHoveredStar(star)}
                                    onMouseLeave={() => setHoveredStar(0)}
                                    onClick={() => setNota(star)}
                                    disabled={isSubmitting}
                                    className="transition-transform hover:scale-125 active:scale-95 disabled:opacity-50"
                                >
                                    <Star
                                        size={48}
                                        className={
                                            star <= (hoveredStar || nota)
                                                ? 'fill-yellow-500 text-yellow-500'
                                                : 'text-gray-400'
                                        }
                                    />
                                </button>
                            ))}
                        </div>
                        <div className="text-center">
                            <span
                                className={`text-base tracking-widest select-none ${
                                    nota > 0
                                        ? 'font-extrabold text-purple-900'
                                        : 'font-semibold text-gray-500'
                                }`}
                            >
                                {getNotaTexto(hoveredStar || nota)}
                            </span>
                        </div>
                    </div>

                    {/* Observação */}
                    <div className="mb-6 flex flex-col gap-1">
                        <h3 className="block text-sm font-extrabold tracking-widest text-black select-none">
                            Comentário (opcional)
                        </h3>
                        <textarea
                            value={observacao}
                            onChange={handleObservacaoChange}
                            placeholder="Deixe um comentário sobre o atendimento..."
                            disabled={isSubmitting}
                            className="max-h-32 w-full resize-none overflow-y-auto rounded-md border border-gray-400 px-4 py-2 text-justify text-sm font-semibold tracking-widest text-black select-none focus:ring-4 focus:ring-purple-900 focus:outline-none"
                            rows={4}
                            maxLength={200}
                        />
                        <div className="text-right text-xs font-semibold tracking-widest text-gray-500 select-none">
                            {observacao.length}/200 caracteres
                        </div>
                    </div>

                    {/* Mensagem de Erro */}
                    {error && (
                        <div className="mb-4 rounded-md bg-red-50 p-3 text-center text-sm font-semibold text-red-600">
                            {error}
                        </div>
                    )}

                    {/* Botões de Ação */}
                    <div className="flex items-center justify-end">
                        <button
                            onClick={handleSubmit}
                            disabled={nota === 0 || isSubmitting}
                            className="flex w-[250px] cursor-pointer items-center justify-center gap-4 rounded-md border border-blue-900 bg-blue-700 px-4 py-2 text-base font-extrabold text-white shadow-md shadow-black transition-all duration-200 hover:scale-103 hover:bg-blue-900 hover:shadow-xl hover:shadow-black active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <MdSend
                                className={`text-white ${isSubmitting ? 'animate-send' : ''}`}
                                size={20}
                            />
                            {isSubmitting ? 'Salvando...' : 'Enviar Avaliação'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Estilos da Animação */}
            <style jsx>{`
                @keyframes send {
                    0%,
                    100% {
                        transform: translateX(0) translateY(0);
                    }
                    50% {
                        transform: translateX(8px) translateY(-3px);
                    }
                }

                .animate-send {
                    animation: send 0.8s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}
