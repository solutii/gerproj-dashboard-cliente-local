// src/components/chamados/Modal_OS.tsx
'use client';

import { useAuth } from '@/context/AuthContext';
import { useFilters } from '@/context/FiltersContext';
import { formatarDataParaBR } from '@/formatters/formatar-data';
import { formatarNumeros } from '@/formatters/formatar-numeros';
import { corrigirTextoCorrompido } from '@/formatters/formatar-texto-corrompido';
import { useRedimensionarColunas } from '@/hooks/useRedimensionarColunas';
import { useQuery } from '@tanstack/react-query';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useCallback, useMemo, useState } from 'react';
import { IoClose } from 'react-icons/io5';
import { TbFileInvoice } from 'react-icons/tb';
import { IsError } from '../utils/IsError';
import { IsLoading } from '../utils/IsLoading';
import { getColunasOS, OSRowProps } from './Colunas_Tabela_OS';
import { ModalObservacaoOS } from './Modal_Observacao_OS';
import { RedimensionarColunas } from './Redimensionar_Colunas';

// ==================== INTERFACES ====================
interface ApiResponseOS {
    success: boolean;
    codChamado: number;
    dataChamado?: string;
    periodo?: {
        mes: number;
        ano: number;
    };
    totais: {
        quantidade_OS: number;
        total_horas_chamado: number;
    };
    data: OSRowProps[];
}

interface ModalOSProps {
    isOpen: boolean;
    codChamado: number | null;
    onClose: () => void;
    onSelectOS: (os: OSRowProps) => void;
}

// ==================== FUNÇÕES DE FETCH ====================
const createAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'x-is-logged-in': localStorage.getItem('isLoggedIn') || 'false',
    'x-is-admin': localStorage.getItem('isAdmin') || 'false',
    'x-user-email': localStorage.getItem('userEmail') || '',
    'x-cod-cliente': localStorage.getItem('codCliente') || '',
});

const fetchOSByChamado = async ({
    codChamado,
    isAdmin,
    codCliente,
    mes,
    ano,
}: {
    codChamado: number;
    isAdmin: boolean;
    codCliente: string | null;
    mes: number;
    ano: number;
}): Promise<ApiResponseOS> => {
    const params = new URLSearchParams({
        isAdmin: String(isAdmin),
        mes: String(mes),
        ano: String(ano),
    });

    if (!isAdmin && codCliente) {
        params.append('codCliente', codCliente);
    }

    const response = await fetch(`/api/chamados/${codChamado}/os?${params.toString()}`, {
        headers: createAuthHeaders(),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao carregar OS');
    }

    return response.json();
};

// ==================== COMPONENTE PRINCIPAL ====================
export function ModalOS({ isOpen, codChamado, onClose, onSelectOS }: ModalOSProps) {
    const { isAdmin, codCliente } = useAuth();
    const { filters } = useFilters();
    const { mes, ano } = filters;

    const [isModalObsOpen, setIsModalObsOpen] = useState(false);
    const [selectedOSForObs, setSelectedOSForObs] = useState<OSRowProps | null>(null);

    // Larguras iniciais das colunas
    const initialColumnWidths = {
        NUM_OS: 120,
        DTINI_OS: 140,
        HRINI_OS: 120,
        HRFIM_OS: 120,
        TOTAL_HORAS_OS: 150,
        OBS: 300,
        NOME_RECURSO: 200,
        NOME_TAREFA: 250,
        VALCLI_OS: 150,
    };

    // Hook de resize
    const { columnWidths, handleMouseDown, handleDoubleClick, resizingColumn } =
        useRedimensionarColunas(initialColumnWidths);

    // Query de OS's
    const { data, isLoading, error } = useQuery({
        queryKey: ['modal-os-lista', codChamado, isAdmin, codCliente, mes, ano],
        queryFn: () =>
            fetchOSByChamado({
                codChamado: codChamado!,
                isAdmin,
                codCliente,
                mes: mes ?? new Date().getMonth() + 1,
                ano: ano ?? new Date().getFullYear(),
            }),
        enabled: isOpen && codChamado !== null && !!mes && !!ano,
        staleTime: 1000 * 60 * 5,
        retry: 2,
    });

    const osData = useMemo(() => data?.data ?? [], [data?.data]);
    const columns = useMemo(() => getColunasOS(), []);

    const dataChamado = useMemo(() => {
        if (data?.dataChamado) {
            return formatarDataParaBR(data.dataChamado);
        }
        return `${mes}/${ano}`;
    }, [data?.dataChamado, mes, ano]);

    const handleOpenModalObs = useCallback((os: OSRowProps) => {
        setSelectedOSForObs(os);
        setIsModalObsOpen(true);
    }, []);

    const table = useReactTable<OSRowProps>({
        data: osData,
        columns,
        getCoreRowModel: getCoreRowModel(),
        meta: {
            handleOpenModalObs,
        },
    });

    const handleClose = () => {
        onClose();
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            handleClose();
        }
    };

    if (!isOpen || codChamado === null) return null;

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
            <div className="animate-in slide-in-from-bottom-4 relative z-10 w-[2200px] overflow-hidden rounded-xl bg-white transition-all duration-300 ease-out">
                {/* Header */}
                <header className="relative flex flex-shrink-0 items-center justify-between bg-teal-700 p-4 shadow-md shadow-black">
                    <div className="flex items-center gap-4">
                        <TbFileInvoice className="flex-shrink-0 text-white" size={60} />
                        <div className="flex flex-col">
                            <h1 className="text-2xl font-extrabold tracking-widest text-white select-none">
                                ORDENS DE SERVIÇO
                            </h1>
                            <p className="text-base font-semibold tracking-widest text-white select-none">
                                Chamado #{formatarNumeros(codChamado)} - {dataChamado}
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
                {/* ==================== */}

                {/* Body */}
                <div
                    className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6"
                    style={{ maxHeight: 'calc(100vh - 80px)', minHeight: '300px' }}
                >
                    {isLoading && (
                        <IsLoading isLoading={isLoading} title="Carregando OS's do chamado..." />
                    )}

                    {error && (
                        <IsError
                            isError={!!error}
                            error={error as Error}
                            title="Erro ao Carregar OS's"
                        />
                    )}

                    {!isLoading && !error && osData.length === 0 && (
                        <div className="px-4 py-10 text-center sm:py-20">
                            <p className="text-base font-bold tracking-widest text-slate-600 select-none sm:text-lg lg:text-xl">
                                Nenhuma OS encontrada para este chamado no período {mes}/{ano}
                            </p>
                        </div>
                    )}

                    {!isLoading && !error && osData.length > 0 && (
                        <>
                            {/* Tabela de OS's com altura fixa */}
                            <div className="overflow-hidden rounded-lg border border-teal-800 shadow-lg">
                                <div
                                    className="scrollbar-thin scrollbar-track-teal-100 scrollbar-thumb-teal-600 hover:scrollbar-thumb-teal-800 overflow-x-auto overflow-y-auto"
                                    style={{
                                        height: 'calc(100vh - 200px)',
                                        maxHeight: '75vh',
                                        minHeight: '300px',
                                    }}
                                >
                                    <table
                                        className="w-full border-separate border-spacing-0"
                                        style={{ tableLayout: 'fixed', minWidth: '1000px' }}
                                    >
                                        {/* Thead com ResizeHandle */}
                                        <thead className="sticky top-0 z-10">
                                            {table.getHeaderGroups().map((headerGroup) => (
                                                <tr key={headerGroup.id}>
                                                    {headerGroup.headers.map((header, idx) => (
                                                        <th
                                                            key={header.id}
                                                            className="relative bg-purple-700 p-3 text-xs font-extrabold tracking-widest text-white shadow-md shadow-black select-none"
                                                            style={{
                                                                width: `${columnWidths[header.id]}px`,
                                                            }}
                                                        >
                                                            {flexRender(
                                                                header.column.columnDef.header,
                                                                header.getContext()
                                                            )}

                                                            {idx <
                                                                headerGroup.headers.length - 1 && (
                                                                <RedimensionarColunas
                                                                    columnId={header.id}
                                                                    onMouseDown={handleMouseDown}
                                                                    onDoubleClick={
                                                                        handleDoubleClick
                                                                    }
                                                                    isResizing={
                                                                        resizingColumn === header.id
                                                                    }
                                                                />
                                                            )}
                                                        </th>
                                                    ))}
                                                </tr>
                                            ))}
                                        </thead>

                                        {/* Tbody com larguras dinâmicas */}
                                        <tbody>
                                            {table.getRowModel().rows.map((row, idx) => (
                                                <tr
                                                    key={row.id}
                                                    onClick={() => onSelectOS(row.original)}
                                                    className={`cursor-pointer transition-all ${
                                                        idx % 2 === 0 ? 'bg-white' : 'bg-white'
                                                    } hover:bg-teal-100`}
                                                >
                                                    {row.getVisibleCells().map((cell) => (
                                                        <td
                                                            key={cell.id}
                                                            className="border-b border-gray-300 p-2"
                                                            style={{
                                                                width: `${columnWidths[cell.column.id]}px`,
                                                            }}
                                                        >
                                                            {flexRender(
                                                                cell.column.columnDef.cell,
                                                                cell.getContext()
                                                            )}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
            <ModalObservacaoOS
                isOpen={isModalObsOpen}
                onClose={() => {
                    setIsModalObsOpen(false);
                    setSelectedOSForObs(null);
                }}
                observacao={selectedOSForObs?.OBS ?? ''}
                numOS={selectedOSForObs?.NUM_OS ?? 0}
                dataOS={
                    selectedOSForObs?.DTINI_OS
                        ? formatarDataParaBR(selectedOSForObs.DTINI_OS)
                        : undefined
                }
                consultor={
                    selectedOSForObs?.NOME_RECURSO
                        ? corrigirTextoCorrompido(selectedOSForObs.NOME_RECURSO)
                        : undefined
                }
            />
        </div>
    );
}
