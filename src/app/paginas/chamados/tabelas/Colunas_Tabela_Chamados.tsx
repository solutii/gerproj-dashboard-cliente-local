// src/app/paginas/chamados/tabelas/Colunas_Tabela_Chamados.tsx

import type { HorasAdicionaisChamado } from '@/app/api/chamados/horas-adicionais/route';
import type { HorasMes } from '@/app/api/chamados/horas-por-mes/route';
import { HorasMesTooltip } from '@/app/paginas/chamados/componentes/Horas_Mes_Tooltip';
import { SLACell } from '@/app/paginas/chamados/componentes/SLA_Cell';
import { formatarDataHoraChamado } from '@/formatters/formatar-data';
import { formatarHorasRelogio } from '@/formatters/formatar-hora';
import { formatarNumeros, formatarPrioridade } from '@/formatters/formatar-numeros';
import { ColumnDef } from '@tanstack/react-table';
import React, { useEffect, useRef } from 'react';
import { BiSolidLike } from 'react-icons/bi';
import { MdHistory, MdOpenInNew, MdOutlineStar } from 'react-icons/md';

// ========== INTERFACES ==========
export interface ChamadoRowProps {
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
    TOTAL_HORAS_OS_FATURADAS?: number;
    TEM_OS?: boolean;
    DATA_HISTCHAMADO?: string | null;
    HORA_HISTCHAMADO?: string | null;
    DATA_INICIO_ATENDIMENTO?: string | null;
    HORA_INICIO_ATENDIMENTO?: string | null;
    COD_RECURSO?: number | null;

    SLA_STATUS?: string;
    SLA_PERCENTUAL?: number;
    SLA_TEMPO_DECORRIDO?: number;
    SLA_TEMPO_RESTANTE?: number;
    SLA_PRAZO_TOTAL?: number;
    SLA_DENTRO_PRAZO?: boolean;
}

// ========== CONSTANTES ==========
const STATUS_STYLES: Record<string, string> = {
    'EM ATENDIMENTO': 'bg-purple-300 border border-purple-500 text-black',
    FINALIZADO: 'bg-green-300 border border-green-500 text-black',
    STANDBY: 'bg-orange-300 border border-orange-500 text-black',
    ATRIBUIDO: 'bg-cyan-300 border border-cyan-500 text-black',
    'AGUARDANDO VALIDACAO': 'bg-yellow-300 border border-yellow-500 text-black',
    DEFAULT: 'bg-gray-300 border border-gray-500 text-black',
};

const EMPTY_VALUE = '==========';

// ========== FUNÇÕES UTILITÁRIAS ==========

const getStylesStatus = (status: string | undefined): string =>
    STATUS_STYLES[status?.toUpperCase() || 'DEFAULT'] || STATUS_STYLES.DEFAULT;
// ====

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
// =====

// Conectivos que não contam como "o segundo nome" — quando caem nessa posição,
// inclui o próximo nome de verdade junto (ex: "Maria de Souza" -> "Maria de Souza",
// mantendo o conectivo em vez de cortar em 2 palavras só).
const CONECTIVOS_NOME = new Set([
    'a',
    'e',
    'i',
    'o',
    'u',
    'da',
    'de',
    'di',
    'do',
    'du',
    'das',
    'des',
    'dis',
    'dos',
    'dus',
]);

const formatNomeRecurso = (value: string): string => {
    const parts = value.trim().split(/\s+/).filter(Boolean);

    if (parts.length <= 2) return parts.join(' ');

    if (CONECTIVOS_NOME.has(parts[1].toLowerCase()) && parts[2]) {
        return parts.slice(0, 3).join(' ');
    }

    return parts.slice(0, 2).join(' ');
};

// ========== COMPONENTES AUXILIARES ==========
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
    // AVALIA_CHAMADO é NOT NULL no Firebird e nasce sempre com 1 (default do
    // legado Delphi, ver route.ts "replicando os defaults do Delphi") — ou
    // seja, "1" é o sentinela de "nunca avaliado", não uma nota real, então
    // nunca chega null aqui (a API já normaliza pra 1). O corte em >= 2 é
    // proposital e espelha a mesma regra usada no backend
    // (avaliacao/route.ts) pra decidir se o chamado já foi avaliado.
    const avaliacaoValor = avaliacao ?? 1;
    const foiAvaliado = avaliacaoValor >= 2 && avaliacaoValor <= 5;

    return (
        <div className="flex w-full items-center gap-2">
            <div
                className={`flex items-center justify-center gap-2 rounded px-4 py-1.5 text-sm font-extrabold tracking-wide select-none ${styles} ${isFinalizado ? 'flex-1' : 'w-full'}`}
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
                                            ? 'fill-yellow-600 text-yellow-600'
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
// =====

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
// ====

const HistoricoButton = React.memo(function HistoricoButton({ onClick, title }: ActionButtonProps) {
    return (
        <button onClick={onClick} title={title}>
            <MdHistory
                className="cursor-pointer text-teal-600 transition-all duration-200 hover:scale-140 active:scale-95"
                size={30}
            />
        </button>
    );
});
// ====

const CellHeader = React.memo(function CellHeader({ children }: { children: React.ReactNode }) {
    return (
        <div className="text-center text-sm font-bold tracking-wide text-white select-none">
            {children}
        </div>
    );
});
// ====

const CellText = React.memo(function CellText({
    value,
    centered = true,
    className = '',
}: {
    value: string;
    centered?: boolean;
    className?: string;
}) {
    return (
        <div
            className={`text-sm font-medium tracking-wide text-black select-none ${
                centered ? 'text-center' : ''
            } ${className}`}
        >
            {value}
        </div>
    );
});
// ====

const TruncatedCell = React.memo(function TruncatedCell({
    value,
    centered = false,
    className = '',
}: {
    value: string;
    centered?: boolean;
    className?: string;
}) {
    const ref = useRef<HTMLDivElement>(null);

    // Só remede a truncagem quando o texto realmente muda — o ref callback
    // inline antigo era recriado (e reexecutado) a cada render da célula,
    // mesmo sem mudança de conteúdo.
    useEffect(() => {
        setupTruncationTooltip(ref.current, value);
    }, [value]);

    return (
        <div
            ref={ref}
            className={`flex-1 truncate overflow-hidden text-sm font-medium tracking-wide whitespace-nowrap text-black select-none ${
                centered ? 'text-center' : ''
            } ${className}`}
        >
            {value}
        </div>
    );
});

// ========== COMPONENTE PRINCIPAL ==========
export const getColunasChamados = (
    onOpenSolicitacao?: (chamado: ChamadoRowProps) => void,
    onOpenAvaliacao?: (chamado: ChamadoRowProps) => void,
    getHoras?: (codChamado: number) => HorasMes[],
    isLoadingHoras?: boolean,
    getHorasAdicionais?: (codChamado: number) => HorasAdicionaisChamado | null,
    isLoadingHorasAdicionais?: boolean,
    onOpenHistorico?: (chamado: ChamadoRowProps) => void
): ColumnDef<ChamadoRowProps>[] => {
    return [
        // ========== CÓDIGO DO CHAMADO ==========
        {
            accessorKey: 'COD_CHAMADO',
            id: 'COD_CHAMADO',
            header: () => <CellHeader>CHAMADO</CellHeader>,
            cell: ({ getValue, row, table }) => {
                const temOS = row.original.TEM_OS ?? false;
                const value = getValue() as number;
                const handleChamadoClick = table.options.meta?.handleChamadoClick;

                if (!temOS) return <CellText value={formatarNumeros(value)} />;

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
        // =====

        // ========== DATA/HORA DA ABERTURA ==========
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
        // =====

        // ========== DATA/HORA DA ATRIBUIÇÃO ==========
        {
            accessorKey: 'DTENVIO_CHAMADO',
            id: 'DTENVIO_CHAMADO',
            header: () => <CellHeader>ATRIBUIÇÃO</CellHeader>,
            cell: ({ getValue }) => {
                const value = (getValue() as string) ?? EMPTY_VALUE;
                // "DD/MM/AAAA HH:MM" -> "DD/MM/AAAA - HH:MM"
                const formatted = value.replace(
                    /^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})/,
                    '$1 - $2'
                );
                return <CellText value={formatted} />;
            },
            enableColumnFilter: true,
        },
        // =====

        // ========== DATA/HORA DO INÍCIO ==========
        {
            id: 'DTINI_CHAMADO',
            header: () => <CellHeader>INÍCIO</CellHeader>,
            cell: ({ row }) => {
                const { DATA_INICIO_ATENDIMENTO, HORA_INICIO_ATENDIMENTO } = row.original;

                if (!DATA_INICIO_ATENDIMENTO || !HORA_INICIO_ATENDIMENTO)
                    return <CellText value={EMPTY_VALUE} />;

                return (
                    <CellText
                        value={formatarDataHoraChamado(
                            DATA_INICIO_ATENDIMENTO,
                            HORA_INICIO_ATENDIMENTO
                        )}
                    />
                );
            },
        },
        // =====

        // ========== SLA ==========
        {
            id: 'SLA_INFO',
            header: () => <CellHeader>SLA</CellHeader>,
            cell: ({ row }) => {
                const { DATA_CHAMADO, HORA_CHAMADO, PRIOR_CHAMADO, STATUS_CHAMADO, DTINI_CHAMADO } =
                    row.original;
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
        // =====

        // ========== HISTÓRICO ==========
        {
            id: 'HISTORICO',
            header: () => <CellHeader>HISTÓRICO</CellHeader>,
            cell: ({ row }) => {
                if (!onOpenHistorico) return null;
                return (
                    <div className="flex items-center justify-center">
                        <HistoricoButton
                            onClick={(e) => {
                                e.stopPropagation();
                                onOpenHistorico(row.original);
                            }}
                            title="Ver histórico do chamado"
                        />
                    </div>
                );
            },
            enableColumnFilter: false,
        },
        // =====

        // ========== DATA/HORA DA FINALIZAÇÃO ==========
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
        // =====

        // ========== STATUS ==========
        {
            accessorKey: 'STATUS_CHAMADO',
            id: 'STATUS_CHAMADO',
            header: () => <CellHeader>STATUS</CellHeader>,
            cell: ({ getValue, row }) => {
                const value = getValue() as string;
                return (
                    <StatusBadge
                        status={value}
                        avaliacao={row.original.AVALIA_CHAMADO}
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
        // =====

        // ========== ASSUNTO ==========
        {
            accessorKey: 'ASSUNTO_CHAMADO',
            id: 'ASSUNTO_CHAMADO',
            header: () => <CellHeader>ASSUNTO</CellHeader>,
            cell: ({ getValue, row }) => {
                const value = getValue() as string | null;
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
                        <TruncatedCell value={value ?? ''} />
                    </div>
                );
            },
            enableColumnFilter: true,
        },
        // =====

        // ========== EMAIL ==========
        {
            accessorKey: 'EMAIL_CHAMADO',
            id: 'EMAIL_CHAMADO',
            header: () => <CellHeader>EMAIL</CellHeader>,
            cell: ({ getValue }) => {
                const value = (getValue() as string) ?? EMPTY_VALUE;
                if (value === EMPTY_VALUE) return <CellText value={value} />;
                return <TruncatedCell value={value} />;
            },
            enableColumnFilter: true,
        },
        // =====

        // ========== CLASSIFICAÇÃO ==========
        {
            accessorKey: 'NOME_CLASSIFICACAO',
            id: 'NOME_CLASSIFICACAO',
            header: () => <CellHeader>CLASSIFICAÇÃO</CellHeader>,
            cell: ({ getValue }) => {
                const value = getValue() as string | null;
                return <TruncatedCell value={value ?? ''} />;
            },
            enableColumnFilter: true,
        },
        // =====

        // ========== CONSULTOR ==========
        {
            accessorKey: 'NOME_RECURSO',
            id: 'NOME_RECURSO',
            header: () => <CellHeader>CONSULTOR</CellHeader>,
            cell: ({ getValue }) => {
                const value = (getValue() as string) ?? EMPTY_VALUE;
                if (value === EMPTY_VALUE) return <CellText value={value} />;
                return <TruncatedCell value={formatNomeRecurso(value)} />;
            },
            enableColumnFilter: true,
        },
        // =====

        // ========== PRIORIDADE ==========
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
        // =====

        // ========== HORAS (consolida Qtd./Adicional/Total num único campo) ==========
        {
            accessorKey: 'TOTAL_HORAS_OS',
            id: 'HORAS',
            header: () => <CellHeader>HORAS</CellHeader>,
            cell: ({ getValue, row }) => {
                const totalHoras = getValue() as number | null;
                const { COD_CHAMADO, TEM_OS } = row.original;

                if (!TEM_OS) return <CellText value={EMPTY_VALUE} />;

                // Histórico completo (todos os meses) — independe do mês filtrado,
                // usado só pro tooltip. O valor exibido na célula é o do mês filtrado.
                const meses = getHoras ? getHoras(COD_CHAMADO) : [];
                const horasAdicionais = getHorasAdicionais?.(COD_CHAMADO) ?? null;

                if (isLoadingHoras || isLoadingHorasAdicionais) {
                    return (
                        <div className="text-center text-base font-extrabold tracking-wide text-black select-none">
                            <span className="animate-pulse text-gray-400">...</span>
                        </div>
                    );
                }

                const adicional = horasAdicionais?.horasAdicionalGerado ?? 0;
                const totalFinal = horasAdicionais?.totalHorasEquivalente ?? totalHoras ?? 0;

                const conteudo = (
                    <div className="text-center text-base font-extrabold tracking-wide text-black select-none">
                        {formatarHorasRelogio(totalFinal)}
                    </div>
                );

                return (
                    <HorasMesTooltip
                        meses={meses}
                        resumoMesAtual={{
                            contratadas: totalHoras ?? 0,
                            adicional,
                            total: totalFinal,
                        }}
                    >
                        {conteudo}
                    </HorasMesTooltip>
                );
            },
            enableColumnFilter: false,
        },
    ];
};
