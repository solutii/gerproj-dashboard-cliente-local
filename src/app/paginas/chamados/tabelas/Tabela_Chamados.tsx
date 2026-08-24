// src/app/paginas/chamados/tabelas/Tabela_Chamados.tsx

'use client';

import { ExportarExcelTabelaChamados } from '@/app/paginas/chamados/componentes/Exportar_Excel_Tabela_Chamados';
import { ExportarPDFTabelaChamados } from '@/app/paginas/chamados/componentes/Exportar_PDF_Tabela_Chamados';
import { useFiltrosChamado } from '@/app/paginas/chamados/componentes/Filtros_Tabela_Chamados';
import { RedimensionarColunas } from '@/app/paginas/chamados/componentes/Redimensionar_Colunas';
import { ModalAssuntoSolicitacaoChamado } from '@/app/paginas/chamados/modais/Modal_Assunto_Solicitacao_Chamado';
import { ModalAvaliarChamado } from '@/app/paginas/chamados/modais/Modal_Avaliar_Chamado';
import { ModalHistoricoChamado } from '@/app/paginas/chamados/modais/Modal_Historico_Chamado';
import { ModalValidarOS } from '@/app/paginas/chamados/modais/Modal_Validar_OS';
import { OSRowProps } from '@/app/paginas/chamados/tabelas/Colunas_Tabela_OS';
import { TabelaOS } from '@/app/paginas/chamados/tabelas/Tabela_OS';
import { IsError } from '@/components/IsError';
import { IsLoading } from '@/components/IsLoading';
import { useHorasAdicionais } from '@/hooks/useHorasAdicionais';
import { useHorasPorMes } from '@/hooks/useHorasPorMes';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useRedimensionarColunas } from '@/hooks/useRedimensionarColunas';
import { useAuthStore } from '@/store/useAuthStore';
import { useQuery } from '@tanstack/react-query';
import {
    ColumnFiltersState,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from '@tanstack/react-table';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BsEraserFill } from 'react-icons/bs';
import { FaEraser } from 'react-icons/fa';
import { IoCall } from 'react-icons/io5';
import {
    MdArrowDownward,
    MdArrowUpward,
    MdChecklist,
    MdNavigateBefore,
    MdNavigateNext,
    MdUnfoldMore,
} from 'react-icons/md';
import { TbMoodEmptyFilled } from 'react-icons/tb';
import { ChamadoRowProps, getColunasChamados } from './Colunas_Tabela_Chamados';

// =====================================================
// CONFIGURAÇÕES E CONSTANTES
// =====================================================
const ZOOM_LEVEL = 0.67;
const ZOOM_COMPENSATION = 100 / ZOOM_LEVEL;
const HEADER_HEIGHT = 293;
const BASE_MIN_HEIGHT = 400;
// Compensados pro zoom — só fazem sentido em desktop (ver useIsDesktop).
const MAX_HEIGHT_DESKTOP = `calc(${ZOOM_COMPENSATION}vh - ${HEADER_HEIGHT}px)`;
const MIN_HEIGHT_DESKTOP = `${(BASE_MIN_HEIGHT * ZOOM_COMPENSATION) / 100}px`;
// Sem zoom (tablet/mobile), unidades reais — não precisa de compensação.
const MAX_HEIGHT_MOBILE = 'calc(100vh - 220px)';
const MIN_HEIGHT_MOBILE = '300px';
const PAGINATION_LIMIT = 30;

const INITIAL_COLUMN_WIDTHS = {
    COD_CHAMADO: 110,
    DATA_CHAMADO: 160,
    DTENVIO_CHAMADO: 160,
    DTINI_CHAMADO: 160,
    SLA_INFO: 100,
    HISTORICO: 100,
    DATA_HISTCHAMADO: 160,
    STATUS_CHAMADO: 240,
    ASSUNTO_CHAMADO: 300,
    EMAIL_CHAMADO: 240,
    NOME_CLASSIFICACAO: 180,
    NOME_RECURSO: 180,
    PRIOR_CHAMADO: 100,
    HORAS: 140,
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
    codCliente: string | null;
    cliente?: string;
    status?: string;
    recurso?: string;
    chamado?: string;
    prioridade?: string;
    classificacao?: string;
    entrada?: string;
    atribuicao?: string;
    inicio?: string;
    finalizacao?: string;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    page: number;
    limit: number;
    columnFilters?: ColumnFiltersState;
}

// Colunas ordenáveis no servidor — mesma allowlist de src/app/api/chamados/route.ts
// (SORT_COLUMN_MAP). Nunca adicionar um id aqui sem adicionar lá também.
const SORTABLE_COLUMNS = new Set([
    'COD_CHAMADO',
    'DATA_CHAMADO',
    'DTENVIO_CHAMADO',
    'DTINI_CHAMADO',
    'ASSUNTO_CHAMADO',
    'STATUS_CHAMADO',
    'PRIOR_CHAMADO',
    'EMAIL_CHAMADO',
    'NOME_RECURSO',
    'NOME_CLASSIFICACAO',
]);

interface SortState {
    id: string;
    desc: boolean;
}

// As 6 colunas essenciais nunca podem ser ocultadas pelo botão "Colunas".
const COLUNAS_SEMPRE_VISIVEIS = new Set([
    'COD_CHAMADO',
    'STATUS_CHAMADO',
    'ASSUNTO_CHAMADO',
    'DATA_CHAMADO',
    'NOME_RECURSO',
    'PRIOR_CHAMADO',
]);

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
    codCliente,
    cliente,
    status,
    recurso,
    chamado,
    prioridade,
    classificacao,
    entrada,
    atribuicao,
    inicio,
    finalizacao,
    sortBy,
    sortDir,
    page,
    limit,
    columnFilters,
}: FetchChamadosParams): Promise<ApiResponseChamados> => {
    const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        incluirSLA: 'true',
    });

    if (cliente) params.append('codClienteFilter', cliente);

    // Qualquer status selecionado vai pro servidor — antes só FINALIZADO/TODOS
    // eram enviados, e os demais valores (ex. "ATRIBUIDO") ficavam só no
    // filtro client-side da página atual (mesmo bug dos filtros abaixo).
    if (status && status.trim()) params.append('statusFilter', status.trim());

    if (codCliente) {
        params.append('codCliente', codCliente);
        if (ano) params.append('ano', ano);
        if (mes) params.append('mes', mes);
    }

    // Filtros do painel — enviados pro servidor pra valerem sobre o resultado
    // inteiro, não só a página de 30 já carregada.
    if (recurso) params.append('codRecursoFilter', recurso);
    if (chamado) params.append('codChamado', chamado);
    if (prioridade) params.append('filter_PRIOR_CHAMADO', prioridade);
    if (classificacao) params.append('filter_NOME_CLASSIFICACAO', classificacao);
    if (entrada) params.append('filter_DATA_CHAMADO', entrada);
    if (atribuicao) params.append('filter_DTENVIO_CHAMADO', atribuicao);
    if (inicio) params.append('filter_DTINI_CHAMADO', inicio);
    if (finalizacao) params.append('filter_DATA_HISTCHAMADO', finalizacao);

    if (sortBy) {
        params.append('sortBy', sortBy);
        params.append('sortDir', sortDir === 'asc' ? 'asc' : 'desc');
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
    const { codCliente, isLoggedIn } = useAuthStore();
    const isDesktop = useIsDesktop();
    const filtros = useFiltrosChamado();
    const {
        ano,
        mes,
        cliente,
        recurso,
        status,
        chamado,
        entrada,
        prioridade,
        classificacao,
        atribuicao,
        finalizacao,
        inicio,
    } = filtros;

    // Estados principais
    const [page, setPage] = useState(1);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [sorting, setSorting] = useState<SortState | null>(null);
    const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
    const aplicouPadraoResponsivoRef = useRef(false);

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
    const [isModalHistoricoOpen, setIsModalHistoricoOpen] = useState(false);
    const [selectedChamadoHistorico, setSelectedChamadoHistorico] =
        useState<ChamadoRowProps | null>(null);

    // Hook de redimensionamento
    const { columnWidths, handleMouseDown, handleDoubleClick, resizingColumn } =
        useRedimensionarColunas(INITIAL_COLUMN_WIDTHS);

    // =====================================================
    // MEMOIZAÇÕES E DERIVAÇÕES DE ESTADO
    // =====================================================
    const columnFiltersKey = useMemo(() => serializeColumnFilters(columnFilters), [columnFilters]);

    const queryEnabled = useMemo(() => {
        return isLoggedIn;
    }, [isLoggedIn]);

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
            status ?? '',
            recurso ?? '',
            chamado ?? '',
            prioridade ?? '',
            classificacao ?? '',
            entrada ?? '',
            atribuicao ?? '',
            inicio ?? '',
            finalizacao ?? '',
            codCliente ?? '',
            page,
            PAGINATION_LIMIT,
            columnFiltersKey,
            sorting?.id ?? '',
            sorting?.desc ?? '',
        ],
        queryFn: () =>
            fetchChamados({
                ano: ano !== undefined ? String(ano) : undefined,
                mes: mes !== undefined ? String(mes) : undefined,
                codCliente,
                cliente: cliente ?? '',
                status: status ?? '',
                recurso: recurso ?? '',
                chamado: chamado ?? '',
                prioridade: prioridade ?? '',
                classificacao: classificacao ?? '',
                entrada: entrada ?? '',
                atribuicao: atribuicao ?? '',
                inicio: inicio ?? '',
                finalizacao: finalizacao ?? '',
                sortBy: sorting?.id,
                sortDir: sorting ? (sorting.desc ? 'desc' : 'asc') : undefined,
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
    // ✅ OT1: IDs com OS — chave estável para evitar recriação de array
    // Mesmo padrão do useDadosMemoizados no Filtros: gera string com join
    // e só recria o array quando a string muda de fato.
    // =====================================================
    const idsComOSKey = useMemo(
        () =>
            (apiData?.data ?? [])
                .filter((c) => c.TEM_OS)
                .map((c) => c.COD_CHAMADO)
                .join(','),
        [apiData?.data]
    );

    const idsComOS = useMemo(
        () => (idsComOSKey ? idsComOSKey.split(',').map(Number) : []),

        [idsComOSKey]
    );

    const { getHoras, isLoading: isLoadingHoras } = useHorasPorMes({
        codChamados: idsComOS,
        enabled: idsComOS.length > 0,
    });

    const { getHorasAdicionais, isLoading: isLoadingHorasAdicionais } = useHorasAdicionais({
        codChamados: idsComOS,
        enabled: idsComOS.length > 0,
    });

    // =====================================================
    // FILTRAGENS E TRANSFORMAÇÕES DE DADOS
    // =====================================================
    // Status, Consultor, Nº Chamado, Prioridade, Classificação, Entrada,
    // Atribuição, Início e Finalização agora são todos filtrados no servidor
    // (ver fetchChamados) — a página já chega filtrada. `columnFilters` (do
    // próprio TanStack Table) também é enviado pro servidor, mas mantemos
    // esse filtro extra no cliente como reforço, já que é idempotente sobre
    // dados já filtrados.
    const dadosCompletosFiltrados = useMemo(() => {
        const chamados = apiData?.data ?? [];
        if (columnFilters.length === 0) return chamados;
        return chamados.filter((row) => {
            return columnFilters.every((filter) => {
                if (!filter.value || (typeof filter.value === 'string' && !filter.value.trim()))
                    return true;
                const cellValue = row[filter.id as keyof ChamadoRowProps];
                if (cellValue == null) return false;
                return String(cellValue).toUpperCase().includes(String(filter.value).toUpperCase());
            });
        });
    }, [apiData?.data, columnFilters]);

    // =====================================================
    // TOTALIZADORES
    // =====================================================

    // ✅ OT2: loop simples em vez de .filter().length — evita criar array intermediário
    const totalChamadosNaoFinalizados = useMemo(() => {
        return apiData?.data?.length ?? 0;
    }, [apiData?.data]);

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

    // ✅ OT3: ref para onDataChange — evita loop quando o pai não memoiza a função
    const onDataChangeRef = useRef(onDataChange);
    useEffect(() => {
        onDataChangeRef.current = onDataChange;
    });

    useEffect(() => {
        if (onDataChangeRef.current) onDataChangeRef.current(dadosCompletosFiltrados);
    }, [dadosCompletosFiltrados]);

    useEffect(() => {
        setPage(1);
    }, [
        status,
        recurso,
        chamado,
        entrada,
        prioridade,
        classificacao,
        atribuicao,
        finalizacao,
        inicio,
        columnFiltersKey,
        sorting?.id,
        sorting?.desc,
    ]);

    // Padrão de visibilidade de colunas responsivo: em desktop, todas
    // visíveis (comportamento de sempre); abaixo disso, só as 6 essenciais.
    // Aplica só uma vez (não briga com uma escolha manual do usuário se a
    // janela for redimensionada depois).
    useEffect(() => {
        if (aplicouPadraoResponsivoRef.current) return;
        aplicouPadraoResponsivoRef.current = true;
        if (isDesktop) return;

        const colunasOpcionais = Object.keys(INITIAL_COLUMN_WIDTHS).filter(
            (id) => !COLUNAS_SEMPRE_VISIVEIS.has(id)
        );
        setColumnVisibility(Object.fromEntries(colunasOpcionais.map((id) => [id, false])));
    }, [isDesktop]);

    // =====================================================
    // CALLBACKS
    // =====================================================
    const handleSortColumn = useCallback((columnId: string) => {
        if (!SORTABLE_COLUMNS.has(columnId)) return;
        setSorting((prev) => {
            if (!prev || prev.id !== columnId) return { id: columnId, desc: false };
            if (!prev.desc) return { id: columnId, desc: true };
            return null;
        });
    }, []);
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

    // Cleanup de verdade: guarda o id do timeout numa ref e limpa tanto antes
    // de agendar um novo quanto no unmount — o closure que era retornado
    // antes nunca era chamado por ninguém (a função não roda num useEffect).
    const reabrirListaOSTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (reabrirListaOSTimerRef.current) clearTimeout(reabrirListaOSTimerRef.current);
        };
    }, []);

    const handleSaveValidation = useCallback((_updatedRow: OSRowProps) => {
        setIsModalOSOpen(false);
        setSelectedOS(null);
        setIsModalListaOSOpen(false);

        if (reabrirListaOSTimerRef.current) clearTimeout(reabrirListaOSTimerRef.current);
        reabrirListaOSTimerRef.current = setTimeout(() => {
            setIsModalListaOSOpen(true);
        }, 50);
    }, []);

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

    const handleOpenHistorico = useCallback((chamado: ChamadoRowProps) => {
        setSelectedChamadoHistorico(chamado);
        setIsModalHistoricoOpen(true);
    }, []);

    const handleCloseHistorico = useCallback(() => {
        setIsModalHistoricoOpen(false);
        setSelectedChamadoHistorico(null);
    }, []);

    // =====================================================
    // COLUNAS E TABELA
    // =====================================================

    // ✅ OT5: removidos isAdmin e columnWidths das dependências — não são usados
    // dentro de getColunasChamados, causavam recriação desnecessária das colunas
    const columns = useMemo(
        () =>
            getColunasChamados(
                handleOpenSolicitacao,
                handleOpenAvaliacao,
                getHoras,
                isLoadingHoras,
                getHorasAdicionais,
                isLoadingHorasAdicionais,
                handleOpenHistorico
            ),
        [
            handleOpenSolicitacao,
            handleOpenAvaliacao,
            getHoras,
            isLoadingHoras,
            getHorasAdicionais,
            isLoadingHorasAdicionais,
            handleOpenHistorico,
        ]
    );

    const table = useReactTable<ChamadoRowProps>({
        data: dadosCompletosFiltrados,
        columns,
        getCoreRowModel: getCoreRowModel(),
        state: { columnFilters, columnVisibility },
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        meta: { handleChamadoClick },
        enableColumnFilters: true,
        manualFiltering: false,
        autoResetAll: false,
    });

    // =====================================================
    // RENDERIZAÇÃO CONDICIONAL
    // =====================================================
    if (!isLoggedIn)
        return <IsError isError={true} error={new Error('Você precisa estar logado')} title={''} />;

    if (isLoading)
        return <IsLoading isLoading={isLoading} title="Buscando Chamados no banco de dados..." />;

    if (error) return <IsError isError={!!error} error={error as Error} title={''} />;

    // =====================================================
    // RENDERIZAÇÃO PRINCIPAL
    // =====================================================
    return (
        <>
            <div className="relative flex h-full w-full flex-col overflow-hidden bg-white">
                <Header
                    totalChamadosFiltrados={apiData?.totalChamados || 0}
                    totalOSFiltrados={apiData?.totalOS || 0}
                    totalHorasFiltradas={apiData?.totalHorasOS || 0}
                    hasActiveFilters={hasActiveFilters}
                    clearAllFilters={clearAllFilters}
                    filteredData={dadosCompletosFiltrados}
                    mes={String(mes)}
                    ano={String(ano)}
                    codCliente={codCliente}
                    totalChamadosNaoFinalizados={totalChamadosNaoFinalizados}
                    totalGeralChamadosAPI={apiData?.totalChamados ?? 0}
                    status={status}
                    table={table}
                    columnVisibility={columnVisibility}
                />

                <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
                    <div
                        className="scrollbar-thin scrollbar-track-purple-100 scrollbar-thumb-purple-600 hover:scrollbar-thumb-purple-800 flex-1 overflow-x-auto overflow-y-auto"
                        style={{
                            maxHeight: isDesktop ? MAX_HEIGHT_DESKTOP : MAX_HEIGHT_MOBILE,
                            minHeight: isDesktop ? MIN_HEIGHT_DESKTOP : MIN_HEIGHT_MOBILE,
                        }}
                    >
                        <table
                            className="w-full border-separate border-spacing-0"
                            style={{ tableLayout: 'fixed', minWidth: '1400px' }}
                        >
                            <TableHeader
                                table={table}
                                columnVisibility={columnVisibility}
                                columnWidths={columnWidths}
                                handleMouseDown={handleMouseDown}
                                handleDoubleClick={handleDoubleClick}
                                resizingColumn={resizingColumn}
                                sorting={sorting}
                                onSortColumn={handleSortColumn}
                            />
                            <TableBody
                                table={table}
                                columnVisibility={columnVisibility}
                                columns={columns}
                                clearAllFilters={clearAllFilters}
                                columnWidths={columnWidths}
                            />
                        </table>
                    </div>
                </div>

                {paginacaoServidor && paginacaoServidor.totalPages > 1 && (
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

            <TabelaOS
                isOpen={isModalListaOSOpen}
                codChamado={selectedChamado}
                onClose={handleCloseModalListaOS}
                onSelectOS={handleOSSelect}
                dataChamado={
                    dadosCompletosFiltrados.find((c) => c.COD_CHAMADO === selectedChamado)
                        ?.DATA_CHAMADO
                }
            />
            <ModalValidarOS
                isOpen={isModalOSOpen}
                selectedRow={selectedOS}
                onClose={handleCloseModalOS}
                onSave={handleSaveValidation}
            />
            <ModalAssuntoSolicitacaoChamado
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
            <ModalHistoricoChamado
                isOpen={isModalHistoricoOpen}
                codChamado={selectedChamadoHistorico?.COD_CHAMADO || 0}
                onClose={handleCloseHistorico}
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

const PaginationControls = React.memo(function PaginationControls({
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

    const pageNumbers = useMemo(() => {
        const pages: (number | string)[] = [];
        const maxPagesToShow = 7;

        if (totalPages <= maxPagesToShow) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            if (currentPage <= 4) {
                for (let i = 1; i <= 5; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
            } else if (currentPage >= totalPages - 3) {
                pages.push(1);
                pages.push('...');
                for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
            } else {
                pages.push(1);
                pages.push('...');
                for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
            }
        }

        return pages;
    }, [currentPage, totalPages]);

    return (
        <div className="flex flex-wrap items-center justify-center gap-y-2 border-t border-b border-black bg-gray-200 px-4 py-2 shadow-inner sm:justify-between sm:px-10">
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
                >
                    <MdNavigateBefore size={20} />
                    Anterior
                </button>

                <div className="flex items-center gap-4">
                    {pageNumbers.map((pageNum, idx) => {
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
                                disabled={isCurrentPage}
                                className={`min-w-[40px] rounded-md px-4 py-1 text-base font-semibold tracking-widest shadow-md shadow-black transition-all duration-200 select-none ${
                                    isCurrentPage
                                        ? 'cursor-default border border-purple-900 bg-purple-600 text-white'
                                        : 'cursor-pointer border border-gray-400 bg-gray-200 text-gray-700 hover:scale-105 hover:shadow-xl hover:shadow-black active:scale-95'
                                }`}
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
});

// Rótulos das colunas opcionais, pro menu "Colunas" — mesmo texto usado nos
// cabeçalhos da tabela (ver Colunas_Tabela_Chamados.tsx).
const COLUNA_LABELS: Record<string, string> = {
    DTENVIO_CHAMADO: 'Atribuição',
    DTINI_CHAMADO: 'Início',
    SLA_INFO: 'SLA',
    HISTORICO: 'Histórico',
    DATA_HISTCHAMADO: 'Finalização',
    EMAIL_CHAMADO: 'Email',
    NOME_CLASSIFICACAO: 'Classificação',
    HORAS: 'Horas',
};

function ColumnVisibilityMenu({ table }: { table: any }) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const colunasOpcionais = table
        .getAllLeafColumns()
        .filter((col: any) => !COLUNAS_SEMPRE_VISIVEIS.has(col.id) && COLUNA_LABELS[col.id]);

    return (
        <div ref={menuRef} className="relative">
            <button
                onClick={() => setIsOpen((prev) => !prev)}
                title="Mostrar/ocultar colunas"
                className="group flex flex-shrink-0 cursor-pointer items-center gap-2 rounded-full border border-purple-300 bg-white px-3 py-2 text-sm font-extrabold tracking-widest text-black transition-all hover:scale-105 active:scale-95 lg:px-4 lg:py-3"
            >
                <MdChecklist size={16} className="transition-all group-hover:scale-110" />
                <span className="hidden sm:inline">Colunas</span>
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 z-30 mt-2 w-56 rounded-md border border-gray-300 bg-white p-2 shadow-lg shadow-black/40">
                    {colunasOpcionais.map((col: any) => (
                        <label
                            key={col.id}
                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm font-semibold tracking-wide text-black select-none hover:bg-gray-100"
                        >
                            <input
                                type="checkbox"
                                checked={col.getIsVisible()}
                                onChange={col.getToggleVisibilityHandler()}
                                className="cursor-pointer"
                            />
                            {COLUNA_LABELS[col.id]}
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
}

interface HeaderProps {
    totalChamadosFiltrados: number;
    totalOSFiltrados: number;
    totalHorasFiltradas: number;
    hasActiveFilters: boolean;
    clearAllFilters: () => void;
    filteredData: ChamadoRowProps[];
    mes: string;
    ano: string;
    codCliente: string | null;
    totalChamadosNaoFinalizados: number;
    totalGeralChamadosAPI: number;
    status: string;
    table: any;
    // Não usado diretamente aqui — só existe pra forçar o React.memo a
    // perceber a mudança quando o usuário marca/desmarca uma coluna
    // (o objeto `table` do TanStack mantém a mesma referência entre
    // renders, então sem isso o menu "Colunas" ficava com o checkbox
    // desatualizado até o dropdown ser reaberto).
    columnVisibility: Record<string, boolean>;
}

const Header = React.memo(function Header({
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
    totalGeralChamadosAPI,
    status,
    table,
}: HeaderProps) {
    const { contagemExibida, labelContagem } = useMemo(() => {
        const statusUpper = status?.trim().toUpperCase();
        const filtrandoPorFinalizado = statusUpper === 'FINALIZADO';
        const filtrandoPorTodos = statusUpper === 'TODOS';

        let contagem: number;
        let label: string;

        if (filtrandoPorFinalizado) {
            contagem = totalGeralChamadosAPI;
            label = 'FINALIZADOS';
        } else if (filtrandoPorTodos) {
            contagem = totalGeralChamadosAPI;
            label = 'ATIVOS E FINALIZADOS';
        } else {
            contagem = totalChamadosNaoFinalizados;
            label = 'ATIVOS';
        }

        return { contagemExibida: contagem, labelContagem: label };
    }, [status, totalGeralChamadosAPI, totalChamadosNaoFinalizados]);

    return (
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-tl-4xl rounded-tr-4xl bg-purple-900 p-4 sm:p-6">
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

                <ColumnVisibilityMenu table={table} />

                <ExportarExcelTabelaChamados
                    data={filteredData}
                    codCliente={codCliente}
                    filtros={{ ano, mes, status: '' }}
                    disabled={filteredData.length === 0}
                />

                <ExportarPDFTabelaChamados
                    data={filteredData}
                    codCliente={codCliente}
                    filtros={{ ano, mes, status: '' }}
                    disabled={filteredData.length === 0}
                />
            </div>
        </header>
    );
});

interface TableHeaderProps {
    table: any;
    // Não usado no corpo — só força o React.memo a perceber quando
    // colunas são mostradas/ocultadas (ver nota em HeaderProps).
    columnVisibility: Record<string, boolean>;
    columnWidths: Record<string, number>;
    handleMouseDown: (e: React.MouseEvent, columnId: string) => void;
    handleDoubleClick: (columnId: string) => void;
    resizingColumn: string | null;
    sorting: SortState | null;
    onSortColumn: (columnId: string) => void;
}

const TableHeader = React.memo(function TableHeader({
    table,
    columnWidths,
    handleMouseDown,
    handleDoubleClick,
    resizingColumn,
    sorting,
    onSortColumn,
}: TableHeaderProps) {
    return (
        <thead className="sticky top-0 z-20">
            {table.getHeaderGroups().map((headerGroup: any) => (
                <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header: any, idx: number) => {
                        const isSortable = SORTABLE_COLUMNS.has(header.id);
                        const isSorted = sorting?.id === header.id;

                        return (
                            <th
                                key={header.id}
                                className="relative bg-teal-600 p-4 shadow-md shadow-black"
                                style={{ width: `${columnWidths[header.id]}px` }}
                            >
                                {header.isPlaceholder ? null : isSortable ? (
                                    <button
                                        type="button"
                                        onClick={() => onSortColumn(header.id)}
                                        className="flex w-full cursor-pointer items-center justify-center gap-1"
                                        title="Ordenar"
                                    >
                                        {flexRender(
                                            header.column.columnDef.header,
                                            header.getContext()
                                        )}
                                        {isSorted ? (
                                            sorting?.desc ? (
                                                <MdArrowDownward size={16} className="text-white" />
                                            ) : (
                                                <MdArrowUpward size={16} className="text-white" />
                                            )
                                        ) : (
                                            <MdUnfoldMore size={16} className="text-white/50" />
                                        )}
                                    </button>
                                ) : (
                                    flexRender(header.column.columnDef.header, header.getContext())
                                )}

                                {idx < headerGroup.headers.length - 1 && (
                                    <RedimensionarColunas
                                        columnId={header.id}
                                        onMouseDown={handleMouseDown}
                                        onDoubleClick={handleDoubleClick}
                                        isResizing={resizingColumn === header.id}
                                    />
                                )}
                            </th>
                        );
                    })}
                </tr>
            ))}
        </thead>
    );
});

interface TableBodyProps {
    table: any;
    // Não usado no corpo — só força o React.memo a perceber quando
    // colunas são mostradas/ocultadas (ver nota em HeaderProps).
    columnVisibility: Record<string, boolean>;
    columns: any;
    clearAllFilters: () => void;
    columnWidths: Record<string, number>;
}

const TableBody = React.memo(function TableBody({
    table,
    columns,
    clearAllFilters,
    columnWidths,
}: TableBodyProps) {
    const rows = table.getRowModel().rows;

    if (rows.length === 0) {
        return (
            <tbody>
                <tr>
                    <td colSpan={columns.length} className="py-40 text-center">
                        <EmptyState clearAllFilters={clearAllFilters} />
                    </td>
                </tr>
            </tbody>
        );
    }

    return (
        <tbody className="relative">
            {rows.map((row: any, rowIndex: number) => (
                <tr
                    key={row.id}
                    data-chamado-id={row.original.COD_CHAMADO}
                    className={`transition-all hover:bg-teal-200 ${
                        rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    }`}
                >
                    {row.getVisibleCells().map((cell: any, cellIndex: number) => (
                        <td
                            key={cell.id}
                            style={{ width: `${columnWidths[cell.column.id]}px` }}
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

const EmptyState = React.memo(function EmptyState({
    clearAllFilters,
}: {
    clearAllFilters: () => void;
}) {
    return (
        <div className="flex flex-col items-center justify-center">
            <TbMoodEmptyFilled className="mb-6 text-gray-600" size={120} />
            <div className="mb-2 text-center text-4xl font-extrabold tracking-widest text-gray-500 select-none">
                Nenhum resultado encontrado
            </div>
            <div className="mb-20 text-center font-semibold tracking-widest text-gray-400 italic select-none">
                Tente ajustar os filtros para encontrar o que procura
            </div>
            <button
                className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-gradient-to-br from-blue-600 to-blue-700 px-6 py-3 text-lg font-extrabold tracking-widest text-white shadow-md shadow-black transition-all hover:-translate-y-1 active:scale-95"
                onClick={clearAllFilters}
            >
                <BsEraserFill className="text-white" size={24} />
                Limpar Filtros
            </button>
        </div>
    );
});
