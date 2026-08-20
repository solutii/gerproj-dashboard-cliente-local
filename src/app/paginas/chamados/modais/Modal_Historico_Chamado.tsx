// src/app/paginas/chamados/modais/Modal_Historico_Chamado.tsx

'use client';

import { formatarDataHoraChamado } from '@/formatters/formatar-data';
import { corrigirTextoCorrompido } from '@/formatters/formatar-texto-corrompido';
import { useQuery } from '@tanstack/react-query';
import { IoClose } from 'react-icons/io5';
import { MdHistory } from 'react-icons/md';
import { TbTimelineEventText } from 'react-icons/tb';

interface HistoricoItem {
    codHistchamado: number;
    data: string;
    hora: string;
    descricao: string;
}

interface HistoricoResponse {
    success: boolean;
    codChamado: number;
    historico: HistoricoItem[];
}

interface ModalHistoricoChamadoProps {
    isOpen: boolean;
    codChamado: number;
    onClose: () => void;
}

async function fetchHistorico(codChamado: number): Promise<HistoricoResponse> {
    const response = await fetch(`/api/chamados/${codChamado}/historico`);
    if (!response.ok) {
        const erro = await response.json();
        throw new Error(erro.error ?? 'Erro ao buscar histórico do chamado');
    }
    return response.json();
}

export function ModalHistoricoChamado({ isOpen, codChamado, onClose }: ModalHistoricoChamadoProps) {
    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['historico-chamado', codChamado],
        queryFn: () => fetchHistorico(codChamado),
        enabled: isOpen && codChamado > 0,
    });

    if (!isOpen) return null;

    return (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center p-2 transition-all duration-200 ease-out">
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

            <div className="animate-in slide-in-from-bottom-4 relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white transition-all duration-200 ease-out">
                {/* ========== HEADER ========== */}
                <header className="relative flex flex-shrink-0 items-center justify-between bg-teal-700 p-4 shadow-md shadow-black">
                    <div className="flex items-center gap-4">
                        <MdHistory className="flex-shrink-0 text-white" size={44} />
                        <div className="flex flex-col gap-1 tracking-widest text-white select-none">
                            <h1 className="text-2xl font-extrabold">HISTÓRICO DO CHAMADO</h1>
                            <p className="text-sm font-semibold">
                                Nº {String(codChamado).padStart(5, '0')}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="mr-1 flex-shrink-0 cursor-pointer rounded-md bg-gradient-to-br from-red-600 to-red-700 shadow-md shadow-black transition-all duration-200 hover:scale-125 hover:bg-red-500 hover:shadow-xl hover:shadow-black active:scale-95"
                        aria-label="Fechar modal"
                    >
                        <IoClose className="text-white" size={30} />
                    </button>
                </header>

                {/* ========== CONTEÚDO ========== */}
                <div className="flex-1 overflow-y-auto bg-stone-100 px-6 py-8">
                    {isLoading && (
                        <p className="text-center text-sm font-semibold tracking-widest text-gray-500 select-none">
                            Carregando histórico...
                        </p>
                    )}

                    {isError && (
                        <p className="text-center text-sm font-semibold tracking-widest text-red-600 select-none">
                            {error instanceof Error ? error.message : 'Erro ao carregar histórico.'}
                        </p>
                    )}

                    {data && data.historico.length === 0 && (
                        <p className="text-center text-sm font-semibold tracking-widest text-gray-500 select-none">
                            Nenhum evento de histórico registrado para este chamado.
                        </p>
                    )}

                    {data && data.historico.length > 0 && (
                        <ol className="relative ml-3 border-l-2 border-teal-300">
                            {data.historico.map((item) => (
                                <li key={item.codHistchamado} className="mb-8 ml-6 last:mb-0">
                                    <span className="absolute -left-[11px] flex h-5 w-5 items-center justify-center rounded-full bg-teal-600 ring-4 ring-stone-100">
                                        <TbTimelineEventText className="text-white" size={12} />
                                    </span>
                                    <div className="rounded-md border-t border-gray-200 bg-white p-4 shadow-sm shadow-black">
                                        <p className="mb-1 text-xs font-bold tracking-widest text-teal-700 select-none">
                                            {formatarDataHoraChamado(item.data, item.hora)}
                                        </p>
                                        <p className="text-sm font-semibold tracking-wider text-black select-none">
                                            {corrigirTextoCorrompido(item.descricao)}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
            </div>
        </div>
    );
}
