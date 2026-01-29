// src/components/chamados/tabelas/Colunas_Tabela_OS.tsx

import { formatarDataParaBR } from '@/formatters/formatar-data';
import { formatarHora, formatarHorasTotaisSufixo } from '@/formatters/formatar-hora';
import { formatarNumeros } from '@/formatters/formatar-numeros';
import { corrigirTextoCorrompido } from '@/formatters/formatar-texto-corrompido';
import { ColumnDef } from '@tanstack/react-table';
// =====================================================
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
// COMPONENTES AUXILIARES
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

        // ==================== TOTAL HORAS ====================
        {
            accessorKey: 'TOTAL_HORAS_OS',
            id: 'TOTAL_HORAS_OS',
            header: () => <CellHeaderOS>TOTAL HORAS</CellHeaderOS>,
            cell: ({ getValue }) => {
                const value = getValue() as number;
                return <CellTextOS value={formatarHorasTotaisSufixo(value)} />;
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

                if (value === EMPTY_VALUE) {
                    return <CellTextOS value={value} />;
                }

                const displayName = formatNomeRecurso(value);
                return <TruncatedCellOS value={displayName} />;
            },
        },

        // ==================== ENTREGÁVEL ====================
        {
            accessorKey: 'NOME_TAREFA',
            id: 'NOME_TAREFA',
            header: () => <CellHeaderOS>ENTREGÁVEL</CellHeaderOS>,
            cell: ({ getValue }) => {
                const value = (getValue() as string) ?? EMPTY_VALUE;

                if (value === EMPTY_VALUE) {
                    return <CellTextOS value={value} />;
                }

                const correctedText = corrigirTextoCorrompido(value);
                return <TruncatedCellOS value={correctedText} />;
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
