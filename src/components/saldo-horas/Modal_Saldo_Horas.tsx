'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { FaExclamationTriangle, FaInfoCircle } from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';
import { PiTimerFill } from 'react-icons/pi';
import { SaldoRowProps } from '../../components/saldo-horas/Colunas_Tabela_Saldo';
import { TabelaSaldoHoras } from '../../components/saldo-horas/Tabela_Saldo_Horas';
import { useAuth } from '../../context/AuthContext';
import { useFiltersStore } from '../../store/useFiltersStore';
import { IsError } from '../shared/IsError';
import { IsLoading } from '../shared/IsLoading';

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

    const mes = useFiltersStore((state) => state.filters.mes);
    const ano = useFiltersStore((state) => state.filters.ano);
    const cliente = useFiltersStore((state) => state.filters.cliente);

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
        const clienteParam = !isAdmin && codCliente ? codCliente : cliente;

        if (!clienteParam) {
            throw new Error('Cliente não selecionado');
        }

        const params = new URLSearchParams({
            codCliente: clienteParam,
            mes: (mes || new Date().getMonth() + 1).toString(),
            ano: (ano || new Date().getFullYear()).toString(),
            isAdmin: isAdmin.toString(),
            mesesHistorico: '6',
        });

        const response = await fetch(`/api/saldo-horas?${params.toString()}`);

        if (!response.ok) throw new Error('Erro ao carregar dados');

        return response.json();
    };

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['saldoHoras', mes, ano, cliente, isAdmin, codCliente],
        queryFn: fetchData,
        enabled: isOpen && ((isAdmin && !!cliente) || (!isAdmin && !!codCliente)),
    });

    if (isLoading) {
        return <IsLoading isLoading={isLoading} title="Carregando dados de saldo de horas..." />;
    }

    if (error) {
        return (
            <IsError
                isError={!!error}
                error={error as Error}
                title="Erro ao carregar dados de saldo de horas"
            />
        );
    }

    if (!isOpen) return null;

    // ================================================================================
    // RENDERIZAÇÃO PRINCIPAL
    // ================================================================================
    return (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center p-2 transition-all duration-200 ease-out">
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* Modal Container */}
            <div className="animate-in slide-in-from-bottom-4 relative z-10 flex w-[2200px] flex-col overflow-hidden rounded-xl bg-white transition-all duration-200 ease-out">
                {/* Header */}
                <header className="relative flex flex-shrink-0 items-center justify-between bg-teal-700 p-4 shadow-md shadow-black">
                    <div className="flex items-center gap-6">
                        <PiTimerFill className="flex-shrink-0 text-white" size={60} />
                        <div className="flex flex-col gap-1 tracking-widest text-white select-none">
                            <h1 className="text-2xl font-extrabold">SALDO DE HORAS</h1>
                            {isAdmin && data && (
                                <p className="text-base font-semibold">
                                    {data.nomeCliente} • {data.mesAtual.toString().padStart(2, '0')}
                                    /{data.anoAtual}
                                </p>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="group flex-shrink-0 cursor-pointer rounded-full border border-red-700 bg-red-500 p-2 shadow-md shadow-black transition-all duration-200 hover:scale-125 hover:shadow-xl hover:shadow-black active:scale-95"
                        aria-label="Fechar modal"
                    >
                        <IoClose
                            className="text-white group-hover:scale-125 group-active:scale-95"
                            size={20}
                        />
                    </button>
                </header>

                {/* Content */}
                <div className="flex flex-col gap-6 px-6 py-6 pb-10">
                    {data && !isLoading && !isError && (
                        <div className="flex flex-col gap-4">
                            {/* Tabela */}
                            <TabelaSaldoHoras historico={data.historico} />

                            {/* Info sobre compensações */}
                            <div className="flex items-start gap-3 rounded-md border-t border-blue-300 bg-blue-100 p-4 shadow-sm shadow-black">
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
                            <div className="flex items-start gap-3 rounded-md border-t border-yellow-300 bg-amber-100 p-4 shadow-sm shadow-black">
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
