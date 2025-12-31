// src/components/chamados/Modal_Avaliacao_Chamado.tsx
'use client';

import { Star, X } from 'lucide-react';
import { useState } from 'react';

interface ModalAvaliacaoChamadoProps {
    isOpen: boolean;
    onClose: () => void;
    codChamado: number;
    assuntoChamado: string | null;
    onSave: () => void;
}

export function ModalAvaliacaoChamado({
    isOpen,
    onClose,
    codChamado,
    assuntoChamado,
    onSave,
}: ModalAvaliacaoChamadoProps) {
    const [nota, setNota] = useState(0);
    const [hoveredStar, setHoveredStar] = useState(0);
    const [observacao, setObservacao] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (nota === 0) {
            setError('Por favor, selecione uma nota');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const response = await fetch(`/api/chamados/${codChamado}/avaliacao`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    avaliacao: nota,
                    observacao: observacao.trim() || null,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro ao salvar avaliação');
            }

            onSave();
            handleClose();
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

    return (
        <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4">
            <div className="relative w-full max-w-2xl rounded-lg bg-white shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between rounded-t-lg border-b border-gray-200 bg-purple-900 p-6">
                    <h2 className="text-2xl font-extrabold tracking-widest text-white">
                        AVALIAR ATENDIMENTO
                    </h2>
                    <button
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="rounded-full p-2 text-white transition-all hover:bg-purple-800 disabled:opacity-50"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {/* Informações do Chamado */}
                    <div className="mb-6 rounded-lg bg-gray-50 p-4">
                        <p className="mb-2 text-sm font-semibold text-gray-600">
                            Chamado #{codChamado}
                        </p>
                        <p className="text-base font-bold text-black">
                            {assuntoChamado || 'Sem assunto'}
                        </p>
                    </div>

                    {/* Avaliação por Estrelas */}
                    <div className="mb-6">
                        <label className="mb-3 block text-center text-lg font-bold text-black">
                            Como você avalia o atendimento?
                        </label>
                        <div className="flex justify-center gap-3">
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
                                                : 'text-gray-300'
                                        }
                                    />
                                </button>
                            ))}
                        </div>
                        <div className="mt-3 text-center">
                            <span
                                className={`text-base font-bold ${
                                    nota > 0 ? 'text-purple-900' : 'text-gray-500'
                                }`}
                            >
                                {getNotaTexto(hoveredStar || nota)}
                            </span>
                        </div>
                    </div>

                    {/* Observação */}
                    <div className="mb-6">
                        <label className="mb-2 block text-sm font-bold text-black">
                            Comentário (opcional)
                        </label>
                        <textarea
                            value={observacao}
                            onChange={(e) => setObservacao(e.target.value)}
                            placeholder="Deixe um comentário sobre o atendimento..."
                            disabled={isSubmitting}
                            className="w-full resize-none rounded-md border border-gray-300 p-3 text-sm focus:border-purple-900 focus:ring-2 focus:ring-purple-900 focus:outline-none disabled:bg-gray-100"
                            rows={4}
                            maxLength={200}
                        />
                        <div className="mt-1 text-right text-xs text-gray-500">
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
                    <div className="flex gap-3">
                        <button
                            onClick={handleClose}
                            disabled={isSubmitting}
                            className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-3 text-base font-bold text-black transition-all hover:bg-gray-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={nota === 0 || isSubmitting}
                            className="flex-1 rounded-md bg-purple-900 px-4 py-3 text-base font-bold text-white transition-all hover:bg-purple-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isSubmitting ? 'Salvando...' : 'Enviar Avaliação'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
