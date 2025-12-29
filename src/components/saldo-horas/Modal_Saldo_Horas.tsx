'use client';

import { SaldoRowProps } from '@/components/saldo-horas/Colunas_Tabela_Saldo';
import { TabelaSaldoHoras } from '@/components/saldo-horas/Tabela_Saldo_Horas';
import { useAuth } from '@/context/AuthContext';
import { useFilters } from '@/context/FiltersContext';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { FaExclamationTriangle, FaInfoCircle } from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';
import { PiTimerFill } from 'react-icons/pi';

interface ApiResponse {
    mesAtual: number;
    anoAtual: number;
    codCliente: string;
    nomeCliente: string;
    saldoTotalDisponivel: number;
    debitoTotal: number;
    resumo: {
        totalContratadas: number;
        totalExecutadas: number;
        saldoGeral: number;
        mesesComSaldoPositivo: number;
        mesesComSaldoNegativo: number;
        mesesExpirados: number;
        mesesCompensados: number;
    };
    historico: SaldoRowProps[];
}

interface ModalSaldoHorasProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ModalSaldoHoras({ isOpen, onClose }: ModalSaldoHorasProps) {
    const { isAdmin, codCliente } = useAuth();
    const { filters } = useFilters();

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const fetchData = async (): Promise<ApiResponse> => {
        const clienteParam = !isAdmin && codCliente ? codCliente : filters.cliente;

        if (!clienteParam) {
            throw new Error('Cliente não selecionado');
        }

        const params = new URLSearchParams({
            codCliente: clienteParam,
            mes: (filters.mes || new Date().getMonth() + 1).toString(),
            ano: (filters.ano || new Date().getFullYear()).toString(),
            isAdmin: isAdmin.toString(),
            mesesHistorico: '6',
        });

        const response = await fetch(`/api/saldo-horas?${params.toString()}`);

        if (!response.ok) throw new Error('Erro ao carregar dados');

        return response.json();
    };

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['saldoHoras', filters, isAdmin, codCliente],
        queryFn: fetchData,
        enabled: isOpen && ((isAdmin && !!filters.cliente) || (!isAdmin && !!codCliente)),
    });

    if (!isOpen) return null;

    // ================================================================================
    // RENDERIZAÇÃO PRINCIPAL
    // ================================================================================
    return (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center p-2 transition-all duration-300 ease-out">
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* Modal Content */}
            <div className="animate-in slide-in-from-bottom-4 relative z-10 flex h-[1040px] w-[1800px] flex-col overflow-hidden rounded-xl bg-white transition-all duration-300 ease-out">
                {/* Header */}
                <header className="relative flex flex-shrink-0 items-center justify-between bg-teal-700 p-4 shadow-md shadow-black">
                    <div className="flex items-center gap-4">
                        <PiTimerFill className="flex-shrink-0 text-white" size={60} />
                        <div>
                            <h2 className="text-xl font-extrabold tracking-widest text-white sm:text-2xl">
                                SALDO DE HORAS
                            </h2>
                            {isAdmin && data && (
                                <p className="mt-1 text-xs font-semibold tracking-widest text-white sm:text-base">
                                    {data.nomeCliente} • {data.mesAtual.toString().padStart(2, '0')}
                                    /{data.anoAtual}
                                </p>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="group flex-shrink-0 cursor-pointer rounded-full bg-white/20 p-4 shadow-md shadow-black transition-all hover:scale-115 hover:bg-red-500 active:scale-95"
                        aria-label="Fechar modal"
                    >
                        <IoClose
                            className="text-white group-hover:scale-115 group-active:scale-95"
                            size={20}
                        />
                    </button>
                </header>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center gap-4 py-20">
                            <div className="h-16 w-16 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600"></div>
                            <span className="text-lg font-bold text-slate-600">
                                Carregando saldo de horas...
                            </span>
                        </div>
                    )}

                    {isError && (
                        <div className="flex flex-col items-center justify-center gap-4 py-20">
                            <FaExclamationTriangle className="text-red-500" size={48} />
                            <span className="text-lg font-bold text-slate-600">
                                {error instanceof Error ? error.message : 'Erro ao carregar dados'}
                            </span>
                        </div>
                    )}

                    {data && !isLoading && !isError && (
                        <div className="flex flex-col gap-4 sm:gap-6">
                            {/* Tabela */}
                            <TabelaSaldoHoras historico={data.historico} />

                            {/* Info sobre compensações */}
                            <div className="flex items-start gap-3 rounded-lg border-t border-blue-300 bg-blue-100 p-4 shadow-md shadow-black">
                                <FaInfoCircle className="flex-shrink-0 text-blue-600" size={28} />
                                <div className="text-black">
                                    <p className="mb-2 text-base font-extrabold tracking-widest select-none">
                                        Como funciona a compensação?
                                    </p>
                                    <ul className="list-inside list-disc space-y-1.5 text-sm font-semibold tracking-widest select-none">
                                        <li>
                                            Quando há débito (horas a mais executadas), o sistema
                                            compensa automaticamente com saldos positivos(créditos)
                                            de meses anteriores.
                                        </li>
                                        <li>
                                            A compensação segue a ordem FIFO (First In, First Out),
                                            usa primeiro os créditos mais antigos.
                                        </li>
                                        <li>
                                            O Saldo Bruto mostra o resultado antes da compensação.
                                        </li>
                                        <li>
                                            O Saldo Líquido mostra o resultado após todas as
                                            compensações.
                                        </li>
                                        <li>
                                            Exemplo: Se 11/2025 tem +14h e 12/2025 tem -4h, o
                                            sistema compensa automaticamente, resultando em 11/2025
                                            com +10h e 12/2025 com 0h.
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            {/* Info sobre expiração */}
                            <div className="flex items-start gap-3 rounded-lg border-t border-yellow-300 bg-amber-100 p-4 shadow-md shadow-black">
                                <FaExclamationTriangle
                                    className="flex-shrink-0 text-red-600"
                                    size={28}
                                />
                                <div className="text-black">
                                    <p className="mb-2 text-base font-extrabold tracking-widest select-none">
                                        Regras de Validade:
                                    </p>
                                    <ul className="list-inside list-disc space-y-1.5 text-sm font-semibold tracking-widest select-none">
                                        <li>
                                            Saldos positivos (créditos) podem ser utilizados, nos 2
                                            meses seguintes.
                                        </li>
                                        <li>
                                            Exemplo: Crédito em 11/2025, é válido em 12/2025 e
                                            01/2026, expirando em 01/2026.
                                        </li>
                                        <li>
                                            Após esse período, saldos positivos (créditos) não
                                            utilizados, expiram e não poderão mais ser utilizados.
                                        </li>
                                        <li>
                                            Saldos negativos (débitos) não expiram e devem ser
                                            pagos.
                                        </li>
                                        <li>
                                            A compensação automática respeita o prazo de validade
                                            dos créditos (não usa créditos já expirados).
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
