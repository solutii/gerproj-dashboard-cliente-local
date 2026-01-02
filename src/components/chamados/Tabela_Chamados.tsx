// src/components/chamados/Tabela_Chamados.tsx - PARTE 1
'use client';

import { useQuery } from '@tanstack/react-query';
import {
    ColumnFiltersState,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from '@tanstack/react-table';
import React, { useCallback, useMemo, useState } from 'react';
import { FaEraser } from 'react-icons/fa';
import { IoCall } from 'react-icons/io5';
import { MdNavigateBefore, MdNavigateNext } from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import { useFilters } from '../../context/FiltersContext';
import { useRedimensionarColunas } from '../../hooks/useRedimensionarColunas';
import { IsError } from '../shared/IsError';
import { IsLoading } from '../shared/IsLoading';
import { ExportaExcelChamadosButton } from './Button_Excel';
import { ExportaPDFChamadosButton } from './Button_PDF';
import { ChamadoRowProps, getColunasChamados } from './Colunas_Tabela_Chamados';
import { OSRowProps } from './Colunas_Tabela_OS';
import { FiltroHeaderChamados, useFiltrosChamados } from './Filtro_Header_Tabela_Chamados';
import { ModalAvaliarChamado } from './Modal_Avaliar_Chamado';
import { ModalSolicitacaoChamado } from './Modal_Solicitacao_Chamado';
import { ModalTabelaOS } from './Modal_Tabela_OS';
import { ModalValidarOS } from './Modal_Validar_OS';
import { RedimensionarColunas } from './Redimensionar_Colunas';

// ===== CONFIGURAÇÃO DE ALTURA DA TABELA =====
const ZOOM_LEVEL = 0.67;
const ZOOM_COMPENSATION = 100 / ZOOM_LEVEL;
const HEADER_HEIGHT = 293;
const BASE_MIN_HEIGHT = 400;
const MAX_HEIGHT = `calc(${ZOOM_COMPENSATION}vh - ${HEADER_HEIGHT}px)`;
const MIN_HEIGHT = `${(BASE_MIN_HEIGHT * ZOOM_COMPENSATION) / 100}px`;
// ============================================

// ==================== INTERFACE ====================
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

declare module '@tanstack/react-table' {
    interface TableMeta<TData> {
        handleChamadoClick?: (codChamado: number, temOS: boolean) => void;
    }
}

// ==================== UTILITÁRIOS ====================
const createAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'x-is-logged-in': localStorage.getItem('isLoggedIn') || 'false',
    'x-is-admin': localStorage.getItem('isAdmin') || 'false',
    'x-user-email': localStorage.getItem('userEmail') || '',
    'x-cod-cliente': localStorage.getItem('codCliente') || '',
});

// ==================== FUNÇÕES DE FETCH ====================
const fetchChamados = async ({
    ano,
    mes,
    isAdmin,
    codCliente,
    cliente,
    recurso,
    status,
    page,
    limit,
}: {
    ano: string;
    mes: string;
    isAdmin: boolean;
    codCliente: string | null;
    cliente?: string;
    recurso?: string;
    status?: string;
    page: number;
    limit: number;
}): Promise<ApiResponseChamados> => {
    const params = new URLSearchParams({
        ano,
        mes,
        isAdmin: String(isAdmin),
        page: String(page),
        limit: String(limit),
        ...(cliente && { codClienteFilter: cliente }),
        ...(recurso && { codRecursoFilter: recurso }),
        ...(status && { statusFilter: status }),
    });

    if (!isAdmin && codCliente) {
        params.append('codCliente', codCliente);
    }

    const response = await fetch(`/api/chamados?${params.toString()}`, {
        headers: createAuthHeaders(),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao carregar chamados');
    }

    return response.json();
};

// ==================== COMPONENTE PRINCIPAL ====================
export function TabelaChamados() {
    const { isAdmin, codCliente, isLoggedIn } = useAuth();
    const { filters } = useFilters();
    const { ano, mes, cliente, recurso, status } = filters;

    // Estados
    const [page, setPage] = useState(1);
    const [limit] = useState(50); // Pode tornar configurável depois
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
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

    const { columnFilterFn } = useFiltrosChamados();

    const initialColumnWidths = {
        COD_CHAMADO: 110,
        DATA_CHAMADO: 170,
        PRIOR_CHAMADO: 110,
        ASSUNTO_CHAMADO: 280,
        EMAIL_CHAMADO: 220,
        NOME_CLASSIFICACAO: 180,
        DTENVIO_CHAMADO: 170,
        NOME_RECURSO: 180,
        STATUS_CHAMADO: 220,
        CONCLUSAO_CHAMADO: 150,
        TOTAL_HORAS_OS: 120,
    };

    const { columnWidths, handleMouseDown, handleDoubleClick, resizingColumn } =
        useRedimensionarColunas(initialColumnWidths);

    // Query de Chamados
    const {
        data: apiData,
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: [
            'tabela-chamados',
            ano ?? 0,
            mes ?? 0,
            cliente ?? '',
            recurso ?? '',
            status ?? '',
            isAdmin,
            codCliente ?? '',
            page,
            limit,
        ],
        queryFn: () =>
            fetchChamados({
                ano: String(ano ?? new Date().getFullYear()),
                mes: String(mes ?? new Date().getMonth() + 1),
                isAdmin,
                codCliente,
                cliente: cliente ?? '',
                recurso: recurso ?? '',
                status: status ?? '',
                page,
                limit,
            }),
        enabled: isLoggedIn && !!ano && !!mes,
        staleTime: 1000 * 60 * 5,
        retry: 2,
    });

    const data = useMemo(() => {
        const chamados = apiData?.data ?? [];
        return chamados;
    }, [apiData?.data]);

    const totalOS = useMemo(() => apiData?.totalOS ?? 0, [apiData?.totalOS]);
    const pagination = useMemo(() => apiData?.pagination, [apiData?.pagination]);

    // Funções de paginação
    const handleNextPage = useCallback(() => {
        if (pagination?.hasNextPage) {
            setPage((prev) => prev + 1);
            setColumnFilters([]);
        }
    }, [pagination?.hasNextPage]);

    const handlePreviousPage = useCallback(() => {
        if (pagination?.hasPreviousPage) {
            setPage((prev) => prev - 1);
            setColumnFilters([]);
        }
    }, [pagination?.hasPreviousPage]);

    const handleGoToPage = useCallback((pageNumber: number) => {
        setPage(pageNumber);
        setColumnFilters([]);
    }, []);

    // Função para abrir modal de lista de OS's
    const handleChamadoClick = useCallback((codChamado: number, temOS: boolean) => {
        if (temOS) {
            setSelectedChamado(codChamado);
            setIsModalListaOSOpen(true);
        }
    }, []);

    // Função para abrir modal de detalhes da OS
    const handleOSSelect = useCallback((os: OSRowProps) => {
        setSelectedOS(os);
        setIsModalOSOpen(true);
    }, []);

    // Função para fechar modal de lista de OS's
    const handleCloseModalListaOS = useCallback(() => {
        setIsModalListaOSOpen(false);
        setSelectedChamado(null);
    }, []);

    // Função para fechar modal de detalhes da OS
    const handleCloseModalOS = useCallback(() => {
        setIsModalOSOpen(false);
        setSelectedOS(null);
    }, []);

    // Função para salvar validação
    const handleSaveValidation = useCallback(
        (updatedRow: OSRowProps) => {
            refetch();
        },
        [refetch]
    );

    // Função para abrir modal de solicitação
    const handleOpenSolicitacao = useCallback((chamado: ChamadoRowProps) => {
        setSelectedChamadoSolicitacao(chamado);
        setIsModalSolicitacaoOpen(true);
    }, []);

    // Função para fechar modal de solicitação
    const handleCloseSolicitacao = useCallback(() => {
        setIsModalSolicitacaoOpen(false);
        setSelectedChamadoSolicitacao(null);
    }, []);

    // Função para abrir modal de avaliação
    const handleOpenAvaliacao = useCallback((chamado: ChamadoRowProps) => {
        setSelectedChamadoAvaliacao(chamado);
        setIsModalAvaliacaoOpen(true);
    }, []);

    // Função para fechar modal de avaliação
    const handleCloseAvaliacao = useCallback(() => {
        setIsModalAvaliacaoOpen(false);
        setSelectedChamadoAvaliacao(null);
    }, []);

    // Função para salvar avaliação
    const handleSaveAvaliacao = useCallback(() => {
        refetch();
    }, [refetch]);

    // Colunas dinâmicas
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

    // ==================== CALLBACKS ====================
    const clearAllFilters = useCallback(() => {
        setColumnFilters([]);
    }, []);

    // ==================== MEMORIZAÇÕES ====================
    const hasActiveFilters = useMemo(() => {
        return columnFilters.some((filter) => {
            const value = filter.value;
            if (value == null) return false;
            if (typeof value === 'string') {
                return value.trim() !== '';
            }
            return true;
        });
    }, [columnFilters]);

    const dadosFiltrados = useMemo(() => {
        if (!hasActiveFilters) {
            return data;
        }

        return data.filter((row) => {
            return columnFilters.every((filter) => {
                const columnId = filter.id;
                const filterValue = filter.value;

                if (
                    !filterValue ||
                    (typeof filterValue === 'string' && filterValue.trim() === '')
                ) {
                    return true;
                }

                const normalizedFilterValue =
                    typeof filterValue === 'string' ? filterValue : String(filterValue);

                const fakeRow: any = {
                    getValue: (id: string) => row[id as keyof ChamadoRowProps],
                };

                return columnFilterFn(fakeRow, columnId as string, normalizedFilterValue);
            });
        });
    }, [data, columnFilters, hasActiveFilters, columnFilterFn]);

    const totalHorasOS = useMemo(() => apiData?.totalHorasOS ?? 0, [apiData?.totalHorasOS]);

    const totalHorasFiltradas = useMemo(() => {
        if (!hasActiveFilters) {
            return totalHorasOS;
        }

        return dadosFiltrados.reduce((acc, chamado) => {
            return acc + (chamado.TOTAL_HORAS_OS || 0);
        }, 0);
    }, [dadosFiltrados, hasActiveFilters, totalHorasOS]);

    const table = useReactTable<ChamadoRowProps>({
        data: dadosFiltrados,
        columns,
        getCoreRowModel: getCoreRowModel(),
        state: {
            columnFilters,
        },
        onColumnFiltersChange: setColumnFilters,
        meta: {
            handleChamadoClick,
        },
    });

    const totalChamados = useMemo(() => apiData?.totalChamados ?? 0, [apiData?.totalChamados]);
    const totalChamadosFiltrados = useMemo(() => dadosFiltrados.length, [dadosFiltrados]);
    const chamadosExibidos = useMemo(() => {
        return hasActiveFilters ? totalChamadosFiltrados : data.length;
    }, [hasActiveFilters, totalChamadosFiltrados, data.length]);

    const totalOSFiltrados = useMemo(() => {
        if (!hasActiveFilters) {
            return totalOS;
        }

        return dadosFiltrados.reduce((acc, chamado) => {
            return acc + (chamado.TOTAL_HORAS_OS > 0 ? 1 : 0);
        }, 0);
    }, [dadosFiltrados, hasActiveFilters, totalOS]);

    // ==================== RENDERIZAÇÃO CONDICIONAL ====================
    if (!isLoggedIn) {
        return (
            <IsError
                isError={true}
                error={new Error('Você precisa estar logado para visualizar os chamados')}
                title="Acesso Negado"
            />
        );
    }

    if (isLoading) {
        return <IsLoading isLoading={isLoading} title="Aguarde, buscando dados do servidor" />;
    }

    if (error) {
        return (
            <IsError isError={!!error} error={error as Error} title="Erro ao Carregar Chamados" />
        );
    }

    // ==================== RENDERIZAÇÃO PRINCIPAL ====================
    return (
        <>
            <div className="relative flex h-full w-full flex-col overflow-hidden border border-b-slate-500 bg-white shadow-md shadow-black">
                <Header
                    isAdmin={isAdmin}
                    totalChamados={totalChamados}
                    totalChamadosFiltrados={chamadosExibidos}
                    totalOS={totalOS}
                    totalOSFiltrados={totalOSFiltrados}
                    totalHorasOS={totalHorasOS}
                    totalHorasFiltradas={totalHorasFiltradas}
                    hasActiveFilters={hasActiveFilters}
                    clearAllFilters={clearAllFilters}
                    filteredData={dadosFiltrados}
                    mes={String(mes)}
                    ano={String(ano)}
                    codCliente={codCliente}
                    onRefresh={() => {
                        clearAllFilters();
                        setPage(1);
                        setTimeout(() => {
                            if (typeof window !== 'undefined') window.location.reload();
                        }, 100);
                    }}
                />

                <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
                    <div
                        className="scrollbar-thin scrollbar-track-purple-100 scrollbar-thumb-purple-600 hover:scrollbar-thumb-purple-800 flex-1 overflow-x-auto overflow-y-auto"
                        style={{
                            maxHeight: MAX_HEIGHT,
                            minHeight: MIN_HEIGHT,
                        }}
                    >
                        <table
                            className="w-full border-separate border-spacing-0"
                            style={{
                                tableLayout: 'fixed',
                                minWidth: '1400px',
                            }}
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

                {/* Controles de Paginação */}
                {pagination && pagination.totalPages > 1 && (
                    <PaginationControls
                        currentPage={pagination.page}
                        totalPages={pagination.totalPages}
                        hasNextPage={pagination.hasNextPage}
                        hasPreviousPage={pagination.hasPreviousPage}
                        onNextPage={handleNextPage}
                        onPreviousPage={handlePreviousPage}
                        onGoToPage={handleGoToPage}
                        totalChamados={totalChamados}
                        limit={limit}
                    />
                )}
            </div>

            {/* Modal Lista de OS's */}
            <ModalTabelaOS
                isOpen={isModalListaOSOpen}
                codChamado={selectedChamado}
                onClose={handleCloseModalListaOS}
                onSelectOS={handleOSSelect}
            />

            {/* Modal Detalhes da OS */}
            <ModalValidarOS
                isOpen={isModalOSOpen}
                selectedRow={selectedOS}
                onClose={handleCloseModalOS}
                onSave={handleSaveValidation}
            />

            {/* Modal Solicitação do Chamado */}
            <ModalSolicitacaoChamado
                isOpen={isModalSolicitacaoOpen}
                onClose={handleCloseSolicitacao}
                solicitacao={selectedChamadoSolicitacao?.SOLICITACAO_CHAMADO || ''}
                assunto={selectedChamadoSolicitacao?.ASSUNTO_CHAMADO || ''}
                codChamado={selectedChamadoSolicitacao?.COD_CHAMADO || 0}
                dataChamado={selectedChamadoSolicitacao?.DATA_CHAMADO}
            />

            {/* Modal Avaliação do Chamado */}
            <ModalAvaliarChamado
                isOpen={isModalAvaliacaoOpen}
                onClose={handleCloseAvaliacao}
                codChamado={selectedChamadoAvaliacao?.COD_CHAMADO || 0}
                assuntoChamado={selectedChamadoAvaliacao?.ASSUNTO_CHAMADO || null}
                solicitacaoChamado={selectedChamadoAvaliacao?.SOLICITACAO_CHAMADO || null}
                onSave={handleSaveAvaliacao}
            />
        </>
    );
}

// ============================================================
// ========== SUB-COMPONENTES =================================
// ============================================================

// ==================== PAGINATION CONTROLS ====================
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
    // Calcular range de registros exibidos
    const startRecord = (currentPage - 1) * limit + 1;
    const endRecord = Math.min(currentPage * limit, totalChamados);

    // Gerar números de páginas para exibir
    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        const maxPagesToShow = 7; // Número máximo de botões de página

        if (totalPages <= maxPagesToShow) {
            // Mostrar todas as páginas
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Lógica para mostrar páginas com reticências
            if (currentPage <= 4) {
                // Início: 1 2 3 4 5 ... 10
                for (let i = 1; i <= 5; i++) {
                    pages.push(i);
                }
                pages.push('...');
                pages.push(totalPages);
            } else if (currentPage >= totalPages - 3) {
                // Final: 1 ... 6 7 8 9 10
                pages.push(1);
                pages.push('...');
                for (let i = totalPages - 4; i <= totalPages; i++) {
                    pages.push(i);
                }
            } else {
                // Meio: 1 ... 4 5 6 ... 10
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
            {/* Informações de registros */}
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

            {/* Controles de navegação */}
            <div className="flex items-center gap-4">
                {/* Botão Anterior */}
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

                {/* Números das páginas */}
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
                                onClick={() => onGoToPage(pageNum as number)}
                                className={`min-w-[40px] cursor-pointer rounded-md px-4 py-1 text-base font-semibold tracking-widest shadow-md shadow-black transition-all duration-200 select-none hover:scale-105 hover:shadow-xl hover:shadow-black active:scale-9 ${
                                    isCurrentPage
                                        ? 'border border-purple-900 bg-purple-600 text-white'
                                        : 'border border-gray-400 bg-gray-200 text-gray-700'
                                }`}
                                title={`Ir para página ${pageNum}`}
                            >
                                {pageNum}
                            </button>
                        );
                    })}
                </div>

                {/* Botão Próximo */}
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

            {/* Info da página atual */}
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

// ==================== HEADER ====================
interface HeaderProps {
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
}: HeaderProps) {
    const { cliente, recurso, status } = useFilters().filters;

    return (
        <header className="flex items-center justify-between gap-4 bg-purple-900 p-6">
            {/* Esquerda: Título */}
            <div className="flex items-center gap-4">
                <IoCall className="text-white" size={50} />
                <h2 className="text-2xl font-extrabold tracking-widest text-white select-none">
                    CHAMADOS - {mes}/{ano}
                </h2>
            </div>

            {/* Direita: Ações */}
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
                        cliente,
                        recurso,
                        status,
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
                        cliente,
                        recurso,
                        status,
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

// ==================== TABLE HEADER ====================
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
    const hasAnyFilter = table.getAllColumns().some((column: any) => {
        const value = column.getFilterValue();
        return value !== '' && value != null;
    });

    return (
        <thead className="group/header sticky top-0 z-20">
            {table.getHeaderGroups().map((headerGroup: any) => (
                <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header: any, idx: number) => (
                        <th
                            key={header.id}
                            className="relative bg-teal-700 p-4 shadow-md shadow-black"
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
            <tr
                className={`bg-teal-700 shadow-sm shadow-black transition-all duration-200 ease-in-out ${
                    hasAnyFilter
                        ? 'opacity-100'
                        : 'h-0 overflow-hidden opacity-0 group-hover/header:h-auto group-hover/header:opacity-100'
                }`}
            >
                {table.getAllColumns().map((column: any, idx: number) => (
                    <th
                        key={column.id}
                        className={`relative transition-all duration-200 ${
                            hasAnyFilter
                                ? 'p-1 lg:p-2'
                                : 'h-0 p-0 group-hover/header:h-auto group-hover/header:p-1 group-hover/header:lg:p-3'
                        }`}
                        style={{ width: `${columnWidths[column.id]}px` }}
                    >
                        <div
                            className={`transition-all duration-200 ${
                                hasAnyFilter
                                    ? 'scale-100 opacity-100'
                                    : 'h-0 scale-95 opacity-0 group-hover/header:h-auto group-hover/header:scale-100 group-hover/header:opacity-100'
                            }`}
                        >
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

// ==================== TABLE BODY ====================
interface TableBodyProps {
    table: any;
    columns: any;
    isAdmin: boolean;
    clearAllFilters: () => void;
    columnWidths: Record<string, number>;
}

function TableBody({ table, columns, isAdmin, clearAllFilters, columnWidths }: TableBodyProps) {
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
                const handleChamadoClick = table.options.meta?.handleChamadoClick;
                const temOS = row.original.TEM_OS ?? false;

                return (
                    <tr
                        key={row.id}
                        data-chamado-id={row.original.COD_CHAMADO}
                        onClick={() => {
                            if (temOS && handleChamadoClick) {
                                handleChamadoClick(row.original.COD_CHAMADO, temOS);
                            }
                        }}
                        className={`group relative transition-all ${
                            temOS ? 'cursor-pointer' : 'cursor-not-allowed'
                        } ${
                            rowIndex % 2 === 0
                                ? 'bg-white hover:bg-teal-200'
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

// ==================== EMPTY STATE ====================
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
