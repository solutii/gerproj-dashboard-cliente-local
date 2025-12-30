'use client';

import { formatarDataParaBR } from '@/formatters/formatar-data';
import { formatarNumeros } from '@/formatters/formatar-numeros';
import { corrigirTextoCorrompido } from '@/formatters/formatar-texto-corrompido';
import React, { useState } from 'react';
import { FiCheck, FiCopy } from 'react-icons/fi';
import { IoCall, IoClose } from 'react-icons/io5';

interface ModalSolicitacaoChamadoProps {
    isOpen: boolean;
    onClose: () => void;
    solicitacao: string;
    codChamado: number;
    dataChamado?: string;
}
// ================================================================================
// COMPONENTE PRINCIPAL
// ================================================================================
export function ModalSolicitacaoChamado({
    isOpen,
    onClose,
    solicitacao,
    codChamado,
    dataChamado,
}: ModalSolicitacaoChamadoProps) {
    const [copied, setCopied] = useState(false);

    const solicitacaoCorrigida = corrigirTextoCorrompido(solicitacao);

    const handleCopy = () => {
        navigator.clipboard.writeText(solicitacaoCorrigida);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    if (!isOpen) return null;

    // ================================================================================
    // RENDERIZAÇÃO PRINCIPAL
    // ================================================================================
    return (
        <div
            onClick={handleBackdropClick}
            className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center p-2 transition-all duration-300 ease-out"
        >
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* Modal Container */}
            <div className="animate-in slide-in-from-bottom-4 relative z-10 w-full max-w-4xl overflow-hidden rounded-xl bg-white transition-all duration-300 ease-out">
                {/* Header */}
                <header className="relative flex flex-shrink-0 items-center justify-between bg-teal-700 p-4 shadow-md shadow-black">
                    <div className="flex items-center gap-4">
                        <IoCall className="flex-shrink-0 text-white" size={60} />
                        <div className="flex flex-col">
                            <h1 className="text-2xl font-extrabold tracking-widest text-white select-none">
                                SOLICITAÇÃO DO CHAMADO
                            </h1>
                            <p className="text-base font-semibold tracking-widest text-white select-none">
                                Chamado #{formatarNumeros(codChamado)}
                                {formatarDataParaBR(dataChamado) &&
                                    ` - ${formatarDataParaBR(dataChamado)}`}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="group flex-shrink-0 cursor-pointer rounded-full bg-white/20 p-3 shadow-md shadow-black transition-all duration-200 hover:scale-103 hover:bg-red-500 hover:shadow-xl hover:shadow-black active:scale-95"
                        aria-label="Fechar modal"
                    >
                        <IoClose className="text-white" size={20} />
                    </button>
                </header>

                {/* Body */}
                <div className="flex flex-col gap-10 px-4 py-12">
                    {/* Área de texto com scroll */}
                    <div className="scrollbar-thin scrollbar-track-gray-200 scrollbar-thumb-purple-500 max-h-[60vh] overflow-y-auto rounded-xl border bg-gray-100 p-6 shadow-xs shadow-black">
                        <p className="text-base leading-relaxed font-semibold tracking-widest whitespace-pre-wrap text-black select-none">
                            {solicitacaoCorrigida}
                        </p>
                    </div>

                    {/* Footer com estatísticas e ações */}
                    <div className="flex items-center justify-end">
                        {/* Botão Copiar */}
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-4 rounded-md bg-blue-600 px-6 py-2 shadow-md shadow-black transition-all duration-200 hover:scale-103 hover:bg-blue-800 hover:shadow-xl hover:shadow-black active:scale-95"
                        >
                            {copied ? (
                                <>
                                    <FiCheck className="text-white" size={20} />
                                    <span className="text-base font-semibold tracking-widest text-white select-none">
                                        Copiado!
                                    </span>
                                </>
                            ) : (
                                <>
                                    <FiCopy className="text-white" size={20} />
                                    <span className="text-base font-semibold tracking-widest text-white select-none">
                                        Copiar Texto
                                    </span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
