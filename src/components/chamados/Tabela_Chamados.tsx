// src/components/chamados/Tabela_Chamados.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import {
    ColumnFiltersState,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from '@tanstack/react-table';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FaEraser } from 'react-icons/fa';
import { IoCall } from 'react-icons/io5';
import { MdNavigateBefore, MdNavigateNext } from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import { useRedimensionarColunas } from '../../hooks/useRedimensionarColunas';
import { useFiltrosChamado } from '../shared/Filtros_Chamado';
import { IsError } from '../shared/IsError';
import { IsLoading } from '../shared/IsLoading';
import { ExportaExcelChamadosButton } from './Button_Excel';
import { ExportaPDFChamadosButton } from './Button_PDF';
import { ChamadoRowProps, getColunasChamados } from './Colunas_Tabela_Chamados';
import { OSRowProps } from './Colunas_Tabela_OS';
import { FiltroHeaderChamados } from './Filtro_Header_Tabela_Chamados';
import { ModalAvaliarChamado } from './Modal_Avaliar_Chamado';
import { ModalSolicitacaoChamado } from './Modal_Solicitacao_Chamado';
import { ModalTabelaOS } from './Modal_Tabela_OS';
import { ModalValidarOS } from './Modal_Validar_OS';
import { RedimensionarColunas } from './Redimensionar_Colunas';

// =====================================================
// CONFIGURAÇÕES E CONSTANTES
// =====================================================
const ZOOM_LEVEL = 0.67;
const ZOOM_COMPENSATION = 100 / ZOOM_LEVEL;
const HEADER_HEIGHT = 293;
const BASE_MIN_HEIGHT = 400;
const MAX_HEIGHT = `calc(${ZOOM_COMPENSATION}vh - ${HEADER_HEIGHT}px)`;
const MIN_HEIGHT = `${(BASE_MIN_HEIGHT * ZOOM_COMPENSATION) / 100}px`;
const PAGINATION_LIMIT = 300;

const INITIAL_COLUMN_WIDTHS = {
    COD_CHAMADO: 110,
    DATA_CHAMADO: 170,
    PRIOR_CHAMADO: 110,
    ASSUNTO_CHAMADO: 280,
    EMAIL_CHAMADO: 220,
    NOME_CLASSIFICACAO: 180,
    DTENVIO_CHAMADO: 170,
    NOME_RECURSO: 180,
    STATUS_CHAMADO: 220,
    DATA_HISTCHAMADO: 170,
    TOTAL_HORAS_OS: 120,
} as const;

// =====================================================
// INTERFACES E TIPOS
// =====================================================
interface ApiResponseChamados {
    success: boolean;
    totalChamados: number;
    totalOS: number;
    totalHorasOS: number;
    pagination: {
        page: number;
        limit: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
    };
    data: ChamadoRowProps[];
}

interface TabelaChamadosProps {
    onDataChange?: (data: ChamadoRowProps[]) => void;
}

interface FetchChamadosParams {
    ano?: string;
    mes?: string;
    isAdmin: boolean;
    codCliente: string | null;
    cliente?: string;
    status?: string;
    page: number;
    limit: number;
    columnFilters?: ColumnFiltersState;
}

declare module '@tanstack/react-table' {
    interface TableMeta<TData> {
        handleChamadoClick?: (codChamado: number, temOS: boolean) => void;
    }
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

const serializeColumnFilters = (filters: ColumnFiltersState): string => {
    return JSON.stringify(
        filters
            .filter((f) => f.id !== 'STATUS_CHAMADO' && f.value && String(f.value).trim() !== '')
            .map((f) => ({ id: f.id, value: f.value }))
            .sort((a, b) => a.id.localeCompare(b.id))
    );
};

// =====================================================
// API - FETCH DE DADOS
// =====================================================
const fetchChamados = async ({
    ano,
    mes,
    isAdmin,
    codCliente,
    cliente,
    status,
    page,
    limit,
    columnFilters,
}: FetchChamadosParams): Promise<ApiResponseChamados> => {
    const params = new URLSearchParams({
        isAdmin: String(isAdmin),
        page: String(page),
        limit: String(limit),
    });

    if (cliente) params.append('codClienteFilter', cliente);

    const statusUpper = status?.trim().toUpperCase();
    if (statusUpper === 'FINALIZADO') {
        params.append('statusFilter', status!);
    }

    if (isAdmin) {
        params.append('ano', ano || String(new Date().getFullYear()));
        params.append('mes', mes || String(new Date().getMonth() + 1));
    } else if (codCliente) {
        params.append('codCliente', codCliente);
        if (ano) params.append('ano', ano);
        if (mes) params.append('mes', mes);
    }

    columnFilters?.forEach((filter) => {
        if (filter.id !== 'STATUS_CHAMADO' && filter.value && String(filter.value).trim()) {
            params.append(`filter_${filter.id}`, String(filter.value));
        }
    });

    const response = await fetch(`/api/chamados?${params.toString()}`, {
        headers: createAuthHeaders(),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao carregar chamados');
    }

    return response.json();
};

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================
export function TabelaChamados({ onDataChange }: TabelaChamadosProps = {}) {
    const { isAdmin, codCliente, isLoggedIn } = useAuth();
    const filtros = useFiltrosChamado();
    const { ano, mes, cliente, recurso, status } = filtros;

    // Estados principais
    const [page, setPage] = useState(1);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

    // Estados dos modais
    const [isModalListaOSOpen, setIsModalListaOSOpen] = useState(false);
    const [isModalOSOpen, setIsModalOSOpen] = useState(false);
    const [selectedChamado, setSelectedChamado] = useState<number | null>(null);
    const [selectedOS, setSelectedOS] = useState<OSRowProps | null>(null);
    const [isModalSolicitacaoOpen, setIsModalSolicitacaoOpen] = useState(false);
    const [selectedChamadoSolicitacao, setSelectedChamadoSolicitacao] =
        useState<ChamadoRowProps | null>(null);
    const [isModalAvaliacaoOpen, setIsModalAvaliacaoOpen] = useState(false);
    const [selectedChamadoAvaliacao, setSelectedChamadoAvaliacao] =
        useState<ChamadoRowProps | null>(null);

    // Hook de redimensionamento
    const { columnWidths, handleMouseDown, handleDoubleClick, resizingColumn } =
        useRedimensionarColunas(INITIAL_COLUMN_WIDTHS);

    // =====================================================
    // MEMOIZAÇÕES E DERIVAÇÕES DE ESTADO
    // =====================================================
    const statusParaQuery = useMemo(() => {
        const statusUpper = status?.trim().toUpperCase();
        return statusUpper === 'FINALIZADO' ? status : '';
    }, [status]);

    const columnFiltersKey = useMemo(() => serializeColumnFilters(columnFilters), [columnFilters]);

    const queryEnabled = useMemo(() => {
        return isLoggedIn && (isAdmin ? !!ano && !!mes : true);
    }, [isLoggedIn, isAdmin, ano, mes]);

    // =====================================================
    // REACT QUERY
    // =====================================================
    const {
        data: apiData,
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: [
            'tabela-chamados',
            ano,
            mes,
            cliente ?? '',
            statusParaQuery,
            isAdmin,
            codCliente ?? '',
            page,
            PAGINATION_LIMIT,
            columnFiltersKey,
        ],
        queryFn: () =>
            fetchChamados({
                ano: ano !== undefined ? String(ano) : undefined,
                mes: mes !== undefined ? String(mes) : undefined,
                isAdmin,
                codCliente,
                cliente: cliente ?? '',
                status: status ?? '',
                page,
                limit: PAGINATION_LIMIT,
                columnFilters,
            }),
        enabled: queryEnabled,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: 2,
    });

    // =====================================================
    // FILTRAGENS E TRANSFORMAÇÕES DE DADOS
    // =====================================================
    const dadosFiltradosPorStatus = useMemo(() => {
        const chamados = apiData?.data ?? [];
        if (!status || status.trim() === '') return chamados;

        const statusUpper = status.trim().toUpperCase();
        if (statusUpper === 'FINALIZADO') return chamados;

        return chamados.filter((chamado) =>
            chamado.STATUS_CHAMADO?.toUpperCase().includes(statusUpper)
        );
    }, [apiData?.data, status]);

    const dadosFiltradosPorRecurso = useMemo(() => {
        if (!recurso) return dadosFiltradosPorStatus;

        return dadosFiltradosPorStatus.filter((chamado) => {
            const codRecurso = chamado.COD_RECURSO?.toString().trim();
            const nomeRecurso = chamado.NOME_RECURSO?.toString().trim();
            return codRecurso === recurso || nomeRecurso === recurso;
        });
    }, [dadosFiltradosPorStatus, recurso]);

    const dadosCompletosFiltrados = useMemo(() => {
        if (columnFilters.length === 0) return dadosFiltradosPorRecurso;

        return dadosFiltradosPorRecurso.filter((row) => {
            return columnFilters.every((filter) => {
                if (!filter.value || (typeof filter.value === 'string' && !filter.value.trim())) {
                    return true;
                }
                const cellValue = row[filter.id as keyof ChamadoRowProps];
                if (cellValue == null) return false;
                return String(cellValue).toUpperCase().includes(String(filter.value).toUpperCase());
            });
        });
    }, [dadosFiltradosPorRecurso, columnFilters]);

    const dadosPaginados = useMemo(() => dadosCompletosFiltrados, [dadosCompletosFiltrados]);

    // =====================================================
    // TOTALIZADORES
    // =====================================================
    const totaisRecalculados = useMemo(
        () => ({
            totalChamados: dadosFiltradosPorRecurso.length,
            totalOS: dadosFiltradosPorRecurso.filter((c) => c.TEM_OS).length,
            totalHoras: dadosFiltradosPorRecurso.reduce(
                (sum, c) => sum + (c.TOTAL_HORAS_OS || 0),
                0
            ),
        }),
        [dadosFiltradosPorRecurso]
    );

    const totalGeralChamados = useMemo(() => apiData?.data.length ?? 0, [apiData?.data]);
    const totalGeralChamadosAPI = useMemo(
        () => apiData?.totalChamados ?? 0,
        [apiData?.totalChamados]
    );

    const totalChamadosNaoFinalizados = useMemo(() => {
        const chamados = apiData?.data ?? [];
        if (isAdmin && !status) {
            return chamados.filter(
                (chamado) => chamado.STATUS_CHAMADO?.toUpperCase() !== 'FINALIZADO'
            ).length;
        }
        return chamados.length;
    }, [apiData?.data, isAdmin, status]);

    const totalChamadosFinalizados = useMemo(() => {
        const statusUpper = status?.trim().toUpperCase();
        if (statusUpper !== 'FINALIZADO') return 0;
        return apiData?.totalChamados ?? 0;
    }, [status, apiData?.totalChamados]);

    const paginacaoServidor = useMemo(() => {
        if (!apiData?.pagination) {
            return {
                page: 1,
                limit: 50,
                totalPages: 0,
                hasNextPage: false,
                hasPreviousPage: false,
            };
        }
        return apiData.pagination;
    }, [apiData?.pagination]);

    const hasActiveFilters = useMemo(() => {
        return columnFilters.some((filter) => {
            const value = filter.value;
            return value != null && (typeof value !== 'string' || value.trim() !== '');
        });
    }, [columnFilters]);

    // =====================================================
    // EFFECTS
    // =====================================================
    useEffect(() => {
        if (onDataChange) {
            onDataChange(dadosFiltradosPorRecurso);
        }
    }, [dadosFiltradosPorRecurso, onDataChange]);

    useEffect(() => {
        setPage(1);
    }, [status, recurso, columnFiltersKey]);

    // =====================================================
    // CALLBACKS
    // =====================================================
    const handleNextPage = useCallback(() => {
        if (paginacaoServidor?.hasNextPage) setPage((prev) => prev + 1);
    }, [paginacaoServidor?.hasNextPage]);

    const handlePreviousPage = useCallback(() => {
        if (paginacaoServidor?.hasPreviousPage) setPage((prev) => Math.max(1, prev - 1));
    }, [paginacaoServidor?.hasPreviousPage]);

    const handleGoToPage = useCallback((pageNumber: number) => {
        setPage(pageNumber);
        document.querySelector('.scrollbar-thin')?.scrollTo(0, 0);
    }, []);

    const handleChamadoClick = useCallback((codChamado: number, temOS: boolean) => {
        if (temOS) {
            setSelectedChamado(codChamado);
            setIsModalListaOSOpen(true);
        }
    }, []);

    const handleOSSelect = useCallback((os: OSRowProps) => {
        setSelectedOS(os);
        setIsModalOSOpen(true);
    }, []);

    const handleCloseModalListaOS = useCallback(() => {
        setIsModalListaOSOpen(false);
        setSelectedChamado(null);
    }, []);

    const handleCloseModalOS = useCallback(() => {
        setIsModalOSOpen(false);
        setSelectedOS(null);
    }, []);

    const handleSaveValidation = useCallback(() => refetch(), [refetch]);

    const handleOpenSolicitacao = useCallback((chamado: ChamadoRowProps) => {
        setSelectedChamadoSolicitacao(chamado);
        setIsModalSolicitacaoOpen(true);
    }, []);

    const handleCloseSolicitacao = useCallback(() => {
        setIsModalSolicitacaoOpen(false);
        setSelectedChamadoSolicitacao(null);
    }, []);

    const handleOpenAvaliacao = useCallback((chamado: ChamadoRowProps) => {
        setSelectedChamadoAvaliacao(chamado);
        setIsModalAvaliacaoOpen(true);
    }, []);

    const handleCloseAvaliacao = useCallback(() => {
        setIsModalAvaliacaoOpen(false);
        setSelectedChamadoAvaliacao(null);
    }, []);

    const handleSaveAvaliacao = useCallback(() => refetch(), [refetch]);

    const clearAllFilters = useCallback(() => setColumnFilters([]), []);

    // =====================================================
    // COLUNAS E TABELA
    // =====================================================
    const columns = useMemo(
        () =>
            getColunasChamados(
                isAdmin,
                new Set(),
                columnWidths,
                handleOpenSolicitacao,
                handleOpenAvaliacao
            ),
        [isAdmin, columnWidths, handleOpenSolicitacao, handleOpenAvaliacao]
    );

    const table = useReactTable<ChamadoRowProps>({
        data: dadosPaginados,
        columns,
        getCoreRowModel: getCoreRowModel(),
        state: { columnFilters },
        onColumnFiltersChange: setColumnFilters,
        meta: { handleChamadoClick },
    });

    // =====================================================
    // RENDERIZAÇÃO CONDICIONAL
    // =====================================================
    if (!isLoggedIn) {
        return <IsError isError={true} error={new Error('Você precisa estar logado')} title={''} />;
    }

    if (isLoading) {
        return <IsLoading isLoading={isLoading} title="Buscando Chamados no banco de dados..." />;
    }

    if (error) {
        return <IsError isError={!!error} error={error as Error} title={''} />;
    }

    // =====================================================
    // RENDERIZAÇÃO PRINCIPAL
    // =====================================================
    return (
        <>
            <div className="relative flex h-full w-full flex-col overflow-hidden border border-b-slate-500 bg-white shadow-md shadow-black">
                <Header
                    isAdmin={isAdmin}
                    totalChamadosFiltrados={apiData?.totalChamados || 0}
                    totalOSFiltrados={apiData?.totalOS || 0}
                    totalHorasFiltradas={apiData?.totalHorasOS || 0}
                    hasActiveFilters={hasActiveFilters}
                    clearAllFilters={clearAllFilters}
                    filteredData={dadosCompletosFiltrados}
                    mes={String(mes)}
                    ano={String(ano)}
                    codCliente={codCliente}
                    onRefresh={() => {
                        clearAllFilters();
                        setPage(1);
                        setTimeout(() => window.location.reload(), 100);
                    }}
                    totalChamadosNaoFinalizados={totalChamadosNaoFinalizados}
                    totalChamadosFinalizados={totalChamadosFinalizados}
                    totalGeralChamados={totalGeralChamados}
                    totalGeralChamadosAPI={totalGeralChamadosAPI}
                    status={status}
                    cliente={''}
                    recurso={''}
                    totalChamados={0}
                    totalOS={0}
                    totalHorasOS={0}
                />

                <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
                    <div
                        className="scrollbar-thin scrollbar-track-purple-100 scrollbar-thumb-purple-600 hover:scrollbar-thumb-purple-800 flex-1 overflow-x-auto overflow-y-auto"
                        style={{ maxHeight: MAX_HEIGHT, minHeight: MIN_HEIGHT }}
                    >
                        <table
                            className="w-full border-separate border-spacing-0"
                            style={{ tableLayout: 'fixed', minWidth: '1400px' }}
                        >
                            <TableHeader
                                table={table}
                                isAdmin={isAdmin}
                                columnWidths={columnWidths}
                                handleMouseDown={handleMouseDown}
                                handleDoubleClick={handleDoubleClick}
                                resizingColumn={resizingColumn}
                            />
                            <TableBody
                                table={table}
                                columns={columns}
                                isAdmin={isAdmin}
                                clearAllFilters={clearAllFilters}
                                columnWidths={columnWidths}
                            />
                        </table>
                    </div>
                </div>

                {paginacaoServidor && paginacaoServidor.totalPages >= PAGINATION_LIMIT && (
                    <PaginationControls
                        currentPage={paginacaoServidor.page}
                        totalPages={paginacaoServidor.totalPages}
                        hasNextPage={paginacaoServidor.hasNextPage}
                        hasPreviousPage={paginacaoServidor.hasPreviousPage}
                        onNextPage={handleNextPage}
                        onPreviousPage={handlePreviousPage}
                        onGoToPage={handleGoToPage}
                        totalChamados={apiData?.totalChamados || 0}
                        limit={PAGINATION_LIMIT}
                    />
                )}
            </div>

            <ModalTabelaOS
                isOpen={isModalListaOSOpen}
                codChamado={selectedChamado}
                onClose={handleCloseModalListaOS}
                onSelectOS={handleOSSelect}
            />
            <ModalValidarOS
                isOpen={isModalOSOpen}
                selectedRow={selectedOS}
                onClose={handleCloseModalOS}
                onSave={handleSaveValidation}
            />
            <ModalSolicitacaoChamado
                isOpen={isModalSolicitacaoOpen}
                onClose={handleCloseSolicitacao}
                solicitacao={selectedChamadoSolicitacao?.SOLICITACAO_CHAMADO || ''}
                assunto={selectedChamadoSolicitacao?.ASSUNTO_CHAMADO || ''}
                codChamado={selectedChamadoSolicitacao?.COD_CHAMADO || 0}
                dataChamado={selectedChamadoSolicitacao?.DATA_CHAMADO}
            />
            <ModalAvaliarChamado
                isOpen={isModalAvaliacaoOpen}
                onClose={handleCloseAvaliacao}
                codChamado={selectedChamadoAvaliacao?.COD_CHAMADO || 0}
                assuntoChamado={selectedChamadoAvaliacao?.ASSUNTO_CHAMADO || null}
                solicitacaoChamado={selectedChamadoAvaliacao?.SOLICITACAO_CHAMADO || null}
                observacaoChamado={selectedChamadoAvaliacao?.OBSAVAL_CHAMADO || null}
                onSave={handleSaveAvaliacao}
            />
        </>
    );
}

// ============================================================
// SUB-COMPONENTES
// ============================================================

interface PaginationControlsProps {
    currentPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    onNextPage: () => void;
    onPreviousPage: () => void;
    onGoToPage: (page: number) => void;
    totalChamados: number;
    limit: number;
}

function PaginationControls({
    currentPage,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    onNextPage,
    onPreviousPage,
    onGoToPage,
    totalChamados,
    limit,
}: PaginationControlsProps) {
    const startRecord = (currentPage - 1) * limit + 1;
    const endRecord = Math.min(currentPage * limit, totalChamados);

    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        const maxPagesToShow = 7;

        if (totalPages <= maxPagesToShow) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            if (currentPage <= 4) {
                for (let i = 1; i <= 5; i++) {
                    pages.push(i);
                }
                pages.push('...');
                pages.push(totalPages);
            } else if (currentPage >= totalPages - 3) {
                pages.push(1);
                pages.push('...');
                for (let i = totalPages - 4; i <= totalPages; i++) {
                    pages.push(i);
                }
            } else {
                pages.push(1);
                pages.push('...');
                for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                    pages.push(i);
                }
                pages.push('...');
                pages.push(totalPages);
            }
        }

        return pages;
    };

    return (
        <div className="flex items-center justify-between border-t border-b border-black bg-gray-200 px-10 py-2 shadow-inner">
            <div className="flex items-center gap-2">
                <span className="text-base font-semibold tracking-widest text-black select-none">
                    Exibindo do{' '}
                    <span className="text-xl font-extrabold">
                        {startRecord} <span className="text-base font-semibold">ao</span>{' '}
                        {endRecord}
                    </span>
                    {', '}
                    de um total de <span className="text-xl font-extrabold">
                        {totalChamados}
                    </span>{' '}
                    chamados
                </span>
            </div>

            <div className="flex items-center gap-4">
                <button
                    onClick={onPreviousPage}
                    disabled={!hasPreviousPage}
                    className={`flex items-center gap-2 rounded-md px-4 py-1 text-base font-semibold tracking-widest transition-all duration-200 select-none ${
                        hasPreviousPage
                            ? 'cursor-pointer border border-purple-900 bg-purple-600 text-white shadow-md shadow-black hover:scale-105 hover:shadow-xl hover:shadow-black active:scale-95'
                            : 'cursor-not-allowed border border-gray-400 bg-gray-300 text-gray-600'
                    }`}
                    title={hasPreviousPage ? 'Página anterior' : 'Primeira página'}
                >
                    <MdNavigateBefore size={20} />
                    Anterior
                </button>

                <div className="flex items-center gap-4">
                    {getPageNumbers().map((pageNum, idx) => {
                        if (pageNum === '...') {
                            return (
                                <span
                                    key={`ellipsis-${idx}`}
                                    className="px-2 text-gray-500 select-none"
                                >
                                    ...
                                </span>
                            );
                        }

                        const isCurrentPage = pageNum === currentPage;

                        return (
                            <button
                                key={pageNum}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onGoToPage(pageNum as number);
                                }}
                                disabled={pageNum === currentPage}
                                className={`min-w-[40px] rounded-md px-4 py-1 text-base font-semibold tracking-widest shadow-md shadow-black transition-all duration-200 select-none ${
                                    isCurrentPage
                                        ? 'cursor-default border border-purple-900 bg-purple-600 text-white'
                                        : 'cursor-pointer border border-gray-400 bg-gray-200 text-gray-700 hover:scale-105 hover:shadow-xl hover:shadow-black active:scale-95'
                                }`}
                                title={`Ir para página ${pageNum}`}
                            >
                                {pageNum}
                            </button>
                        );
                    })}
                </div>

                <button
                    onClick={onNextPage}
                    disabled={!hasNextPage}
                    className={`flex items-center gap-2 rounded-md px-4 py-1 text-base font-semibold tracking-widest transition-all duration-200 select-none ${
                        hasNextPage
                            ? 'cursor-pointer border border-purple-900 bg-purple-600 text-white shadow-md shadow-black hover:scale-105 hover:shadow-xl hover:shadow-black active:scale-95'
                            : 'cursor-not-allowed border border-gray-400 bg-gray-300 text-gray-600'
                    }`}
                    title={hasNextPage ? 'Próxima página' : 'Última página'}
                >
                    Próximo
                    <MdNavigateNext size={20} />
                </button>
            </div>

            <div className="flex items-center gap-2">
                <span className="text-base font-semibold tracking-widest text-black select-none">
                    Página{' '}
                    <span className="text-xl font-extrabold">
                        {currentPage} <span className="text-base font-semibold">de</span>{' '}
                        {totalPages}
                    </span>
                </span>
            </div>
        </div>
    );
}

interface HeaderProps {
    cliente: string;
    recurso: string;
    status: string;
    isAdmin: boolean;
    totalChamados: number;
    totalChamadosFiltrados: number;
    totalOS: number;
    totalOSFiltrados: number;
    totalHorasOS: number;
    totalHorasFiltradas: number;
    hasActiveFilters: boolean;
    clearAllFilters: () => void;
    filteredData: ChamadoRowProps[];
    mes: string;
    ano: string;
    codCliente: string | null;
    onRefresh: () => void;
    totalChamadosNaoFinalizados: number;
    totalChamadosFinalizados: number;
    totalGeralChamados: number;
    totalGeralChamadosAPI: number; // ✅ ADICIONAR ESTA LINHA
}

function Header({
    isAdmin,
    totalChamadosFiltrados,
    totalOSFiltrados,
    totalHorasFiltradas,
    hasActiveFilters,
    clearAllFilters,
    filteredData,
    mes,
    ano,
    codCliente,
    totalChamadosNaoFinalizados,
    totalChamadosFinalizados,
    totalGeralChamados,
    totalGeralChamadosAPI, // ✅ ADICIONAR ESTA LINHA
    status,
}: HeaderProps) {
    const mesAnoTexto = mes && ano ? ` - ${mes}/${ano}` : '';

    // ✅ LÓGICA CORRIGIDA DE EXIBIÇÃO
    const statusUpper = status?.trim().toUpperCase();
    const filtrandoPorFinalizado = statusUpper === 'FINALIZADO';
    const semFiltroStatus = !status || status.trim() === '';

    // Determina qual contagem e label exibir
    let contagemExibida: number;
    let labelContagem: string;

    if (filtrandoPorFinalizado) {
        // Filtrando por FINALIZADO - usa total da API
        contagemExibida = totalGeralChamadosAPI;
        labelContagem = 'FINALIZADOS';
    } else if (isAdmin && semFiltroStatus) {
        // Admin SEM filtro de status = TOTAL GERAL da API
        contagemExibida = totalGeralChamadosAPI;
        labelContagem = 'TOTAL GERAL';
    } else {
        // Demais casos = apenas ATIVOS (não finalizados)
        contagemExibida = totalChamadosNaoFinalizados;
        labelContagem = 'ATIVOS';
    }

    return (
        <header className="flex items-center justify-between gap-4 bg-purple-900 p-6">
            <div className="flex items-center gap-4">
                <IoCall className="text-white" size={50} />
                <div className="flex items-center gap-10">
                    <h2 className="text-2xl font-extrabold tracking-widest text-white select-none">
                        CHAMADOS {labelContagem}
                    </h2>
                    <div className="rounded-full bg-white/30 px-8 py-1 shadow-md ring-2 shadow-black ring-white/30">
                        <span className="text-3xl font-extrabold tracking-widest text-white select-none">
                            {contagemExibida}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-6">
                {hasActiveFilters && (
                    <button
                        onClick={clearAllFilters}
                        title="Limpar Filtros"
                        className="group flex-shrink-0 cursor-pointer rounded-full border border-purple-300 bg-white p-2 text-lg font-extrabold tracking-widest text-white transition-all hover:scale-110 active:scale-95 lg:p-3"
                    >
                        <FaEraser
                            size={14}
                            className="text-black transition-all group-hover:scale-110"
                        />
                    </button>
                )}

                <ExportaExcelChamadosButton
                    data={filteredData}
                    isAdmin={isAdmin}
                    codCliente={codCliente}
                    filtros={{
                        ano,
                        mes,
                        status: '',
                        totalChamados: totalChamadosFiltrados,
                        totalOS: totalOSFiltrados,
                        totalHorasOS: totalHorasFiltradas,
                    }}
                    disabled={filteredData.length === 0}
                />

                <ExportaPDFChamadosButton
                    data={filteredData}
                    isAdmin={isAdmin}
                    codCliente={codCliente}
                    filtros={{
                        ano,
                        mes,
                        status: '',
                        totalChamados: totalChamadosFiltrados,
                        totalOS: totalOSFiltrados,
                        totalHorasOS: totalHorasFiltradas,
                    }}
                    disabled={filteredData.length === 0}
                />

                {isAdmin && (
                    <div className="flex flex-shrink-0 items-center gap-2 rounded-full bg-purple-900 px-3 py-1 ring-2 ring-emerald-600 lg:gap-3 lg:px-4 lg:py-1.5">
                        <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-600"></div>
                        <span className="text-base font-bold tracking-widest whitespace-nowrap text-emerald-300 select-none">
                            Administrador
                        </span>
                    </div>
                )}
            </div>
        </header>
    );
}

function TableHeader({
    table,
    columnWidths,
    handleMouseDown,
    handleDoubleClick,
    resizingColumn,
}: {
    table: any;
    isAdmin: boolean;
    columnWidths: Record<string, number>;
    handleMouseDown: (e: React.MouseEvent, columnId: string) => void;
    handleDoubleClick: (columnId: string) => void;
    resizingColumn: string | null;
}) {
    return (
        <thead className="sticky top-0 z-20">
            {table.getHeaderGroups().map((headerGroup: any) => (
                <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header: any, idx: number) => (
                        <th
                            key={header.id}
                            className="relative bg-teal-700 p-4 shadow-sm shadow-black"
                            style={{ width: `${columnWidths[header.id]}px` }}
                        >
                            {header.isPlaceholder
                                ? null
                                : flexRender(header.column.columnDef.header, header.getContext())}

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
            <tr className="bg-teal-700 shadow-sm shadow-black">
                {table.getAllColumns().map((column: any, idx: number) => (
                    <th
                        key={column.id}
                        className="relative p-1 lg:p-3"
                        style={{ width: `${columnWidths[column.id]}px` }}
                    >
                        <div>
                            {column.id === 'TOTAL_HORAS_OS' ? (
                                <div className="h-[34px] lg:h-[38px]" />
                            ) : (
                                <FiltroHeaderChamados
                                    value={(column.getFilterValue() as string) ?? ''}
                                    onChange={(value: string) => column.setFilterValue(value)}
                                    columnId={column.id}
                                />
                            )}
                        </div>

                        {idx < table.getAllColumns().length - 1 && (
                            <RedimensionarColunas
                                columnId={column.id}
                                onMouseDown={handleMouseDown}
                                onDoubleClick={handleDoubleClick}
                                isResizing={resizingColumn === column.id}
                            />
                        )}
                    </th>
                ))}
            </tr>
        </thead>
    );
}

interface TableBodyProps {
    table: any;
    columns: any;
    isAdmin: boolean;
    clearAllFilters: () => void;
    columnWidths: Record<string, number>;
}

function TableBody({ table, columns, clearAllFilters, columnWidths }: TableBodyProps) {
    const rows = table.getRowModel().rows;

    if (rows.length === 0) {
        return (
            <tbody>
                <tr>
                    <td colSpan={columns.length} className="py-20 text-center lg:py-40">
                        <EmptyState clearAllFilters={clearAllFilters} />
                    </td>
                </tr>
            </tbody>
        );
    }

    return (
        <tbody className="relative">
            {rows.map((row: any, rowIndex: number) => {
                return (
                    <tr
                        key={row.id}
                        data-chamado-id={row.original.COD_CHAMADO}
                        className={`group relative cursor-default transition-all ${
                            rowIndex % 2 === 0
                                ? 'bg-gray-100 hover:bg-teal-200'
                                : 'bg-white hover:bg-teal-200'
                        }`}
                    >
                        {row.getVisibleCells().map((cell: any, cellIndex: number) => (
                            <td
                                key={cell.id}
                                style={{
                                    width: `${columnWidths[cell.column.id]}px`,
                                }}
                                className={`border-b border-gray-500 p-2 transition-all ${
                                    cellIndex === 0 ? 'pl-2 lg:pl-3' : ''
                                } ${cellIndex === row.getVisibleCells().length - 1 ? 'pr-2 lg:pr-4' : ''}`}
                            >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                        ))}
                    </tr>
                );
            })}
        </tbody>
    );
}

function EmptyState({ clearAllFilters }: { clearAllFilters: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 px-4 lg:gap-4">
            <FaEraser className="mb-3 text-slate-300 lg:mb-6" size={60} />
            <div className="text-center text-xl font-extrabold tracking-widest text-black select-none lg:text-3xl">
                Nenhum resultado encontrado
            </div>
            <div className="mb-3 text-center text-base font-semibold tracking-widest text-slate-600 italic select-none lg:mb-6 lg:text-lg">
                Tente ajustar os filtros para encontrar o que procura
            </div>
            <button
                className="group cursor-pointer rounded-md border-none bg-gradient-to-br from-red-600 to-red-700 px-4 py-2 text-base font-extrabold tracking-widest text-white shadow-md shadow-black transition-all hover:scale-110 active:scale-95 lg:px-6 lg:py-3 lg:text-lg"
                onClick={clearAllFilters}
            >
                Limpar Filtros
            </button>
        </div>
    );
}
