// src/components/chamados/tabelas/Colunas_Tabela_OS.tsx

import { formatarDataParaBR } from '@/formatters/formatar-data';
import { formatarHora, formatarHorasTotaisSufixo } from '@/formatters/formatar-hora';
import { formatarNumeros } from '@/formatters/formatar-numeros';
import { corrigirTextoCorrompido } from '@/formatters/formatar-texto-corrompido';
import { formatarHorasAdicional, HorasAdicionaisResult } from '@/lib/os/calcular-horas-adicionais';
import { ColumnDef } from '@tanstack/react-table';
import React from 'react';
import { FaCheck } from 'react-icons/fa';
import { MdClose, MdOpenInNew } from 'react-icons/md';

// =====================================================
// MODULE AUGMENTATION
// =====================================================
declare module '@tanstack/react-table' {
    interface TableMeta<TData> {
        handleOpenModalObs?: (os: TData) => void;
        onSelectOS?: (os: TData) => void;
    }
}

// =====================================================
// INTERFACES E TIPOS
// =====================================================
export interface OSRowProps {
    COD_OS: number;
    NUM_OS: number;
    DTINI_OS: string;
    HRINI_OS: string;
    HRFIM_OS: string;
    TOTAL_HORAS_OS: number;
    OBS: string | null;
    NOME_RECURSO: string | null;
    NOME_TAREFA: string | null;
    VALCLI_OS: string | null;
    OBSCLI_OS?: string | null;
    NOME_CLIENTE?: string | null;
    // ✅ NOVO: breakdown de horas com adicional
    HORAS_ADICIONAL?: HorasAdicionaisResult;
}

// =====================================================
// CONSTANTES
// =====================================================
const EMPTY_VALUE = '---------------';

const VALIDATION_STYLES = {
    SIM: {
        container: 'border-green-600 bg-green-500 text-black',
        icon: 'text-black',
        label: 'Aprovada',
        Icon: FaCheck,
    },
    NAO: {
        container: 'border-red-600 bg-red-500 text-white',
        icon: 'text-white',
        label: 'Reprovada',
        Icon: MdClose,
    },
    DEFAULT: {
        container: 'border-gray-400 bg-gray-300 text-black',
        icon: '',
        label: null,
        Icon: null,
    },
} as const;

// =====================================================
// FUNÇÕES UTILITÁRIAS
// =====================================================
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

const normalizeValidationStatus = (status?: string | null): keyof typeof VALIDATION_STYLES => {
    const statusNormalized = (status ?? 'SIM').toString().toUpperCase().trim();
    if (statusNormalized === 'NAO') return 'NAO';
    if (statusNormalized === 'SIM') return 'SIM';
    return 'DEFAULT';
};

// =====================================================
// COMPONENTES AUXILIARES BASE
// =====================================================
interface ValidacaoBadgeProps {
    status?: string | null;
}

const ValidacaoBadge = React.memo(function ValidacaoBadge({ status }: ValidacaoBadgeProps) {
    const statusKey = normalizeValidationStatus(status);
    const config = VALIDATION_STYLES[statusKey];
    const IconComponent = config.Icon;

    return (
        <div
            className={`flex items-center justify-center gap-2 rounded border px-4 py-1.5 text-sm font-extrabold tracking-widest shadow-sm shadow-black select-none ${config.container}`}
        >
            {IconComponent && <IconComponent className={config.icon} size={18} />}
            {config.label || status || EMPTY_VALUE}
        </div>
    );
});

interface ActionButtonOSProps {
    onClick: (e: React.MouseEvent) => void;
    title: string;
}

const ActionButtonOS = React.memo(function ActionButtonOS({ onClick, title }: ActionButtonOSProps) {
    return (
        <button onClick={onClick} title={title}>
            <MdOpenInNew
                className="cursor-pointer text-purple-600 transition-all duration-200 hover:scale-140 hover:-rotate-45 active:scale-95"
                size={28}
            />
        </button>
    );
});

interface CellHeaderOSProps {
    children: React.ReactNode;
}

const CellHeaderOS = React.memo(function CellHeaderOS({ children }: CellHeaderOSProps) {
    return (
        <div className="text-center text-sm font-extrabold tracking-widest text-white select-none">
            {children}
        </div>
    );
});

interface CellTextOSProps {
    value: string | number;
    className?: string;
}

const CellTextOS = React.memo(function CellTextOS({ value, className = '' }: CellTextOSProps) {
    return (
        <div
            className={`text-center text-sm font-semibold tracking-widest text-black select-none ${className}`}
        >
            {value}
        </div>
    );
});

interface TruncatedCellOSProps {
    value: string;
    className?: string;
}

const TruncatedCellOS = React.memo(function TruncatedCellOS({
    value,
    className = '',
}: TruncatedCellOSProps) {
    return (
        <div
            ref={(el) => setupTruncationTooltip(el, value)}
            className={`flex-1 truncate overflow-hidden text-sm font-semibold tracking-widest whitespace-nowrap text-black select-none ${className}`}
        >
            {value}
        </div>
    );
});

// =====================================================
// COMPONENTE: BREAKDOWN DE HORAS ADICIONAIS
// =====================================================

interface HorasAdicionaisBreakdownProps {
    horas: HorasAdicionaisResult;
}

/**
 * Exibe o breakdown completo de horas:
 *  - Linha de horas dentro do horário comercial (verde)
 *  - Linha de horas fora do horário (laranja) + equivalente com ×1.5
 *  - Linha de total equivalente em destaque
 *
 * Se não houver adicional, exibe apenas o total bruto de forma compacta.
 */
const HorasAdicionaisBreakdown = React.memo(function HorasAdicionaisBreakdown({
    horas,
}: HorasAdicionaisBreakdownProps) {
    // Sem horas fora do horário: célula vazia — o valor já aparece em "TOTAL HORAS"
    if (!horas.temAdicional) {
        return null;
    }

    // Tem horas fora do horário mas nenhuma hora cheia → sem acréscimo real → célula vazia
    if (horas.horasAdicionalGerado === 0) {
        return null;
    }

    // Tem acréscimo real de 50%: exibe breakdown completo
    return (
        <div className="flex flex-col gap-1 py-1">
            {/* Horas sem adicional (comercial + janela 05–08) */}
            {horas.horasSemAdicional > 0 && (
                <div className="flex items-center justify-between gap-2 rounded bg-green-100 px-2 py-0.5">
                    <span className="text-xs font-bold tracking-wide whitespace-nowrap text-green-700 select-none">
                        Comercial
                    </span>
                    <span className="text-xs font-semibold text-green-800 select-none">
                        {formatarHorasAdicional(horas.horasSemAdicional)}
                    </span>
                </div>
            )}

            {/* Horas com adicional: bruto → equivalente */}
            <div className="flex items-center justify-between gap-2 rounded bg-orange-100 px-2 py-0.5">
                <span className="text-xs font-bold tracking-wide whitespace-nowrap text-orange-700 select-none">
                    +50%
                </span>
                <span className="text-xs font-semibold text-orange-800 select-none">
                    {formatarHorasAdicional(horas.horasComAdicional)}
                    <span className="mx-1 text-orange-400">→</span>
                    {formatarHorasAdicional(horas.horasComAdicionalEquivalente)}
                </span>
            </div>

            {/* Adicional gerado */}
            <div className="flex items-center justify-between gap-2 rounded bg-yellow-50 px-2 py-0.5">
                <span className="text-xs font-bold tracking-wide whitespace-nowrap text-yellow-700 select-none">
                    Adicional
                </span>
                <span className="text-xs font-semibold text-yellow-800 select-none">
                    +{formatarHorasAdicional(horas.horasAdicionalGerado)}
                </span>
            </div>

            {/* Total equivalente */}
            <div className="flex items-center justify-between gap-2 rounded bg-purple-100 px-2 py-0.5">
                <span className="text-xs font-bold tracking-wide whitespace-nowrap text-purple-700 select-none">
                    Total
                </span>
                <span className="text-xs font-bold text-purple-900 select-none">
                    {formatarHorasAdicional(horas.totalHorasEquivalente)}
                </span>
            </div>
        </div>
    );
});

// =====================================================
// DEFINIÇÃO DAS COLUNAS
// =====================================================
export const getColunasOS = (): ColumnDef<OSRowProps>[] => {
    return [
        // ==================== NÚMERO OS ====================
        {
            accessorKey: 'NUM_OS',
            id: 'NUM_OS',
            header: () => <CellHeaderOS>NÚM. OS</CellHeaderOS>,
            cell: ({ getValue, row, table }) => {
                const value = (getValue() as number) ?? EMPTY_VALUE;
                const onSelectOS = table.options.meta?.onSelectOS;

                return (
                    <div className="flex items-center gap-2">
                        <ActionButtonOS
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelectOS?.(row.original);
                            }}
                            title="Validação OS"
                        />
                        <div className="flex-1">
                            <CellTextOS value={formatarNumeros(value)} />
                        </div>
                    </div>
                );
            },
        },

        // ==================== DATA INÍCIO ====================
        {
            accessorKey: 'DTINI_OS',
            id: 'DTINI_OS',
            header: () => <CellHeaderOS>DATA</CellHeaderOS>,
            cell: ({ getValue }) => {
                const value = getValue() as string;
                return <CellTextOS value={formatarDataParaBR(value)} />;
            },
        },

        // ==================== HORA INÍCIO ====================
        {
            accessorKey: 'HRINI_OS',
            id: 'HRINI_OS',
            header: () => <CellHeaderOS>HR. INÍCIO</CellHeaderOS>,
            cell: ({ getValue }) => {
                const value = getValue() as string;
                return <CellTextOS value={formatarHora(value)} />;
            },
        },

        // ==================== HORA FIM ====================
        {
            accessorKey: 'HRFIM_OS',
            id: 'HRFIM_OS',
            header: () => <CellHeaderOS>HR. FIM</CellHeaderOS>,
            cell: ({ getValue }) => {
                const value = getValue() as string;
                return <CellTextOS value={formatarHora(value)} />;
            },
        },

        // ==================== TOTAL HORAS (bruto) ====================
        {
            accessorKey: 'TOTAL_HORAS_OS',
            id: 'TOTAL_HORAS_OS',
            header: () => <CellHeaderOS>TOTAL HORAS</CellHeaderOS>,
            cell: ({ getValue }) => {
                const value = getValue() as number;
                return <CellTextOS value={formatarHorasTotaisSufixo(value)} />;
            },
        },

        // ==================== HORAS COM ADICIONAL (breakdown) ====================
        {
            accessorKey: 'HORAS_ADICIONAL',
            id: 'HORAS_ADICIONAL',
            header: () => <CellHeaderOS>HORAS EQUIV.</CellHeaderOS>,
            cell: ({ getValue }) => {
                const horas = getValue() as HorasAdicionaisResult | undefined;

                if (!horas) {
                    return <CellTextOS value={EMPTY_VALUE} />;
                }

                return <HorasAdicionaisBreakdown horas={horas} />;
            },
        },

        // ==================== OBSERVAÇÃO ====================
        {
            accessorKey: 'OBS',
            id: 'OBS',
            header: () => <CellHeaderOS>OBSERVAÇÃO</CellHeaderOS>,
            cell: ({ getValue, row, table }) => {
                const value = getValue() as string | null;
                const correctedText = corrigirTextoCorrompido(value);
                const hasObservacao = value && value !== EMPTY_VALUE;
                const handleOpenModalObs = table.options.meta?.handleOpenModalObs;

                return (
                    <div className="flex w-full items-center gap-4">
                        {hasObservacao && handleOpenModalObs && (
                            <ActionButtonOS
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenModalObs(row.original);
                                }}
                                title="Visualizar observação completa"
                            />
                        )}
                        <TruncatedCellOS value={correctedText} />
                    </div>
                );
            },
        },

        // ==================== CONSULTOR ====================
        {
            accessorKey: 'NOME_RECURSO',
            id: 'NOME_RECURSO',
            header: () => <CellHeaderOS>CONSULTOR</CellHeaderOS>,
            cell: ({ getValue }) => {
                const value = (getValue() as string) ?? EMPTY_VALUE;
                if (value === EMPTY_VALUE) return <CellTextOS value={value} />;
                return <TruncatedCellOS value={formatNomeRecurso(value)} />;
            },
        },

        // ==================== ENTREGÁVEL ====================
        {
            accessorKey: 'NOME_TAREFA',
            id: 'NOME_TAREFA',
            header: () => <CellHeaderOS>ENTREGÁVEL</CellHeaderOS>,
            cell: ({ getValue }) => {
                const value = (getValue() as string) ?? EMPTY_VALUE;
                if (value === EMPTY_VALUE) return <CellTextOS value={value} />;
                return <TruncatedCellOS value={corrigirTextoCorrompido(value)} />;
            },
        },

        // ==================== VALIDAÇÃO ====================
        {
            accessorKey: 'VALCLI_OS',
            id: 'VALCLI_OS',
            header: () => <CellHeaderOS>VALIDAÇÃO</CellHeaderOS>,
            cell: ({ getValue }) => {
                const value = (getValue() as string) ?? EMPTY_VALUE;
                return (
                    <div className="flex w-full justify-center">
                        <ValidacaoBadge status={value} />
                    </div>
                );
            },
        },
    ];
};
