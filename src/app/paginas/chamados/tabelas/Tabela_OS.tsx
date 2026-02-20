// src/app/paginas/chamados/tabelas/Tabela_OS.tsx

'use client';

import { RedimensionarColunas } from '@/app/paginas/chamados/componentes/Redimensionar_Colunas';
import { ModalObservacaoOS } from '@/app/paginas/chamados/modais/Modal_Observacao_OS';
import { IsError } from '@/components/IsError';
import { IsLoading } from '@/components/IsLoading';
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
    dataChamado?: string | Date | null | undefined; // ✅ NOVO: Receber data do chamado (aceita qualquer formato)
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

    console.log('🔍 Fetchando OS:', {
        codChamado,
        isAdmin,
        codCliente,
        mes,
        ano,
        url: `/api/chamados/${codChamado}/os?${params.toString()}`,
    });

    const response = await fetch(`/api/chamados/${codChamado}/os?${params.toString()}`, {
        headers: createAuthHeaders(),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Erro na resposta da API:', errorData);
        throw new Error(errorData.error || 'Erro ao carregar OS');
    }

    const data = await response.json();
    console.log('✅ OS carregadas:', data);
    return data;
};

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================
export function TabelaOS({ isOpen, codChamado, onClose, onSelectOS, dataChamado }: ModalOSProps) {
    const { isAdmin, codCliente } = useAuth();
    const mesFiltro = useFiltersStore((state) => state.filters.mes);
    const anoFiltro = useFiltersStore((state) => state.filters.ano);

    // ✅ MODIFICAÇÃO PRINCIPAL: Usar data do chamado para extrair mes/ano
    // Se não tiver dataChamado, usa os filtros ou data atual
    const { mes: mesExtraido, ano: anoExtraido } = useMemo(() => {
        if (dataChamado) {
            console.log('📅 Usando data do chamado:', dataChamado);
            return extrairMesAnoDeData(dataChamado);
        }

        console.log('📅 Usando filtros:', { mes: mesFiltro, ano: anoFiltro });
        return {
            mes: mesFiltro ?? new Date().getMonth() + 1,
            ano: anoFiltro ?? new Date().getFullYear(),
        };
    }, [dataChamado, mesFiltro, anoFiltro]);

    // Estados
    const [isModalObsOpen, setIsModalObsOpen] = useState(false);
    const [selectedOSForObs, setSelectedOSForObs] = useState<OSRowProps | null>(null);

    // Hook de redimensionamento
    const { columnWidths, handleMouseDown, handleDoubleClick, resizingColumn } =
        useRedimensionarColunas(INITIAL_COLUMN_WIDTHS);

    // ✅ DEBUG: Log dos parâmetros quando o modal abre
    React.useEffect(() => {
        if (isOpen && codChamado) {
            console.log('🔍 TabelaOS aberta com parâmetros:', {
                isOpen,
                codChamado,
                dataChamado,
                isAdmin,
                codCliente,
                mes: mesExtraido,
                ano: anoExtraido,
            });
        }
    }, [isOpen, codChamado, dataChamado, isAdmin, codCliente, mesExtraido, anoExtraido]);

    // =====================================================
    // REACT QUERY
    // =====================================================
    const { data, isLoading, error } = useQuery({
        queryKey: ['modal-os-lista', codChamado, isAdmin, codCliente, mesExtraido, anoExtraido],
        queryFn: () =>
            fetchOSByChamado({
                codChamado: codChamado!,
                isAdmin,
                codCliente,
                mes: mesExtraido,
                ano: anoExtraido,
            }),
        enabled: isOpen && codChamado !== null,
        staleTime: 5 * 60 * 1000,
        retry: 2,
    });

    // ✅ DEBUG: Log do estado da query
    React.useEffect(() => {
        if (isOpen && codChamado) {
            console.log('📊 Estado da Query:', {
                isLoading,
                error: error?.message,
                hasData: !!data,
                dataLength: data?.data?.length,
            });
        }
    }, [isOpen, codChamado, isLoading, error, data]);

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
                <div className="animate-in slide-in-from-bottom-4 relative z-10 flex w-[800px] flex-col overflow-hidden rounded-xl bg-white p-8 shadow-md shadow-black">
                    <IsError
                        isError={!!error}
                        error={error as Error}
                        title="Erro ao Carregar OS's"
                    />
                    <button
                        onClick={onClose}
                        className="mt-4 cursor-pointer rounded-md bg-gradient-to-br from-red-600 to-red-700 px-6 py-2 text-white shadow-md shadow-black transition-all hover:scale-105 active:scale-95"
                    >
                        Fechar
                    </button>
                </div>
            </ModalOverlay>
        );
    }

    // ✅ DEBUG: Verificar se não há dados
    if (osData.length === 0) {
        console.warn('⚠️ Nenhuma OS encontrada para o chamado', codChamado);
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
                        onClose={onClose}
                    />

                    <ModalContent>
                        {osData.length > 0 ? (
                            <TableContainer>
                                <OSTable
                                    table={table}
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
