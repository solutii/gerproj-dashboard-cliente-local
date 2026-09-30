// src/app/paginas/chamados/tabelas/Tabela_OS.tsx

'use client';

import { RedimensionarColunas } from '@/app/paginas/chamados/componentes/Redimensionar_Colunas';
import { ModalObservacaoOS } from '@/app/paginas/chamados/modais/Modal_Observacao_OS';
import { IsError } from '@/components/IsError';
import { IsLoading } from '@/components/IsLoading';
import { formatarDataParaBR } from '@/formatters/formatar-data';
import { formatarHorasRelogio } from '@/formatters/formatar-hora';
import { formatarNumeros } from '@/formatters/formatar-numeros';
import { useRedimensionarColunas } from '@/hooks/useRedimensionarColunas';
import { HorasAdicionaisResult } from '@/lib/os/calcular-horas-adicionais';
import { useFiltersStore } from '@/store/useFiltersStore';
import { useQuery } from '@tanstack/react-query';
import {
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    SortingState,
    useReactTable,
} from '@tanstack/react-table';
// =====================================================
import { useAuthStore } from '@/store/useAuthStore';
import React, { useCallback, useMemo, useState } from 'react';
import { IoClose } from 'react-icons/io5';
import { MdArrowDownward, MdArrowUpward, MdUnfoldMore } from 'react-icons/md';
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
    NUM_OS: 130,
    DTINI_OS: 130,
    HRINI_OS: 120,
    HRFIM_OS: 120,
    HORAS_ADICIONAL: 250,
    OBS: 150,
    NOME_RECURSO: 250,
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
        horas_adicional: HorasAdicionaisResult;
    };
    data: OSRowProps[];
}

interface ModalOSProps {
    isOpen: boolean;
    codChamado: number | null;
    onClose: () => void;
    onSelectOS: (os: OSRowProps) => void;
    dataChamado?: string | Date | null | undefined; // ✅ NOVO: Receber data do chamado (aceita qualquer formato)
}

interface FetchOSParams {
    codChamado: number;
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
    'x-user-email': localStorage.getItem('userEmail') || '',
});

// ✅ NOVA FUNÇÃO: Extrair mês e ano da data do chamado
const extrairMesAnoDeData = (
    data: string | Date | null | undefined
): { mes: number; ano: number } => {
    if (!data) {
        const hoje = new Date();
        return {
            mes: hoje.getMonth() + 1,
            ano: hoje.getFullYear(),
        };
    }

    let dataObj: Date;

    if (typeof data === 'string') {
        // Se for string no formato dd/mm/yyyy
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(data)) {
            const [dia, mes, ano] = data.split('/').map(Number);
            dataObj = new Date(ano, mes - 1, dia);
        } else {
            dataObj = new Date(data);
        }
    } else {
        dataObj = data;
    }

    if (isNaN(dataObj.getTime())) {
        const hoje = new Date();
        return {
            mes: hoje.getMonth() + 1,
            ano: hoje.getFullYear(),
        };
    }

    return {
        mes: dataObj.getMonth() + 1,
        ano: dataObj.getFullYear(),
    };
};

const fetchOSByChamado = async ({
    codChamado,
    codCliente,
    mes,
    ano,
}: FetchOSParams): Promise<ApiResponseOS> => {
    const params = new URLSearchParams({
        mes: String(mes),
        ano: String(ano),
    });

    if (codCliente) {
        params.append('codCliente', codCliente);
    }

    const response = await fetch(`/api/chamados/${codChamado}/os?${params.toString()}`, {
        headers: createAuthHeaders(),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ao carregar OS (HTTP ${response.status})`);
    }

    return response.json();
};

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================
export function TabelaOS({ isOpen, codChamado, onClose, onSelectOS, dataChamado }: ModalOSProps) {
    const { codCliente } = useAuthStore();
    const mesFiltro = useFiltersStore((state) => state.filters.mes);
    const anoFiltro = useFiltersStore((state) => state.filters.ano);

    // ✅ MODIFICAÇÃO PRINCIPAL: Usar data do chamado para extrair mes/ano
    // Se não tiver dataChamado, usa os filtros ou data atual
    const { mes: mesExtraido, ano: anoExtraido } = useMemo(() => {
        if (dataChamado) {
            return extrairMesAnoDeData(dataChamado);
        }

        return {
            mes: mesFiltro ?? new Date().getMonth() + 1,
            ano: anoFiltro ?? new Date().getFullYear(),
        };
    }, [dataChamado, mesFiltro, anoFiltro]);

    // Estados
    const [isModalObsOpen, setIsModalObsOpen] = useState(false);
    const [selectedOSForObs, setSelectedOSForObs] = useState<OSRowProps | null>(null);
    const [sorting, setSorting] = useState<SortingState>([]);

    // Hook de redimensionamento
    const { columnWidths, handleMouseDown, handleDoubleClick, resizingColumn } =
        useRedimensionarColunas(INITIAL_COLUMN_WIDTHS);

    // =====================================================
    // REACT QUERY
    // =====================================================
    const { data, isLoading, error } = useQuery({
        queryKey: ['modal-os-lista', codChamado, codCliente, mesExtraido, anoExtraido],
        queryFn: () =>
            fetchOSByChamado({
                codChamado: codChamado!,
                codCliente,
                mes: mesExtraido,
                ano: anoExtraido,
            }),
        enabled: isOpen && codChamado !== null && !!codCliente,
        staleTime: 5 * 60 * 1000,
        retry: 2,
    });

    // =====================================================
    // MEMOIZAÇÕES
    // =====================================================
    const osData = useMemo(() => data?.data ?? [], [data?.data]);

    const columns = useMemo(() => getColunasOS(), []);

    const dataChamadoFormatada = useMemo(() => {
        if (data?.dataChamado) {
            return formatarDataParaBR(data.dataChamado);
        }
        if (dataChamado) {
            if (typeof dataChamado === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(dataChamado)) {
                return dataChamado;
            }
            const dataChamadoString =
                typeof dataChamado === 'string' ? dataChamado : dataChamado.toISOString();
            return formatarDataParaBR(dataChamadoString);
        }
        return `${mesExtraido}/${anoExtraido}`;
    }, [data?.dataChamado, dataChamado, mesExtraido, anoExtraido]);

    const observacaoModalData = useMemo(
        () => ({
            observacao: selectedOSForObs?.OBS ?? '',
            numOS: selectedOSForObs?.NUM_OS ?? 0,
            dataOS: selectedOSForObs?.DTINI_OS
                ? formatarDataParaBR(selectedOSForObs.DTINI_OS)
                : undefined,
            consultor: selectedOSForObs?.NOME_RECURSO ?? undefined,
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
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
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
        return <IsLoading isLoading={isLoading} title="Carregando OS's do chamado..." />;
    }

    if (error) {
        return (
            <div className="animate-in slide-in-from-bottom-4 relative z-10 flex w-[95vw] flex-col overflow-hidden rounded-xl bg-white p-8 shadow-md shadow-black sm:w-[800px]">
                <IsError isError={!!error} error={error as Error} title="Erro ao Carregar OS's" />
                <button
                    onClick={onClose}
                    className="mt-4 cursor-pointer rounded-md bg-gradient-to-br from-red-600 to-red-700 px-6 py-2 text-white shadow-md shadow-black transition-all hover:scale-105 active:scale-95"
                >
                    Fechar
                </button>
            </div>
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
                        dataChamado={dataChamadoFormatada}
                        totais={data?.totais}
                        onClose={onClose}
                    />

                    <ModalContent>
                        {osData.length > 0 ? (
                            <TableContainer>
                                <OSTable
                                    table={table}
                                    sorting={sorting}
                                    columnWidths={columnWidths}
                                    handleMouseDown={handleMouseDown}
                                    handleDoubleClick={handleDoubleClick}
                                    resizingColumn={resizingColumn}
                                />
                            </TableContainer>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20">
                                <p className="text-2xl font-bold text-gray-600">
                                    Nenhuma OS encontrada para este chamado
                                </p>
                                <p className="mt-2 text-gray-500">
                                    Período: {mesExtraido}/{anoExtraido}
                                </p>
                            </div>
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
        <div className="animate-in fade-in fixed inset-0 z-[110] flex items-center justify-center transition-all duration-200 ease-out">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            {children}
        </div>
    );
});

interface ModalContainerProps {
    children: React.ReactNode;
}

const ModalContainer = React.memo(function ModalContainer({ children }: ModalContainerProps) {
    return (
        <div className="animate-in slide-in-from-bottom-4 relative z-10 flex h-auto max-h-[100vh] w-[95vw] flex-col overflow-hidden rounded-xl bg-white shadow-md shadow-black transition-all duration-200 ease-out lg:w-[2400px]">
            {children}
        </div>
    );
});

interface ModalHeaderProps {
    codChamado: number;
    dataChamado: string;
    totais?: ApiResponseOS['totais'];
    onClose: () => void;
}

const ModalHeader = React.memo(function ModalHeader({
    codChamado,
    dataChamado,
    totais,
    onClose,
}: ModalHeaderProps) {
    return (
        <header className="relative flex flex-shrink-0 flex-col gap-4 bg-teal-700 p-4 shadow-md shadow-black">
            <div className="flex items-center justify-between">
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
            </div>

            {totais && totais.quantidade_OS > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                    <TotalPill
                        color="black"
                        label="Qtd. OS's ="
                        value={formatarNumeros(totais.quantidade_OS)}
                    />
                    {totais.horas_adicional.horasSemAdicional > 0 && (
                        <TotalPill
                            color="green"
                            label="Total Horas Comerciais ="
                            value={formatarHorasRelogio(totais.horas_adicional.horasSemAdicional)}
                        />
                    )}
                    {totais.horas_adicional.horasComAdicional > 0 && (
                        <TotalPill
                            color="orange"
                            label="Total Horas Não Comerciais ="
                            value={formatarHorasRelogio(totais.horas_adicional.horasComAdicional)}
                        />
                    )}
                    {totais.horas_adicional.horasAdicionalGerado > 0 && (
                        <TotalPill
                            color="yellow"
                            label="Total Horas Adicionais ="
                            value={formatarHorasRelogio(
                                totais.horas_adicional.horasAdicionalGerado
                            )}
                        />
                    )}
                    <TotalPill
                        color="purple"
                        label="Total de Horas ="
                        value={formatarHorasRelogio(totais.horas_adicional.totalHorasEquivalente)}
                    />
                </div>
            )}
        </header>
    );
});

// Cada cor tem sua própria dupla de sombra — colada (define a borda inferior,
// dá "peso") + espalhada (na cor do próprio tom, não cinza genérico) — e um
// brilho interno no topo (inset), simulando luz batendo numa superfície
// curva. É isso que lê como "profundidade" em vez de uma cor chapada.
// Quatro camadas por cor: brilho no topo (inset claro) + friso escuro embaixo
// por dentro (inset escuro, a "sombra própria" da curva) + sombra colada
// (define a borda) + sombra espalhada, mais larga e mais escura que antes —
// e o degradê de fundo com mais contraste entre topo e base.
const TOTAL_PILL_COLORS = {
    black: 'border-gray-700 bg-gradient-to-b from-gray-600 to-black text-white shadow-[inset_0_1.5px_0_rgba(255,255,255,0.3),inset_0_-2px_2px_rgba(0,0,0,0.5),0_1px_1px_rgba(0,0,0,0.6),0_8px_20px_-4px_rgba(0,0,0,0.75)]',
    green: 'border-green-400 bg-gradient-to-b from-green-50 to-green-300 text-green-900 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_-2px_2px_rgba(21,128,61,0.25),0_1px_1px_rgba(21,128,61,0.25),0_8px_20px_-5px_rgba(21,128,61,0.55)]',
    orange: 'border-orange-400 bg-gradient-to-b from-orange-50 to-orange-300 text-orange-900 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_-2px_2px_rgba(194,65,12,0.25),0_1px_1px_rgba(194,65,12,0.25),0_8px_20px_-5px_rgba(194,65,12,0.55)]',
    yellow: 'border-yellow-400 bg-gradient-to-b from-yellow-50 to-yellow-300 text-yellow-900 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_-2px_2px_rgba(161,98,7,0.25),0_1px_1px_rgba(161,98,7,0.25),0_8px_20px_-5px_rgba(161,98,7,0.55)]',
    purple: 'border-purple-400 bg-gradient-to-b from-purple-50 to-purple-300 text-purple-900 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_-2px_2px_rgba(126,34,206,0.25),0_1px_1px_rgba(126,34,206,0.25),0_8px_20px_-5px_rgba(126,34,206,0.55)]',
} as const;

interface TotalPillProps {
    label: string;
    value: string;
    color: keyof typeof TOTAL_PILL_COLORS;
}

const TotalPill = React.memo(function TotalPill({ label, value, color }: TotalPillProps) {
    return (
        <div
            className={`flex items-center gap-2 rounded-full border px-4 py-1.5 select-none ${TOTAL_PILL_COLORS[color]}`}
        >
            <span className="text-xs font-bold tracking-wide uppercase">{label}</span>
            <span className="text-sm font-extrabold tracking-wide">{value}</span>
        </div>
    );
});

interface ModalContentProps {
    children: React.ReactNode;
}

const ModalContent = React.memo(function ModalContent({ children }: ModalContentProps) {
    return <div className="flex flex-1 flex-col overflow-y-auto px-6 py-10">{children}</div>;
});

interface TableContainerProps {
    children: React.ReactNode;
}

const TableContainer = React.memo(function TableContainer({ children }: TableContainerProps) {
    return (
        <div className="relative z-10 flex flex-1 flex-col overflow-hidden shadow-md shadow-black">
            <div className="scrollbar-thin scrollbar-track-purple-100 scrollbar-thumb-purple-600 hover:scrollbar-thumb-purple-800 flex-1 overflow-x-auto overflow-y-auto">
                {children}
            </div>
        </div>
    );
});

interface OSTableProps {
    table: any;
    // Não usado diretamente aqui — só existe pra forçar o React.memo a
    // perceber a mudança quando o usuário clica pra ordenar. A instância do
    // `table` do TanStack mantém a mesma referência entre renders (é criada
    // uma vez via useState interno), então sem essa prop os componentes
    // memoizados abaixo nunca percebiam que a ordenação mudou e ficavam
    // exibindo a linha na ordem antiga.
    sorting: SortingState;
    columnWidths: Record<string, number>;
    handleMouseDown: (e: React.MouseEvent, columnId: string) => void;
    handleDoubleClick: (columnId: string) => void;
    resizingColumn: string | null;
}

const OSTable = React.memo(function OSTable({
    table,
    sorting,
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
                sorting={sorting}
                columnWidths={columnWidths}
                handleMouseDown={handleMouseDown}
                handleDoubleClick={handleDoubleClick}
                resizingColumn={resizingColumn}
            />
            <OSTableBody table={table} sorting={sorting} columnWidths={columnWidths} />
        </table>
    );
});

interface OSTableHeaderProps {
    table: any;
    sorting: SortingState;
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
                    {headerGroup.headers.map((header: any, idx: number) => {
                        const canSort = header.column.getCanSort();
                        const sortDirection = header.column.getIsSorted();

                        return (
                            <th
                                key={header.id}
                                className={`relative bg-purple-600 p-4 ${
                                    // Sulco (sombra interna) nas divisões
                                    // verticais entre um cabeçalho e o outro.
                                    idx > 0 && idx < headerGroup.headers.length - 1
                                        ? 'shadow-[inset_4px_0_4px_-4px_rgba(0,0,0,0.45),inset_-4px_0_4px_-4px_rgba(0,0,0,0.45)]'
                                        : idx > 0
                                          ? 'shadow-[inset_4px_0_4px_-4px_rgba(0,0,0,0.45)]'
                                          : 'shadow-[inset_-4px_0_4px_-4px_rgba(0,0,0,0.45)]'
                                }`}
                                style={{
                                    width: `${columnWidths[header.id]}px`,
                                }}
                            >
                                {canSort ? (
                                    <button
                                        type="button"
                                        onClick={header.column.getToggleSortingHandler()}
                                        className="flex w-full cursor-pointer items-center justify-center gap-1"
                                        title="Ordenar"
                                    >
                                        {flexRender(
                                            header.column.columnDef.header,
                                            header.getContext()
                                        )}
                                        {sortDirection === 'asc' ? (
                                            <MdArrowUpward
                                                size={24}
                                                className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
                                            />
                                        ) : sortDirection === 'desc' ? (
                                            <MdArrowDownward
                                                size={24}
                                                className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
                                            />
                                        ) : (
                                            <MdUnfoldMore
                                                size={24}
                                                className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
                                            />
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

interface OSTableBodyProps {
    table: any;
    // Não usado no corpo — só força o React.memo a perceber a mudança de
    // ordenação (ver comentário em OSTableProps).
    sorting: SortingState;
    columnWidths: Record<string, number>;
}

const OSTableBody = React.memo(function OSTableBody({ table, columnWidths }: OSTableBodyProps) {
    const rows = table.getRowModel().rows;

    return (
        <tbody>
            {rows.map((row: any) => (
                <tr key={row.id} className="bg-white transition-all hover:bg-black/10">
                    {row.getVisibleCells().map((cell: any, cellIndex: number) => (
                        <td
                            key={cell.id}
                            style={{
                                width: `${columnWidths[cell.column.id]}px`,
                            }}
                            className={`px-2 py-3 shadow-[inset_0_-4px_4px_-4px_rgba(0,0,0,0.4)] transition-all ${
                                cellIndex === 0 ? 'pl-4' : ''
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
