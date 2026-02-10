// src/app/paginas/chamados/tabelas/Colunas_Tabela_Chamados.tsx

import { SLACell } from '@/app/paginas/chamados/componentes/SLA_Cell';
import { formatarDataHoraChamado } from '@/formatters/formatar-data';
import { formatarHorasTotaisSufixo } from '@/formatters/formatar-hora';
import { formatarNumeros, formatarPrioridade } from '@/formatters/formatar-numeros';
import { corrigirTextoCorrompido } from '@/formatters/formatar-texto-corrompido';
import { ColumnDef } from '@tanstack/react-table';
// =====================================================
import React from 'react';
import { BiSolidLike } from 'react-icons/bi';
import { MdOpenInNew, MdOutlineStar } from 'react-icons/md';

// ==================== TIPOS ====================
export type ChamadoRowProps = {
    COD_CHAMADO: number;
    DATA_CHAMADO: string;
    HORA_CHAMADO: string;
    SOLICITACAO_CHAMADO?: string | null;
    CONCLUSAO_CHAMADO: string | null;
    STATUS_CHAMADO: string;
    DTENVIO_CHAMADO: string | null;
    DTINI_CHAMADO: string | null;
    ASSUNTO_CHAMADO: string | null;
    EMAIL_CHAMADO: string | null;
    PRIOR_CHAMADO: number;
    AVALIA_CHAMADO: number | null;
    OBSAVAL_CHAMADO: string | null;
    NOME_RECURSO: string | null;
    NOME_CLASSIFICACAO: string | null;
    TOTAL_HORAS_OS: number;
    TEM_OS?: boolean;
    DATA_HISTCHAMADO?: string | null;
    HORA_HISTCHAMADO?: string | null;
    COD_RECURSO?: number | null;

    SLA_STATUS?: string;
    SLA_PERCENTUAL?: number;
    SLA_TEMPO_DECORRIDO?: number;
    SLA_TEMPO_RESTANTE?: number;
    SLA_PRAZO_TOTAL?: number;
    SLA_DENTRO_PRAZO?: boolean;
};

// ==================== CONSTANTES ====================
const STATUS_STYLES: Record<string, string> = {
    'NAO FINALIZADO': 'bg-red-500 border border-red-600 text-black shadow-sm shadow-black',
    'EM ATENDIMENTO': 'bg-blue-500 border border-blue-600 text-white shadow-sm shadow-black',
    FINALIZADO: 'bg-green-500 border border-green-600 text-black shadow-sm shadow-black',
    'NAO INICIADO': 'bg-red-500 border border-red-600 text-black shadow-sm shadow-black',
    STANDBY: 'bg-orange-500 border border-orange-600 text-white shadow-sm shadow-black',
    ATRIBUIDO: 'bg-cyan-500 border border-cyan-600 text-black shadow-sm shadow-black',
    'AGUARDANDO VALIDACAO':
        'bg-yellow-500 border border-yellow-600 text-black shadow-sm shadow-black',
    DEFAULT: 'bg-gray-500 border border-gray-600 text-black shadow-sm shadow-black',
};

const EMPTY_VALUE = '---------------';

// ==================== FUNÇÕES UTILITÁRIAS ====================
const getStylesStatus = (status: string | undefined): string => {
    return STATUS_STYLES[status?.toUpperCase() || 'DEFAULT'] || STATUS_STYLES.DEFAULT;
};

const setupTruncationTooltip = (el: HTMLDivElement | null, text: string) => {
    if (!el) return;

    const isTruncated = el.scrollWidth > el.clientWidth;
    if (isTruncated) {
        el.setAttribute('title', text);
        el.classList.add('cursor-help');
    } else {
        el.removeAttribute('title');
        el.classList.remove('cursor-help');
    }
};

const formatNomeRecurso = (value: string): string => {
    const correctedText = corrigirTextoCorrompido(value);
    const parts = correctedText.trim().split(/\s+/).filter(Boolean);
    return parts.length <= 2 ? parts.join(' ') : parts.slice(0, 2).join(' ');
};

// ==================== COMPONENTES AUXILIARES ====================
interface StatusBadgeProps {
    status: string;
    avaliacao: number | null;
    obsAvaliacao?: string | null;
    onAvaliar?: () => void;
}

const StatusBadge = React.memo(function StatusBadge({
    status,
    avaliacao,
    onAvaliar,
}: StatusBadgeProps) {
    const styles = getStylesStatus(status);
    const isFinalizado = status.toUpperCase() === 'FINALIZADO';
    const avaliacaoValor = avaliacao ?? 1;
    const foiAvaliado = avaliacaoValor >= 2 && avaliacaoValor <= 5;

    return (
        <div className="flex w-full items-center gap-2">
            <div
                className={`flex items-center justify-center gap-2 rounded px-4 py-1.5 text-sm font-extrabold tracking-widest select-none ${styles} ${isFinalizado ? 'flex-1' : 'w-full'}`}
            >
                <span className="flex-1">{status}</span>

                {isFinalizado && foiAvaliado && (
                    <div className="flex items-center gap-5">
                        <div
                            className="flex gap-0.5"
                            title={`Avaliação: ${avaliacaoValor} estrelas`}
                        >
                            {Array.from({ length: 5 }).map((_, i) => (
                                <MdOutlineStar
                                    key={i}
                                    size={14}
                                    className={
                                        i < avaliacaoValor
                                            ? 'fill-yellow-300 text-yellow-300'
                                            : 'fill-white/50 text-white/50'
                                    }
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {isFinalizado && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onAvaliar?.();
                    }}
                    title={foiAvaliado ? 'Reavaliar chamado' : 'Avaliar chamado'}
                >
                    <BiSolidLike
                        className="cursor-pointer text-purple-600 transition-all duration-200 hover:scale-140 active:scale-95"
                        size={32}
                    />
                </button>
            )}
        </div>
    );
});

interface ActionButtonProps {
    onClick: (e: React.MouseEvent) => void;
    title: string;
}

const ActionButton = React.memo(function ActionButton({ onClick, title }: ActionButtonProps) {
    return (
        <button onClick={onClick} title={title}>
            <MdOpenInNew
                className="cursor-pointer text-purple-600 transition-all duration-200 hover:scale-140 hover:-rotate-45 active:scale-95"
                size={32}
            />
        </button>
    );
});

interface CellHeaderProps {
    children: React.ReactNode;
}

const CellHeader = React.memo(function CellHeader({ children }: CellHeaderProps) {
    return (
        <div className="text-center text-sm font-bold tracking-widest text-white select-none">
            {children}
        </div>
    );
});

interface CellTextProps {
    value: string;
    centered?: boolean;
    className?: string;
}

const CellText = React.memo(function CellText({
    value,
    centered = true,
    className = '',
}: CellTextProps) {
    return (
        <div
            className={`text-sm font-semibold tracking-widest text-black select-none ${
                centered ? 'text-center' : ''
            } ${className}`}
        >
            {value}
        </div>
    );
});

interface TruncatedCellProps {
    value: string;
    centered?: boolean;
    className?: string;
}

const TruncatedCell = React.memo(function TruncatedCell({
    value,
    centered = false,
    className = '',
}: TruncatedCellProps) {
    return (
        <div
            ref={(el) => setupTruncationTooltip(el, value)}
            className={`flex-1 truncate overflow-hidden text-sm font-semibold tracking-widest whitespace-nowrap text-black select-none ${
                centered ? 'text-center' : ''
            } ${className}`}
        >
            {value}
        </div>
    );
});

// ==================== DEFINIÇÃO DAS COLUNAS ====================
export const getColunasChamados = (
    isAdmin: boolean,
    expandedRows: Set<number>,
    columnWidths?: Record<string, number>,
    onOpenSolicitacao?: (chamado: ChamadoRowProps) => void,
    onOpenAvaliacao?: (chamado: ChamadoRowProps) => void
): ColumnDef<ChamadoRowProps>[] => {
    return [
        // ==================== CÓDIGO DO CHAMADO ====================
        {
            accessorKey: 'COD_CHAMADO',
            id: 'COD_CHAMADO',
            header: () => <CellHeader>CHAMADO</CellHeader>,
            cell: ({ getValue, row, table }) => {
                const temOS = row.original.TEM_OS ?? false;
                const value = getValue() as number;
                const handleChamadoClick = table.options.meta?.handleChamadoClick;

                if (!temOS) {
                    return <CellText value={formatarNumeros(value)} />;
                }

                return (
                    <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center">
                            <ActionButton
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleChamadoClick?.(row.original.COD_CHAMADO, temOS);
                                }}
                                title="Visualizar OS's do chamado"
                            />
                        </div>
                        <CellText value={formatarNumeros(value)} />
                    </div>
                );
            },
            enableColumnFilter: true,
        },

        // ==================== DATA/HORA DO CHAMADO ====================
        {
            id: 'DATA_CHAMADO',
            header: () => <CellHeader>ENTRADA</CellHeader>,
            cell: ({ row }) => {
                const { DATA_CHAMADO, HORA_CHAMADO } = row.original;
                const value =
                    DATA_CHAMADO && HORA_CHAMADO
                        ? formatarDataHoraChamado(DATA_CHAMADO, HORA_CHAMADO)
                        : EMPTY_VALUE;
                return <CellText value={value} />;
            },
            enableColumnFilter: true,
        },

        // ==================== PRIORIDADE ====================
        {
            accessorKey: 'PRIOR_CHAMADO',
            id: 'PRIOR_CHAMADO',
            header: () => <CellHeader>PRIOR.</CellHeader>,
            cell: ({ getValue }) => {
                const value = getValue() as number;
                return <CellText value={formatarPrioridade(value)} />;
            },
            enableColumnFilter: true,
        },

        // ==================== ASSUNTO ====================
        {
            accessorKey: 'ASSUNTO_CHAMADO',
            id: 'ASSUNTO_CHAMADO',
            header: () => <CellHeader>ASSUNTO</CellHeader>,
            cell: ({ getValue, row }) => {
                const value = getValue() as string | null;
                const correctedText = corrigirTextoCorrompido(value);

                return (
                    <div className="flex w-full items-center gap-4">
                        {onOpenSolicitacao && (
                            <ActionButton
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenSolicitacao(row.original);
                                }}
                                title="Visualizar assunto e solicitação do chamado"
                            />
                        )}
                        <TruncatedCell value={correctedText} />
                    </div>
                );
            },
            enableColumnFilter: true,
        },

        // ==================== EMAIL ====================
        {
            accessorKey: 'EMAIL_CHAMADO',
            id: 'EMAIL_CHAMADO',
            header: () => <CellHeader>EMAIL</CellHeader>,
            cell: ({ getValue }) => {
                const value = (getValue() as string) ?? EMPTY_VALUE;

                if (value === EMPTY_VALUE) {
                    return <CellText value={value} />;
                }

                return <TruncatedCell value={value} />;
            },
            enableColumnFilter: true,
        },

        // ==================== CLASSIFICAÇÃO ====================
        {
            accessorKey: 'NOME_CLASSIFICACAO',
            id: 'NOME_CLASSIFICACAO',
            header: () => <CellHeader>CLASSIFICAÇÃO</CellHeader>,
            cell: ({ getValue }) => {
                const value = getValue() as string | null;
                const correctedText = corrigirTextoCorrompido(value);
                return <TruncatedCell value={correctedText} centered />;
            },
            enableColumnFilter: true,
        },

        // ==================== DATA DE ATRIBUIÇÃO ====================
        {
            accessorKey: 'DTENVIO_CHAMADO',
            id: 'DTENVIO_CHAMADO',
            header: () => <CellHeader>ATRIBUIÇÃO</CellHeader>,
            cell: ({ getValue }) => {
                const value = (getValue() as string) ?? EMPTY_VALUE;
                return <CellText value={value} />;
            },
            enableColumnFilter: true,
        },

        // ==================== CONSULTOR ====================
        {
            accessorKey: 'NOME_RECURSO',
            id: 'NOME_RECURSO',
            header: () => <CellHeader>CONSULTOR</CellHeader>,
            cell: ({ getValue }) => {
                const value = (getValue() as string) ?? EMPTY_VALUE;

                if (value === EMPTY_VALUE) {
                    return <CellText value={value} />;
                }

                const displayName = formatNomeRecurso(value);
                return <TruncatedCell value={displayName} centered />;
            },
            enableColumnFilter: true,
        },

        // ==================== STATUS ====================
        {
            accessorKey: 'STATUS_CHAMADO',
            id: 'STATUS_CHAMADO',
            header: () => <CellHeader>STATUS</CellHeader>,
            cell: ({ getValue, row }) => {
                const value = getValue() as string;
                const avaliacao = row.original.AVALIA_CHAMADO;

                return (
                    <StatusBadge
                        status={value}
                        avaliacao={avaliacao}
                        onAvaliar={() => onOpenAvaliacao?.(row.original)}
                    />
                );
            },
            enableColumnFilter: true,
            filterFn: (row, _columnId, filterValue) => {
                if (!filterValue) return true;

                const value = row.getValue('STATUS_CHAMADO') as string | null | undefined;
                const cellValueUpper = (value ?? '').toString().toUpperCase().trim();
                const filterValueUpper = filterValue.toString().toUpperCase().trim();

                return cellValueUpper === filterValueUpper;
            },
        },

        // ==================== SLA ====================
        {
            id: 'SLA_INFO',
            header: () => <CellHeader>SLA</CellHeader>,
            cell: ({ row }) => {
                const {
                    DATA_CHAMADO,
                    HORA_CHAMADO,
                    PRIOR_CHAMADO,
                    STATUS_CHAMADO,
                    DTINI_CHAMADO, // ✅ ADICIONAR
                } = row.original;

                return (
                    <SLACell
                        dataChamado={DATA_CHAMADO}
                        horaChamado={HORA_CHAMADO}
                        prioridade={PRIOR_CHAMADO}
                        statusChamado={STATUS_CHAMADO}
                        dataInicioAtendimento={DTINI_CHAMADO}
                    />
                );
            },
            enableColumnFilter: false,
        },

        // ==================== DATA DE FINALIZAÇÃO ====================
        {
            id: 'DATA_HISTCHAMADO',
            header: () => <CellHeader>FINALIZAÇÃO</CellHeader>,
            cell: ({ row }) => {
                const { DATA_HISTCHAMADO, HORA_HISTCHAMADO, STATUS_CHAMADO } = row.original;

                if (
                    STATUS_CHAMADO?.toUpperCase() !== 'FINALIZADO' ||
                    !DATA_HISTCHAMADO ||
                    !HORA_HISTCHAMADO
                ) {
                    return <CellText value={EMPTY_VALUE} />;
                }

                return (
                    <CellText value={formatarDataHoraChamado(DATA_HISTCHAMADO, HORA_HISTCHAMADO)} />
                );
            },
            enableColumnFilter: true,
        },

        // ==================== QUANTIDADE DE HORAS ====================
        {
            accessorKey: 'TOTAL_HORAS_OS',
            id: 'TOTAL_HORAS_OS',
            header: () => <CellHeader>QTD. HORAS</CellHeader>,
            cell: ({ getValue }) => {
                const value = getValue() as number | null;
                return (
                    <div className="text-center text-base font-extrabold tracking-widest text-black select-none">
                        {formatarHorasTotaisSufixo(value)}
                    </div>
                );
            },
            enableColumnFilter: false,
        },
    ];
};
