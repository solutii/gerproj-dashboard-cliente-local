// src/app/paginas/chamados/modais/Modal_Assunto_Solicitacao_Chamado.tsx

'use client';

import { formatarDataParaBR } from '@/formatters/formatar-data';
import { formatarNumeros } from '@/formatters/formatar-numeros';
import { corrigirTextoCorrompido } from '@/formatters/formatar-texto-corrompido';
// =====================================================
import { useState } from 'react';
import { FaCheck } from 'react-icons/fa';
import { FiCopy } from 'react-icons/fi';
import { IoCall, IoClose } from 'react-icons/io5';
// ==========

interface ModalAssuntoSolicitacaoChamadoProps {
    isOpen: boolean;
    onClose: () => void;
    solicitacao: string;
    assunto: string;
    codChamado: number;
    dataChamado?: string;
}
// ==========

// ==================== COMPONENTE PRINCIPAL ====================
export function ModalAssuntoSolicitacaoChamado({
    isOpen,
    onClose,
    solicitacao,
    assunto,
    codChamado,
    dataChamado,
}: ModalAssuntoSolicitacaoChamadoProps) {
    const [copied, setCopied] = useState(false);

    const solicitacaoCorrigida = corrigirTextoCorrompido(solicitacao);
    const assuntoCorrigido = corrigirTextoCorrompido(assunto);

    const handleCopy = () => {
        const textToCopy = `ASSUNTO:\n${assuntoCorrigido}\n\nSOLICITAÇÃO:\n${solicitacaoCorrigida}`;
        navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!isOpen) return null;

    // ==================== RENDERIZAÇÃO PRINCIPAL ====================
    return (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center transition-all duration-200 ease-out">
            {/* OVERLAY */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            <div className="animate-in slide-in-from-bottom-4 relative z-10 flex w-7xl flex-col overflow-hidden rounded-xl bg-white transition-all duration-200 ease-out">
                {/* ========== HEADER ========== */}
                <header className="relative flex flex-shrink-0 items-center justify-between bg-teal-700 p-4 shadow-md shadow-black">
                    <div className="flex items-center gap-6">
                        <IoCall className="flex-shrink-0 text-white" size={60} />
                        <div className="flex flex-col gap-1 tracking-widest text-white select-none">
                            <h1 className="text-3xl font-extrabold">ASSUNTO/SOLICITAÇÃO CHAMADO</h1>
                            <p className="text-lg font-semibold">
                                Chamado #{formatarNumeros(codChamado)}
                                {formatarDataParaBR(dataChamado) &&
                                    ` - ${formatarDataParaBR(dataChamado)}`}
                            </p>
                        </div>
                    </div>
                    {/* = */}

                    <button
                        onClick={onClose}
                        className="mr-2 flex-shrink-0 cursor-pointer rounded-md bg-gradient-to-br from-red-600 to-red-700 shadow-md shadow-black transition-all duration-200 hover:scale-125 hover:bg-red-500 hover:shadow-xl hover:shadow-black active:scale-95"
                        aria-label="Fechar modal"
                    >
                        <IoClose className="text-white" size={36} />
                    </button>
                </header>
                {/* ========== */}

                {/* ========== CONTEÚDO ========== */}
                <div className="flex flex-1 flex-col gap-10 overflow-y-auto bg-stone-300 px-6 py-10">
                    <div className="flex flex-col gap-6">
                        <div className="rounded-md border bg-white p-6 text-justify tracking-widest text-black shadow-md shadow-black select-none">
                            <p className="font-bold">Assunto:</p>
                            <p className="ml-4 text-sm font-semibold">
                                {assuntoCorrigido || 'Sem assunto'}
                            </p>
                        </div>
                        <div className="rounded-md border bg-white p-6 text-justify tracking-widest text-black shadow-md shadow-black select-none">
                            <p className="font-bold">Solicitação:</p>
                            <p className="ml-4 text-sm font-semibold">
                                {solicitacaoCorrigida || 'Sem solicitação'}
                            </p>
                        </div>
                    </div>
                    {/* = */}

                    <div className="flex items-center justify-end">
                        <button
                            onClick={handleCopy}
                            className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-gradient-to-br from-blue-600 to-blue-700 px-6 py-3 text-lg font-semibold tracking-widest text-white shadow-md shadow-black transition-all duration-200 select-none hover:-translate-y-1 hover:bg-blue-500 hover:shadow-xl hover:shadow-black active:scale-95"
                        >
                            {copied ? (
                                <>
                                    <FaCheck className="text-white" size={24} />
                                    <span>Copiado</span>
                                </>
                            ) : (
                                <>
                                    <FiCopy className="text-white" size={24} />
                                    <span>Copiar</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
                {/* ========== */}
            </div>
        </div>
    );
}
