'use client';

import { useState } from 'react';
import { FiCheck, FiCopy } from 'react-icons/fi';
import { IoClose } from 'react-icons/io5';
import { TbFileInvoice } from 'react-icons/tb';
import { formatarNumeros } from '../../formatters/formatar-numeros';
import { corrigirTextoCorrompido } from '../../formatters/formatar-texto-corrompido';

interface ModalObservacaoOSProps {
    isOpen: boolean;
    onClose: () => void;
    observacao: string;
    numOS: number;
    dataOS?: string;
    consultor?: string;
}

// ================================================================================
// COMPONENTE PRINCIPAL
// ================================================================================
export function ModalObservacaoOS({
    isOpen,
    onClose,
    observacao,
    numOS,
    dataOS,
}: ModalObservacaoOSProps) {
    const [copied, setCopied] = useState(false);

    const observacaoCorrigida = corrigirTextoCorrompido(observacao);

    const handleCopy = () => {
        navigator.clipboard.writeText(observacaoCorrigida);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!isOpen) return null;

    // ================================================================================
    // RENDERIZAÇÃO PRINCIPAL
    // ================================================================================
    return (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center p-2 transition-all duration-200 ease-out">
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* Modal Container */}
            <div className="animate-in slide-in-from-bottom-4 relative z-10 w-full max-w-4xl overflow-hidden rounded-xl bg-white transition-all duration-200 ease-out">
                {/* Header */}
                <header className="relative flex flex-shrink-0 items-center justify-between bg-teal-700 p-4 shadow-md shadow-black">
                    <div className="flex items-center gap-6">
                        <TbFileInvoice className="flex-shrink-0 text-white" size={60} />
                        <div className="flex flex-col gap-1 tracking-widest text-white select-none">
                            <h1 className="text-2xl font-extrabold">
                                DETALHES DA ORDEM DE SERVIÇO
                            </h1>
                            <p className="text-base font-semibold">
                                OS #{formatarNumeros(numOS)}
                                {dataOS && ` - ${dataOS}`}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="group flex-shrink-0 cursor-pointer items-center justify-center rounded-full border border-red-700 bg-red-500 p-2 shadow-md shadow-black transition-all duration-200 hover:scale-125 hover:shadow-xl hover:shadow-black active:scale-95"
                        aria-label="Fechar modal"
                    >
                        <IoClose
                            className="text-white transition-all duration-200 group-hover:scale-125 group-active:scale-95 hover:rotate-180"
                            size={20}
                        />
                    </button>
                </header>

                {/* Body */}
                <div className="flex flex-col gap-6 px-6 py-6 pb-10">
                    {/* Área de texto com scroll */}
                    <div className="mb-10 flex flex-col gap-2 rounded-md border bg-gray-200 p-4 text-justify text-base tracking-widest text-black shadow-sm shadow-black select-none">
                        <p className="font-bold">Observação:</p>
                        <p className="ml-4 text-sm font-semibold">
                            {observacaoCorrigida || 'Sem observação'}
                        </p>
                    </div>

                    {/* Footer com botão de copiar */}
                    <div className="flex items-center justify-end">
                        <button
                            onClick={handleCopy}
                            className="flex cursor-pointer items-center justify-center gap-4 rounded-md border border-blue-900 bg-blue-700 px-6 py-2 text-base font-extrabold text-white shadow-md shadow-black transition-all duration-200 hover:scale-103 hover:bg-blue-900 hover:shadow-xl hover:shadow-black active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
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
                                        Copiar Observação
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
