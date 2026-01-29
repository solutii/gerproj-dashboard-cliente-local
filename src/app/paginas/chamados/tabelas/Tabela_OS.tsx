// src/app/paginas/chamados/tabelas/Tabela_OS.tsx

'use client';

import { RedimensionarColunas } from '@/app/paginas/chamados/componentes/Redimensionar_Colunas';
import { ModalObservacaoOS } from '@/app/paginas/chamados/modais/Modal_Observacao_OS';
import { IsError } from '@/components/shared/IsError';
import { IsLoading } from '@/components/shared/IsLoading';
import { useAuth } from '@/context/AuthContext';
import { formatarDataParaBR } from '@/formatters/formatar-data';
import { formatarNumeros } from '@/formatters/formatar-numeros';
import { corrigirTextoCorrompido } from '@/formatters/formatar-texto-corrompido';
import { useRedimensionarColunas } from '@/hooks/useRedimensionarColunas';
import { useFiltersStore } from '@/store/useFiltersStore';
import { useQuery } from '@tanstack/react-query';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
// =====================================================
import React, { useCallback, useMemo, useState } from 'react';
import { IoClose } from 'react-icons/io5';
import { TbFileInvoice } from 'react-icons/tb';
import { getColunasOS, OSRowProps } from './Colunas_Tabela_OS';

// =====================================================
// CONFIGURAÇÃO E CONSTANTES
// =====================================================
const ZOOM_LEVEL = 0.67;
const ZOOM_COMPENSATION = 100 / ZOOM_LEVEL;
const HEADER_HEIGHT = 293;
const BASE_MIN_HEIGHT = 400;
const MAX_HEIGHT = `calc(${ZOOM_COMPENSATION}vh - ${HEADER_HEIGHT}px)`;
const MIN_HEIGHT = `${(BASE_MIN_HEIGHT * ZOOM_COMPENSATION) / 100}px`;

const INITIAL_COLUMN_WIDTHS = {
    NUM_OS: 120,
    DTINI_OS: 140,
    HRINI_OS: 120,
    HRFIM_OS: 120,
    TOTAL_HORAS_OS: 150,
    OBS: 300,
    NOME_RECURSO: 200,
    NOME_TAREFA: 250,
    VALCLI_OS: 150,
} as const;

// =====================================================
// INTERFACES E TIPOS
// =====================================================
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

interface FetchOSParams {
    codChamado: number;
    isAdmin: boolean;
    codCliente: string | null;
    mes: number;
    ano: number;
}

// =====================================================
// FUNÇÕES UTILITÁRIAS
// =====================================================
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
}: FetchOSParams): Promise<ApiResponseOS> => {
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

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================
export function TabelaOS({ isOpen, codChamado, onClose, onSelectOS }: ModalOSProps) {
    const { isAdmin, codCliente } = useAuth();
    const mes = useFiltersStore((state) => state.filters.mes);
    const ano = useFiltersStore((state) => state.filters.ano);

    // Estados
    const [isModalObsOpen, setIsModalObsOpen] = useState(false);
    const [selectedOSForObs, setSelectedOSForObs] = useState<OSRowProps | null>(null);

    // Hook de redimensionamento
    const { columnWidths, handleMouseDown, handleDoubleClick, resizingColumn } =
        useRedimensionarColunas(INITIAL_COLUMN_WIDTHS);

    // =====================================================
    // REACT QUERY
    // =====================================================
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
        staleTime: 5 * 60 * 1000,
        retry: 2,
    });

    // =====================================================
    // MEMOIZAÇÕES
    // =====================================================
    const osData = useMemo(() => data?.data ?? [], [data?.data]);

    const columns = useMemo(() => getColunasOS(), []);

    const dataChamado = useMemo(() => {
        if (data?.dataChamado) {
            return formatarDataParaBR(data.dataChamado);
        }
        return `${mes}/${ano}`;
    }, [data?.dataChamado, mes, ano]);

    const observacaoModalData = useMemo(
        () => ({
            observacao: selectedOSForObs?.OBS ?? '',
            numOS: selectedOSForObs?.NUM_OS ?? 0,
            dataOS: selectedOSForObs?.DTINI_OS
                ? formatarDataParaBR(selectedOSForObs.DTINI_OS)
                : undefined,
            consultor: selectedOSForObs?.NOME_RECURSO
                ? corrigirTextoCorrompido(selectedOSForObs.NOME_RECURSO)
                : undefined,
        }),
        [selectedOSForObs]
    );

    // =====================================================
    // CALLBACKS
    // =====================================================
    const handleOpenModalObs = useCallback((os: OSRowProps) => {
        setSelectedOSForObs(os);
        setIsModalObsOpen(true);
    }, []);

    const handleCloseModalObs = useCallback(() => {
        setIsModalObsOpen(false);
        setSelectedOSForObs(null);
    }, []);

    // =====================================================
    // TABELA
    // =====================================================
    const table = useReactTable<OSRowProps>({
        data: osData,
        columns,
        getCoreRowModel: getCoreRowModel(),
        meta: {
            handleOpenModalObs,
            onSelectOS,
        },
    });

    // =====================================================
    // RENDERIZAÇÃO CONDICIONAL
    // =====================================================
    if (!isOpen || codChamado === null) return null;

    if (isLoading) {
        return (
            <ModalOverlay>
                <IsLoading isLoading={isLoading} title="Carregando OS's do chamado..." />
            </ModalOverlay>
        );
    }

    if (error) {
        return (
            <ModalOverlay>
                <IsError isError={!!error} error={error as Error} title="Erro ao Carregar OS's" />
            </ModalOverlay>
        );
    }

    // =====================================================
    // RENDERIZAÇÃO PRINCIPAL
    // =====================================================
    return (
        <>
            <ModalOverlay>
                <ModalContainer>
                    <ModalHeader
                        codChamado={codChamado}
                        dataChamado={dataChamado}
                        onClose={onClose}
                    />

                    <ModalContent>
                        {osData.length > 0 && (
                            <TableContainer>
                                <OSTable
                                    table={table}
                                    columnWidths={columnWidths}
                                    handleMouseDown={handleMouseDown}
                                    handleDoubleClick={handleDoubleClick}
                                    resizingColumn={resizingColumn}
                                />
                            </TableContainer>
                        )}
                    </ModalContent>
                </ModalContainer>
            </ModalOverlay>

            <ModalObservacaoOS
                isOpen={isModalObsOpen}
                onClose={handleCloseModalObs}
                observacao={observacaoModalData.observacao}
                numOS={observacaoModalData.numOS}
                dataOS={observacaoModalData.dataOS}
                consultor={observacaoModalData.consultor}
            />
        </>
    );
}

// =====================================================
// SUB-COMPONENTES
// =====================================================

interface ModalOverlayProps {
    children: React.ReactNode;
}

const ModalOverlay = React.memo(function ModalOverlay({ children }: ModalOverlayProps) {
    return (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center transition-all duration-200 ease-out">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            {children}
        </div>
    );
});

interface ModalContainerProps {
    children: React.ReactNode;
}

const ModalContainer = React.memo(function ModalContainer({ children }: ModalContainerProps) {
    return (
        <div className="animate-in slide-in-from-bottom-4 relative z-10 flex w-[2000px] flex-col overflow-hidden rounded-xl bg-white shadow-md shadow-black transition-all duration-200 ease-out">
            {children}
        </div>
    );
});

interface ModalHeaderProps {
    codChamado: number;
    dataChamado: string;
    onClose: () => void;
}

const ModalHeader = React.memo(function ModalHeader({
    codChamado,
    dataChamado,
    onClose,
}: ModalHeaderProps) {
    return (
        <header className="relative flex flex-shrink-0 items-center justify-between bg-teal-700 p-4 shadow-md shadow-black">
            <div className="flex items-center gap-6">
                <TbFileInvoice className="flex-shrink-0 text-white" size={60} />
                <div className="flex flex-col gap-1 tracking-widest text-white select-none">
                    <h1 className="text-3xl font-extrabold">OS CHAMADO</h1>
                    <p className="text-lg font-semibold">
                        Chamado #{formatarNumeros(codChamado)} - {dataChamado}
                    </p>
                </div>
            </div>

            <button
                onClick={onClose}
                className="mr-2 flex-shrink-0 cursor-pointer rounded-md bg-gradient-to-br from-red-600 to-red-700 shadow-md shadow-black transition-all duration-200 hover:scale-125 hover:bg-red-500 hover:shadow-xl hover:shadow-black active:scale-95"
                aria-label="Fechar modal"
            >
                <IoClose className="text-white" size={36} />
            </button>
        </header>
    );
});

interface ModalContentProps {
    children: React.ReactNode;
}

const ModalContent = React.memo(function ModalContent({ children }: ModalContentProps) {
    return (
        <div className="flex flex-1 flex-col overflow-y-auto bg-stone-300 px-6 py-10">
            {children}
        </div>
    );
});

interface TableContainerProps {
    children: React.ReactNode;
}

const TableContainer = React.memo(function TableContainer({ children }: TableContainerProps) {
    return (
        <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
            <div className="scrollbar-thin scrollbar-track-purple-100 scrollbar-thumb-purple-600 hover:scrollbar-thumb-purple-800 flex-1 overflow-x-auto overflow-y-auto">
                {children}
            </div>
        </div>
    );
});

interface OSTableProps {
    table: any;
    columnWidths: Record<string, number>;
    handleMouseDown: (e: React.MouseEvent, columnId: string) => void;
    handleDoubleClick: (columnId: string) => void;
    resizingColumn: string | null;
}

const OSTable = React.memo(function OSTable({
    table,
    columnWidths,
    handleMouseDown,
    handleDoubleClick,
    resizingColumn,
}: OSTableProps) {
    return (
        <table
            className="w-full border-separate border-spacing-0"
            style={{
                tableLayout: 'fixed',
                minWidth: '1400px',
            }}
        >
            <OSTableHeader
                table={table}
                columnWidths={columnWidths}
                handleMouseDown={handleMouseDown}
                handleDoubleClick={handleDoubleClick}
                resizingColumn={resizingColumn}
            />
            <OSTableBody table={table} columnWidths={columnWidths} />
        </table>
    );
});

interface OSTableHeaderProps {
    table: any;
    columnWidths: Record<string, number>;
    handleMouseDown: (e: React.MouseEvent, columnId: string) => void;
    handleDoubleClick: (columnId: string) => void;
    resizingColumn: string | null;
}

const OSTableHeader = React.memo(function OSTableHeader({
    table,
    columnWidths,
    handleMouseDown,
    handleDoubleClick,
    resizingColumn,
}: OSTableHeaderProps) {
    return (
        <thead className="sticky top-0 z-20">
            {table.getHeaderGroups().map((headerGroup: any) => (
                <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header: any, idx: number) => (
                        <th
                            key={header.id}
                            className={`relative bg-purple-600 p-4 shadow-md shadow-black ${
                                idx === 0 ? 'rounded-tl-2xl' : ''
                            } ${idx === headerGroup.headers.length - 1 ? 'rounded-tr-2xl' : ''}`}
                            style={{
                                width: `${columnWidths[header.id]}px`,
                            }}
                        >
                            {flexRender(header.column.columnDef.header, header.getContext())}

                            {idx < headerGroup.headers.length - 1 && (
                                <RedimensionarColunas
                                    columnId={header.id}
                                    onMouseDown={handleMouseDown}
                                    onDoubleClick={handleDoubleClick}
                                    isResizing={resizingColumn === header.id}
                                />
                            )}
                        </th>
                    ))}
                </tr>
            ))}
        </thead>
    );
});

interface OSTableBodyProps {
    table: any;
    columnWidths: Record<string, number>;
}

const OSTableBody = React.memo(function OSTableBody({ table, columnWidths }: OSTableBodyProps) {
    const rows = table.getRowModel().rows;

    return (
        <tbody>
            {rows.map((row: any, idx: number) => (
                <tr
                    key={row.id}
                    className={`transition-all ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-white'
                    } hover:bg-teal-200`}
                >
                    {row.getVisibleCells().map((cell: any, cellIndex: number) => (
                        <td
                            key={cell.id}
                            style={{
                                width: `${columnWidths[cell.column.id]}px`,
                            }}
                            className={`border-b border-gray-400 px-2 py-3 transition-all ${
                                cellIndex === 0 ? 'border-l border-l-gray-400 pl-4' : ''
                            } ${
                                cellIndex === row.getVisibleCells().length - 1
                                    ? 'border-r border-r-gray-400'
                                    : ''
                            }`}
                        >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                    ))}
                </tr>
            ))}
        </tbody>
    );
});
